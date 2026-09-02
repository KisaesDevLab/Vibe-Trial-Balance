// Copyright 2025-2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Use is limited to qualifying small businesses. See LICENSE for terms.

/**
 * Trial balance import from a connected QuickBooks Online company.
 *
 * Mounted under /api/v1/import/ on purpose: nginx gives that prefix its long
 * timeout and the existing limiters route /preview → uploadLimiter and
 * /confirm → aiStepLimiter without any new wiring.
 *
 * Preview pulls the report and parks it (raw JSON + sha256 + params) on a
 * pending `document_imports` row. Confirm RE-DERIVES every amount from that
 * stored report and only takes routing decisions from the browser: the client
 * never supplies a cent.
 *
 * Two targets share the flow. `current` (default) lands in the period's
 * unadjusted columns. `prior` pulls the PRIOR year's report — the adjacent
 * period's dates when the app has one, else this period's dates slid back a
 * year — and lands in `py_comparison_data` for the PY Tie-Out, exactly as a
 * CSV upload of the bookkeeper's final prior-year TB would. Both stamp
 * `qbo_account_id`, so a link made during a tie-out serves the next import.
 */

import { createHash } from 'crypto';
import { Router, Response } from 'express';
import { z } from 'zod';
import { db } from '../db';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { assertPeriodUnlocked, logAudit } from '../lib/periodGuard';
import { sendServerError } from '../lib/safeError';
import { inferAccountType } from '../lib/accountTypeInference';
import { suggestLeadSheet } from '../lib/leadSheets';
import { loadQboConfig } from '../lib/qbo/settings';
import { apiForConnection, loadConnectionForClient, QboConnectionError } from '../lib/qbo/tokenStore';
import { QboApiError } from '../lib/qbo/apiClient';
import { QboOAuthError } from '../lib/qbo/oauth';
import {
  extractSummaryTotals,
  flattenTrialBalanceRows,
  parseReportHeader,
  validateTotals,
} from '../lib/qbo/reportParser';
import { findAbsentNonzeroAccounts, matchRows, type CoaRowForMatch, type QboAccountLite } from '../lib/qbo/matcher';
import { applyDecisions, DecisionError } from '../lib/qbo/decisions';
import { priorYearRange, type CandidatePeriod, type PriorRange } from '../lib/qbo/priorRange';

type ImportTarget = 'current' | 'prior';

export const qboImportRouter = Router();
qboImportRouter.use(authMiddleware);

/** What the pending import row keeps in `ai_extraction`. */
interface StoredQboImport {
  raw: unknown;
  sha256: string;
  params: { start_date: string; end_date: string; accounting_method: 'Accrual' | 'Cash' };
  header: ReturnType<typeof parseReportHeader>;
  companyName: string;
  accountingMethod: 'Accrual' | 'Cash';
  realmId: string;
  environment: string;
  accounts: QboAccountLite[];
  fetchedAt: string;
  /** Absent on rows written before the PY tie-out target existed: those are `current`. */
  target?: ImportTarget;
  priorRange?: PriorRange;
  decisions?: unknown;
  result?: unknown;
}

function isoDate(v: unknown): string | null {
  if (!v) return null;
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  const s = String(v);
  return /^\d{4}-\d{2}-\d{2}/.test(s) ? s.slice(0, 10) : null;
}

function respondQboError(res: Response, err: unknown): boolean {
  if (err instanceof QboConnectionError) {
    const status = err.code === 'NOT_FOUND' ? 404 : 409;
    res.status(status).json({ data: null, error: { code: `QBO_${err.code}`, message: err.message } });
    return true;
  }
  if (err instanceof QboApiError) {
    res.status(502).json({ data: null, error: { code: 'QBO_API_ERROR', message: err.message } });
    return true;
  }
  // A refresh that Intuit refused. invalid_grant already flipped the row to needs_reauth in
  // tokenStore; a fatal (e.g. invalid_client) means the app credentials themselves are wrong.
  if (err instanceof QboOAuthError) {
    const message =
      err.kind === 'invalid_grant'
        ? 'QuickBooks no longer accepts this connection — reconnect the client under Setup → QuickBooks.'
        : err.kind === 'transient'
          ? 'Intuit is temporarily unavailable. Try again in a minute.'
          : `Intuit rejected the app credentials (${err.intuitError ?? `HTTP ${err.status}`}). Check the Client ID / Client Secret under Admin → QuickBooks API.`;
    res.status(err.kind === 'transient' ? 503 : 409).json({ data: null, error: { code: `QBO_OAUTH_${err.kind.toUpperCase()}`, message } });
    return true;
  }
  return false;
}

async function loadCoaForMatch(clientId: number): Promise<CoaRowForMatch[]> {
  return (await db('chart_of_accounts')
    .where({ client_id: clientId, is_active: true })
    .select('id', 'account_number', 'account_name', 'qbo_account_id')) as CoaRowForMatch[];
}

// ─────────────────────────────────────────────────────────────────────────
// POST /preview
// ─────────────────────────────────────────────────────────────────────────
const previewSchema = z.object({
  periodId: z.number().int().positive(),
  clientId: z.number().int().positive(),
  accountingMethod: z.enum(['Accrual', 'Cash']).optional(),
  target: z.enum(['current', 'prior']).default('current'),
});

qboImportRouter.post('/preview', async (req: AuthRequest, res: Response): Promise<void> => {
  const parsed = previewSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ data: null, error: { code: 'VALIDATION_ERROR', message: parsed.error.message } });
    return;
  }
  const { periodId, clientId, target } = parsed.data;
  try {
    const cfg = await loadQboConfig();
    if (!cfg.configured) {
      res.status(409).json({ data: null, error: { code: 'QBO_NOT_CONFIGURED', message: 'QuickBooks is not configured.' } });
      return;
    }
    const period = await db('periods').where({ id: periodId, client_id: clientId }).first();
    if (!period) {
      res.status(404).json({ data: null, error: { code: 'NOT_FOUND', message: 'Period not found for this client.' } });
      return;
    }
    await assertPeriodUnlocked(periodId);
    const periodStart = isoDate(period.start_date);
    const periodEnd = isoDate(period.end_date);
    if (!periodStart || !periodEnd) {
      res.status(422).json({
        data: null,
        error: { code: 'PERIOD_DATES_REQUIRED', message: 'The period needs a start and end date before its trial balance can be pulled from QuickBooks.' },
      });
      return;
    }
    let startDate = periodStart;
    let endDate = periodEnd;
    let priorRange: PriorRange | undefined;
    if (target === 'prior') {
      const others = (await db('periods')
        .where({ client_id: clientId })
        .whereNot('id', periodId)
        .whereNotNull('start_date')
        .whereNotNull('end_date')
        .select('id', 'period_name', 'start_date', 'end_date')) as Array<{ id: number; period_name: string; start_date: unknown; end_date: unknown }>;
      const candidates: CandidatePeriod[] = others
        .map((p) => ({ id: p.id, period_name: p.period_name, start_date: isoDate(p.start_date) ?? '', end_date: isoDate(p.end_date) ?? '' }))
        .filter((p) => p.start_date && p.end_date);
      priorRange = priorYearRange(periodStart, periodEnd, candidates);
      startDate = priorRange.startDate;
      endDate = priorRange.endDate;
    }

    const conn = await loadConnectionForClient(clientId);
    if (!conn) {
      res.status(409).json({ data: null, error: { code: 'QBO_NOT_CONNECTED', message: 'This client is not connected to a QuickBooks company.' } });
      return;
    }
    if (conn.status !== 'active' || conn.environment !== cfg.environment) {
      res.status(409).json({
        data: null,
        error: { code: 'QBO_NEEDS_REAUTH', message: 'The QuickBooks connection for this client needs re-authorization. Reconnect it on the QuickBooks page.' },
      });
      return;
    }

    const api = await apiForConnection(conn);
    const info = await api.companyInfo();
    const prefs = await api.preferences();
    const accountingMethod = parsed.data.accountingMethod ?? prefs.reportBasis ?? 'Accrual';
    const accounts = await api.allAccounts();
    const params = { start_date: startDate, end_date: endDate, accounting_method: accountingMethod } as const;
    const raw = await api.trialBalance(params);

    const header = parseReportHeader(raw);
    const reportRows = flattenTrialBalanceRows(raw);
    const totals = validateTotals(reportRows, extractSummaryTotals(raw));
    if (!totals.summaryMatches) {
      res.status(422).json({
        data: null,
        error: {
          code: 'QBO_REPORT_PARSE_MISMATCH',
          message: `The QuickBooks report total does not match the sum of its rows (rows ${totals.debitCents}/${totals.creditCents} cents). The import was refused rather than importing a partial balance.`,
        },
      });
      return;
    }

    const coa = await loadCoaForMatch(clientId);
    const rows = matchRows(reportRows, coa, accounts);
    const matchedIds = new Set(rows.filter((r) => r.matchedAccountId !== null).map((r) => r.matchedAccountId!));
    const tbRows = (await db('trial_balance as tb')
      .join('chart_of_accounts as coa', 'coa.id', 'tb.account_id')
      .where({ 'tb.period_id': periodId })
      .select('tb.account_id', 'coa.account_number', 'coa.account_name', 'tb.unadjusted_debit', 'tb.unadjusted_credit')) as Array<{
      account_id: number;
      account_number: string;
      account_name: string;
      unadjusted_debit: string | number;
      unadjusted_credit: string | number;
    }>;
    // A tie-out never zeroes anything: an account QuickBooks omitted simply has no uploaded
    // PY balance, and the comparison already shows that as a variance against the rolled PY.
    const absentNonzero = target === 'prior' ? [] : findAbsentNonzeroAccounts(tbRows, matchedIds);

    const warnings: string[] = [];
    if (!totals.balanced) warnings.push('OUT_OF_BALANCE');
    if (totals.summaryMissing) warnings.push('SUMMARY_MISSING');
    if (reportRows.length === 0) warnings.push('NO_REPORT_DATA');
    if (header.startPeriod && header.startPeriod !== startDate) warnings.push('START_DATE_DIFFERS');
    if (header.endPeriod && header.endPeriod !== endDate) warnings.push('END_DATE_DIFFERS');

    const stored: StoredQboImport = {
      raw,
      sha256: createHash('sha256').update(JSON.stringify(raw)).digest('hex'),
      params,
      header,
      companyName: info.CompanyName,
      accountingMethod,
      realmId: conn.realm_id,
      environment: conn.environment,
      accounts,
      fetchedAt: new Date().toISOString(),
      target,
      ...(priorRange ? { priorRange } : {}),
    };
    let importId = 0;
    await db.transaction(async (trx) => {
      await trx('document_imports').where({ period_id: periodId, import_type: 'qbo', status: 'pending' }).del();
      const [row] = (await trx('document_imports')
        .insert({
          client_id: clientId,
          period_id: periodId,
          import_type: 'qbo',
          document_type: 'trial_balance',
          status: 'pending',
          ai_extraction: JSON.stringify(stored),
          imported_by: req.user!.userId,
          imported_at: trx.fn.now(),
        })
        .returning('id')) as Array<{ id: number }>;
      importId = row.id;
    });

    res.json({
      data: {
        importId,
        target,
        priorRange: priorRange ?? null,
        companyName: info.CompanyName,
        accountingMethod,
        defaultAccountingMethod: prefs.reportBasis,
        bookCloseDate: prefs.bookCloseDate,
        header,
        params,
        totals: {
          debitCents: totals.debitCents,
          creditCents: totals.creditCents,
          balanced: totals.balanced,
          imbalanceCents: totals.imbalanceCents,
        },
        rows,
        absentNonzero,
        warnings,
        sha256: stored.sha256,
      },
      error: null,
    });
  } catch (err: unknown) {
    const e = err as { code?: string; message?: string };
    if (e.code === 'PERIOD_LOCKED') {
      res.status(409).json({ data: null, error: { code: 'PERIOD_LOCKED', message: e.message ?? 'Period is locked' } });
      return;
    }
    if (respondQboError(res, err)) return;
    sendServerError(res, err, 'qbo-import preview');
  }
});

// ─────────────────────────────────────────────────────────────────────────
// POST /confirm
// ─────────────────────────────────────────────────────────────────────────
const decisionSchema = z.object({
  rowKey: z.string().max(20),
  action: z.enum(['match', 'create_new', 'skip']),
  matchedAccountId: z.number().int().positive().nullable().optional(),
  newAccountNumber: z.string().max(40).nullable().optional(),
  newAccountName: z.string().max(255).nullable().optional(),
  newCategory: z.string().max(20).nullable().optional(),
  newNormalBalance: z.string().max(10).nullable().optional(),
});

const confirmSchema = z.object({
  importId: z.number().int().positive(),
  decisions: z.array(decisionSchema).max(5000),
  zeroAbsent: z.boolean().default(true),
  acknowledgeUnbalanced: z.boolean().optional(),
});

qboImportRouter.post('/confirm', async (req: AuthRequest, res: Response): Promise<void> => {
  const parsed = confirmSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ data: null, error: { code: 'VALIDATION_ERROR', message: parsed.error.message } });
    return;
  }
  const { importId, decisions, zeroAbsent } = parsed.data;
  try {
    const importRow = await db('document_imports').where({ id: importId, import_type: 'qbo' }).first();
    if (!importRow) {
      res.status(404).json({ data: null, error: { code: 'NOT_FOUND', message: 'Import not found.' } });
      return;
    }
    if (importRow.status !== 'pending') {
      res.status(409).json({ data: null, error: { code: 'IMPORT_ALREADY_CONFIRMED', message: 'This import was already confirmed. Run a new preview.' } });
      return;
    }
    const clientId = importRow.client_id as number;
    const periodId = importRow.period_id as number;
    const stored = (typeof importRow.ai_extraction === 'string' ? JSON.parse(importRow.ai_extraction) : importRow.ai_extraction) as StoredQboImport;

    const conn = await loadConnectionForClient(clientId);
    if (!conn || conn.realm_id !== stored.realmId) {
      res.status(409).json({
        data: null,
        error: { code: 'QBO_CONNECTION_CHANGED', message: 'The QuickBooks connection for this client changed since the preview. Run a new preview.' },
      });
      return;
    }

    // Everything numeric comes from the stored report, matched against the COA as it is NOW.
    const reportRows = flattenTrialBalanceRows(stored.raw);
    const totals = validateTotals(reportRows, extractSummaryTotals(stored.raw));
    if (!totals.balanced && !parsed.data.acknowledgeUnbalanced) {
      res.status(422).json({
        data: null,
        error: { code: 'OUT_OF_BALANCE', message: `The QuickBooks report is out of balance by ${totals.imbalanceCents} cents. Acknowledge it to import anyway.` },
      });
      return;
    }
    const existingCoa = await loadCoaForMatch(clientId);
    const matched = matchRows(reportRows, existingCoa, stored.accounts ?? []);
    let finalRows;
    try {
      finalRows = applyDecisions(matched, decisions);
    } catch (err) {
      if (err instanceof DecisionError) {
        res.status(422).json({ data: null, error: { code: 'INVALID_DECISION', message: err.message } });
        return;
      }
      throw err;
    }

    // A matched id must belong to this client — a forged id would move a balance onto another client's account.
    const validAccountIds = new Set(existingCoa.map((c) => c.id));
    const badId = finalRows.find((r) => r.action === 'match' && !validAccountIds.has(r.matchedAccountId!));
    if (badId) {
      res.status(422).json({ data: null, error: { code: 'INVALID_ACCOUNT_ID', message: `Account ${badId.matchedAccountId} does not belong to this client.` } });
      return;
    }
    const existingByNumber = new Map(existingCoa.map((c) => [c.account_number, c]));
    const seenNew = new Set<string>();
    for (const r of finalRows) {
      if (r.action !== 'create_new') continue;
      const num = r.newAccountNumber!;
      if (seenNew.has(num)) {
        res.status(422).json({ data: null, error: { code: 'DUPLICATE_ACCOUNT_NUMBER', message: `Account number ${num} is used by more than one new account.` } });
        return;
      }
      seenNew.add(num);
    }
    // Two rows pointed at the same existing account would silently overwrite each other's balance.
    const seenMatch = new Set<number>();
    for (const r of finalRows) {
      if (r.action !== 'match') continue;
      if (seenMatch.has(r.matchedAccountId!)) {
        const acct = existingCoa.find((c) => c.id === r.matchedAccountId);
        res.status(422).json({
          data: null,
          error: { code: 'DUPLICATE_MATCH', message: `More than one QuickBooks account is matched to ${acct?.account_number ?? r.matchedAccountId}.` },
        });
        return;
      }
      seenMatch.add(r.matchedAccountId!);
    }

    const leadSheets = (await db('lead_sheets').where({ client_id: clientId }).select('id', 'code')) as Array<{ id: number; code: string | null }>;
    const leadSheetByCode = new Map<string, number>(
      leadSheets.filter((s) => !!s.code).map((s) => [s.code!.trim().toUpperCase(), s.id]),
    );

    const target: ImportTarget = stored.target ?? 'current';
    const stats = { accountsMatched: 0, accountsCreated: 0, rowsImported: 0, rowsSkipped: 0, accountsZeroed: 0, qboIdsLinked: 0 };

    await db.transaction(async (trx) => {
      await trx.raw('SELECT id FROM periods WHERE id = ? FOR UPDATE', [periodId]);
      await assertPeriodUnlocked(periodId, trx);

      const upsertCurrent = async (accountId: number, debit: number, credit: number): Promise<void> => {
        await trx('trial_balance')
          .insert({
            period_id: periodId,
            account_id: accountId,
            unadjusted_debit: debit,
            unadjusted_credit: credit,
            updated_by: req.user!.userId,
            updated_at: trx.fn.now(),
          })
          .onConflict(['period_id', 'account_id'])
          .merge(['unadjusted_debit', 'unadjusted_credit', 'updated_by', 'updated_at']);
      };
      // Same shape as /py-comparison/confirm-csv: the upload REPLACES the period's PY data.
      const pySourceFilename = `${stored.companyName} ${stored.params.start_date} – ${stored.params.end_date} (${stored.accountingMethod})`.slice(0, 255);
      const upsertPrior = async (accountId: number, debit: number, credit: number): Promise<void> => {
        await trx('py_comparison_data')
          .insert({
            period_id: periodId,
            account_id: accountId,
            py_debit: debit,
            py_credit: credit,
            source: 'qbo',
            source_filename: pySourceFilename,
            uploaded_at: trx.fn.now(),
            uploaded_by: req.user!.userId,
          })
          .onConflict(['period_id', 'account_id'])
          .merge(['py_debit', 'py_credit', 'source', 'source_filename', 'uploaded_at', 'uploaded_by']);
      };
      const upsertTb = target === 'prior' ? upsertPrior : upsertCurrent;
      if (target === 'prior') await trx('py_comparison_data').where({ period_id: periodId }).del();

      const stampQboId = async (accountId: number, qboId: string | null): Promise<void> => {
        if (!qboId) return;
        // The user may have re-pointed a QBO account at a different COA row; the
        // old holder loses the link so the partial unique index is never tripped.
        await trx('chart_of_accounts').where({ client_id: clientId, qbo_account_id: qboId }).whereNot('id', accountId).update({ qbo_account_id: null });
        const changed = await trx('chart_of_accounts')
          .where({ id: accountId })
          .andWhere((q) => q.whereNull('qbo_account_id').orWhereNot('qbo_account_id', qboId))
          .update({ qbo_account_id: qboId });
        if (changed) stats.qboIdsLinked++;
      };

      const touched = new Set<number>();
      for (const r of finalRows) {
        if (r.action === 'skip') {
          stats.rowsSkipped++;
          continue;
        }
        let accountId: number;
        if (r.action === 'match') {
          accountId = r.matchedAccountId!;
          stats.accountsMatched++;
        } else {
          const number = r.newAccountNumber!.replace(/[^a-zA-Z0-9.\-]/g, '').slice(0, 20) || `QB${(r.qboAccountId ?? r.rowKey).replace(/[^0-9]/g, '')}`.slice(0, 20);
          const existing = existingByNumber.get(number);
          if (existing) {
            // Number already on the books (e.g. the number was retyped to an existing one): treat as a match.
            accountId = existing.id;
            stats.accountsMatched++;
          } else {
            const category = r.newCategory ?? inferAccountType(number, r.newAccountName ?? '').category;
            const normalBalance = r.newNormalBalance ?? inferAccountType(number, r.newAccountName ?? '').normalBalance;
            const hit = suggestLeadSheet({ category, subcategory: null, accountNumber: number, accountName: r.newAccountName ?? '' });
            const leadSheetId = hit ? leadSheetByCode.get(hit.code.toUpperCase()) ?? null : null;
            const [created] = (await trx('chart_of_accounts')
              .insert({
                client_id: clientId,
                account_number: number,
                account_name: (r.newAccountName ?? r.qboFullName).slice(0, 255),
                category,
                normal_balance: normalBalance,
                is_active: true,
                qbo_account_id: r.qboAccountId,
                lead_sheet_id: leadSheetId,
                lead_sheet_source: leadSheetId ? 'auto' : null,
              })
              .returning('id')) as Array<{ id: number }>;
            accountId = created.id;
            existingByNumber.set(number, { id: accountId, account_number: number, account_name: r.newAccountName ?? '', qbo_account_id: r.qboAccountId });
            stats.accountsCreated++;
            if (r.qboAccountId) stats.qboIdsLinked++;
          }
        }
        if (r.action === 'match' || existingByNumber.get(r.newAccountNumber ?? '')?.id === accountId) {
          await stampQboId(accountId, r.qboAccountId);
        }
        await upsertTb(accountId, r.debitCents, r.creditCents);
        touched.add(accountId);
        stats.rowsImported++;
      }

      if (zeroAbsent && target === 'current') {
        const tbRows = (await trx('trial_balance as tb')
          .join('chart_of_accounts as coa', 'coa.id', 'tb.account_id')
          .where({ 'tb.period_id': periodId })
          .select('tb.account_id', 'coa.account_number', 'coa.account_name', 'tb.unadjusted_debit', 'tb.unadjusted_credit')) as Array<{
          account_id: number;
          account_number: string;
          account_name: string;
          unadjusted_debit: string | number;
          unadjusted_credit: string | number;
        }>;
        for (const a of findAbsentNonzeroAccounts(tbRows, touched)) {
          await upsertTb(a.accountId, 0, 0);
          stats.accountsZeroed++;
        }
      }

      const result = { ...stats, confirmedAt: new Date().toISOString(), confirmedBy: req.user!.userId, zeroAbsent };
      await trx('document_imports')
        .where({ id: importId })
        .update({
          status: 'confirmed',
          ai_extraction: JSON.stringify({ ...stored, decisions, result }),
          imported_by: req.user!.userId,
          imported_at: trx.fn.now(),
        });
      await trx('qbo_connections').where({ id: conn.id }).update({ last_import_at: trx.fn.now(), updated_at: trx.fn.now() });

      await logAudit(
        target === 'prior'
          ? {
              userId: req.user!.userId,
              periodId,
              clientId,
              entityType: 'py_comparison',
              entityId: periodId,
              action: 'create',
              description: `Imported PY comparison from QuickBooks "${stored.companyName}" (${stored.params.start_date} – ${stored.params.end_date}, ${stored.accountingMethod}) — ${stats.rowsImported} accounts, ${stats.accountsCreated} new accounts`,
            }
          : {
              userId: req.user!.userId,
              periodId,
              clientId,
              entityType: 'document_import',
              entityId: importId,
              action: 'import',
              description: `QuickBooks trial balance imported from "${stored.companyName}" (${stored.params.start_date} – ${stored.params.end_date}, ${stored.accountingMethod}): ${stats.rowsImported} rows, ${stats.accountsCreated} new accounts, ${stats.accountsZeroed} zeroed`,
            },
        trx,
      );
    });

    res.json({
      data: {
        ...stats,
        target,
        accountsWithoutTaxCodes: stats.accountsCreated,
        total: stats.rowsImported + stats.rowsSkipped,
      },
      error: null,
    });
  } catch (err: unknown) {
    const e = err as { code?: string; message?: string };
    if (e.code === 'PERIOD_LOCKED') {
      res.status(409).json({ data: null, error: { code: 'PERIOD_LOCKED', message: e.message ?? 'Period is locked' } });
      return;
    }
    if (respondQboError(res, err)) return;
    sendServerError(res, err, 'qbo-import confirm');
  }
});
