// Copyright 2025-2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Use is limited to qualifying small businesses. See LICENSE for terms.

import { Router, Response } from 'express';
import type { Knex } from 'knex';
import { z } from 'zod';
import { db } from '../db';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { logAudit } from '../lib/periodGuard';
import { sendServerError } from '../lib/safeError';

// Mounted at /api/v1/clients/:clientId/chart-of-accounts
export const coaCollectionRouter = Router({ mergeParams: true });
coaCollectionRouter.use(authMiddleware);

// Mounted at /api/v1/chart-of-accounts
export const coaItemRouter = Router();
coaItemRouter.use(authMiddleware);

const accountSchema = z.object({
  accountNumber: z.string().min(1).max(20),
  accountName: z.string().min(1).max(255),
  category: z.enum(['assets', 'liabilities', 'equity', 'revenue', 'expenses']),
  subcategory: z.string().max(100).optional(),
  normalBalance: z.enum(['debit', 'credit']),
  taxLine: z.string().max(50).optional(),
  taxCodeId: z.number().int().nullable().optional(),
  taxLineSource: z.enum(['manual', 'ai', 'import', 'rule']).optional(),
  taxLineConfidence: z.number().min(0).max(1).optional(),
  workpaperRef: z.string().max(50).optional(),
  preparerNotes: z.string().optional(),
  reviewerNotes: z.string().optional(),
  unit: z.string().max(100).optional().nullable(),
  leadSheetId: z.number().int().positive().nullable().optional(),
  cashFlowCategory: z.enum(['operating', 'investing', 'financing', 'non_cash', 'cash']).optional().nullable(),
  importAliases: z.array(z.string().max(255)).max(50).optional(),
});

/**
 * A plain FK can't stop client 1's account pointing at client 2's lead sheet,
 * so every write that takes a leadSheetId out of a request body checks it here
 * first. Same guard rollForward.ts applies to retainedEarningsAccountId.
 */
async function leadSheetBelongsToClient(
  clientId: number,
  leadSheetId: number,
  q: Knex | Knex.Transaction = db,
): Promise<boolean> {
  const row = await q('lead_sheets').where({ id: leadSheetId, client_id: clientId }).first('id');
  return !!row;
}

function parseAliases(val: unknown): string[] {
  if (Array.isArray(val)) return val as string[];
  if (typeof val === 'string') { try { return JSON.parse(val); } catch { return []; } }
  return [];
}

// GET /api/v1/clients/:clientId/chart-of-accounts
coaCollectionRouter.get('/', async (req: AuthRequest, res: Response): Promise<void> => {
  const clientId = Number(req.params.clientId);
  if (isNaN(clientId)) {
    res
      .status(400)
      .json({ data: null, error: { code: 'INVALID_ID', message: 'Invalid client ID' } });
    return;
  }

  try {
    const accounts = await db('chart_of_accounts')
      .where({ client_id: clientId, is_active: true })
      .orderBy('account_number', 'asc');
    res.json({ data: accounts, error: null, meta: { count: accounts.length } });
  } catch (err: unknown) {
    sendServerError(res, err, 'coa');
  }
});

// POST /api/v1/clients/:clientId/chart-of-accounts
coaCollectionRouter.post('/', async (req: AuthRequest, res: Response): Promise<void> => {
  const clientId = Number(req.params.clientId);
  if (isNaN(clientId)) {
    res
      .status(400)
      .json({ data: null, error: { code: 'INVALID_ID', message: 'Invalid client ID' } });
    return;
  }

  const result = accountSchema.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({
      data: null,
      error: { code: 'VALIDATION_ERROR', message: result.error.message },
    });
    return;
  }

  const {
    accountNumber,
    accountName,
    category,
    subcategory,
    normalBalance,
    taxLine,
    taxCodeId,
    taxLineSource,
    taxLineConfidence,
    workpaperRef,
    preparerNotes,
    reviewerNotes,
    unit,
    leadSheetId,
    cashFlowCategory,
  } = result.data;

  try {
    if (leadSheetId != null && !(await leadSheetBelongsToClient(clientId, leadSheetId))) {
      res.status(403).json({ data: null, error: { code: 'FORBIDDEN', message: 'That lead sheet belongs to a different client.' } });
      return;
    }

    // Dual-write: if taxCodeId supplied, look up tax_code string for backward compat
    let resolvedTaxLine = taxLine ?? null;
    if (taxCodeId != null) {
      const tc = await db('tax_codes').where({ id: taxCodeId }).first();
      if (tc) resolvedTaxLine = tc.tax_code;
    }

    const [account] = await db('chart_of_accounts')
      .insert({
        client_id: clientId,
        account_number: accountNumber,
        account_name: accountName,
        category,
        subcategory: subcategory ?? null,
        normal_balance: normalBalance,
        tax_line: resolvedTaxLine,
        tax_code_id: taxCodeId ?? null,
        tax_line_source: taxLineSource ?? null,
        tax_line_confidence: taxLineConfidence ?? null,
        workpaper_ref: workpaperRef ?? null,
        preparer_notes: preparerNotes ?? null,
        reviewer_notes: reviewerNotes ?? null,
        unit: unit ?? null,
        lead_sheet_id: leadSheetId ?? null,
        lead_sheet_source: leadSheetId != null ? 'manual' : null,
        cash_flow_category: cashFlowCategory ?? null,
        is_active: true,
      })
      .returning('*');
    await logAudit({ userId: req.user!.userId, periodId: null, entityType: 'chart_of_accounts', entityId: account.id, action: 'create', description: `Created account ${account.account_number} — ${account.account_name}` });
    res.status(201).json({ data: account, error: null });
  } catch (err: unknown) {
    const internal = err instanceof Error ? err.message : '';
    if (internal.includes('unique') || internal.includes('duplicate')) {
      res.status(409).json({
        data: null,
        error: { code: 'DUPLICATE', message: 'Account number already exists for this client' },
      });
      return;
    }
    sendServerError(res, err, 'coa');
  }
});

// POST /api/v1/clients/:clientId/chart-of-accounts/import
coaCollectionRouter.post('/import', async (req: AuthRequest, res: Response): Promise<void> => {
  const clientId = Number(req.params.clientId);
  if (isNaN(clientId)) {
    res.status(400).json({ data: null, error: { code: 'INVALID_ID', message: 'Invalid client ID' } });
    return;
  }

  // Imports carry the lead sheet as a letter code — that is what a CSV column
  // holds and what survives moving between clients — resolved per client below.
  const rowSchema = accountSchema.extend({
    leadSheetCode: z.string().max(10).nullable().optional(),
  });
  const bodySchema = z.object({ rows: z.array(rowSchema).min(1).max(2000) });
  const parsed = bodySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ data: null, error: { code: 'VALIDATION_ERROR', message: parsed.error.message } });
    return;
  }

  const { rows } = parsed.data;
  let inserted = 0;
  let updated = 0;

  try {
    // Pre-build a tax_code string → id lookup for the import batch
    const allTaxCodes = await db('tax_codes').select('id', 'tax_code');
    const taxCodeLookup = new Map<string, number>(allTaxCodes.map((tc: { id: number; tax_code: string }) => [tc.tax_code, tc.id]));

    // Case-insensitive code -> id for this client only. An unknown code imports
    // as "no lead sheet" rather than failing the row.
    const clientLeadSheets = await db('lead_sheets').where({ client_id: clientId }).select('id', 'code');
    const leadSheetLookup = new Map<string, number>(
      (clientLeadSheets as { id: number; code: string | null }[])
        .filter((l) => !!l.code)
        .map((l) => [l.code!.trim().toUpperCase(), l.id]),
    );
    const resolveLeadSheet = (code: string | null | undefined): number | null =>
      code ? (leadSheetLookup.get(code.trim().toUpperCase()) ?? null) : null;

    await db.transaction(async (trx) => {
      for (const r of rows) {
        // Resolve tax_line string to tax_code_id if possible
        const resolvedTaxCodeId = r.taxLine ? (taxCodeLookup.get(r.taxLine) ?? null) : null;
        const resolvedTaxLine = r.taxLine ?? null;
        const resolvedLeadSheetId = resolveLeadSheet(r.leadSheetCode);

        const existing = await trx('chart_of_accounts')
          .where({ client_id: clientId, account_number: r.accountNumber })
          .first('id');

        if (existing) {
          await trx('chart_of_accounts').where({ id: existing.id }).update({
            account_name: r.accountName,
            category: r.category,
            subcategory: r.subcategory ?? null,
            normal_balance: r.normalBalance,
            tax_line: resolvedTaxLine,
            tax_code_id: resolvedTaxCodeId,
            workpaper_ref: r.workpaperRef ?? null,
            unit: r.unit ?? null,
            // Only overwrite the lead sheet when the import actually supplied
            // one — a file with no such column must not unassign every account.
            ...(r.leadSheetCode !== undefined
              ? { lead_sheet_id: resolvedLeadSheetId, lead_sheet_source: 'manual' }
              : {}),
            is_active: true,
            updated_at: trx.fn.now(),
          });
          updated++;
        } else {
          await trx('chart_of_accounts').insert({
            client_id: clientId,
            account_number: r.accountNumber,
            account_name: r.accountName,
            category: r.category,
            subcategory: r.subcategory ?? null,
            normal_balance: r.normalBalance,
            tax_line: resolvedTaxLine,
            tax_code_id: resolvedTaxCodeId,
            workpaper_ref: r.workpaperRef ?? null,
            unit: r.unit ?? null,
            lead_sheet_id: resolvedLeadSheetId,
            lead_sheet_source: resolvedLeadSheetId != null ? 'manual' : null,
            is_active: true,
          });
          inserted++;
        }
      }
    });
    await logAudit({ userId: req.user!.userId, periodId: null, entityType: 'chart_of_accounts', action: 'import', description: `COA import — ${inserted} created, ${updated} updated (${rows.length} total)` });
    res.json({ data: { inserted, updated, total: rows.length }, error: null });
  } catch (err: unknown) {
    sendServerError(res, err, 'coa');
  }
});

// POST /api/v1/clients/:clientId/chart-of-accounts/copy-from/:sourceClientId
coaCollectionRouter.post('/copy-from/:sourceClientId', async (req: AuthRequest, res: Response): Promise<void> => {
  const clientId = Number(req.params.clientId);
  const sourceClientId = Number(req.params.sourceClientId);
  if (isNaN(clientId) || isNaN(sourceClientId)) {
    res.status(400).json({ data: null, error: { code: 'INVALID_ID', message: 'Invalid client ID' } });
    return;
  }
  if (clientId === sourceClientId) {
    res.status(400).json({ data: null, error: { code: 'INVALID_INPUT', message: 'Source and destination cannot be the same client.' } });
    return;
  }

  const overwrite = req.query.overwrite === 'true';
  let inserted = 0;
  let updated = 0;
  let skipped = 0;

  try {
    const sourceAccounts = await db('chart_of_accounts')
      .where({ client_id: sourceClientId, is_active: true });

    if (sourceAccounts.length === 0) {
      res.json({ data: { inserted: 0, updated: 0, skipped: 0, total: 0 }, error: null });
      return;
    }

    // Lead sheets must be remapped by CODE, never copied by id: the source
    // client's lead_sheet_id values are meaningless in the target and would
    // point across clients. An account whose code has no counterpart in the
    // target simply arrives unassigned.
    const [sourceSheets, targetSheets] = await Promise.all([
      db('lead_sheets').where({ client_id: sourceClientId }).select('id', 'code'),
      db('lead_sheets').where({ client_id: clientId }).select('id', 'code'),
    ]);
    const codeById = new Map<number, string>(
      (sourceSheets as { id: number; code: string | null }[])
        .filter((l) => !!l.code)
        .map((l) => [l.id, l.code!.trim().toUpperCase()]),
    );
    const idByCode = new Map<string, number>(
      (targetSheets as { id: number; code: string | null }[])
        .filter((l) => !!l.code)
        .map((l) => [l.code!.trim().toUpperCase(), l.id]),
    );
    const remapLeadSheet = (sourceId: number | null): number | null => {
      if (sourceId == null) return null;
      const code = codeById.get(sourceId);
      return code ? (idByCode.get(code) ?? null) : null;
    };

    await db.transaction(async (trx) => {
      for (const acct of sourceAccounts) {
        const existing = await trx('chart_of_accounts')
          .where({ client_id: clientId, account_number: acct.account_number })
          .first('id');

        if (existing) {
          if (overwrite) {
            await trx('chart_of_accounts').where({ id: existing.id }).update({
              account_name: acct.account_name,
              category: acct.category,
              subcategory: acct.subcategory,
              normal_balance: acct.normal_balance,
              tax_line: acct.tax_line,
              tax_code_id: acct.tax_code_id,
              workpaper_ref: acct.workpaper_ref,
              unit: acct.unit ?? null,
              lead_sheet_id: remapLeadSheet(acct.lead_sheet_id ?? null),
              is_active: true,
              updated_at: trx.fn.now(),
            });
            updated++;
          } else {
            skipped++;
          }
        } else {
          await trx('chart_of_accounts').insert({
            client_id: clientId,
            account_number: acct.account_number,
            account_name: acct.account_name,
            category: acct.category,
            subcategory: acct.subcategory,
            normal_balance: acct.normal_balance,
            tax_line: acct.tax_line,
            tax_code_id: acct.tax_code_id,
            workpaper_ref: acct.workpaper_ref,
            unit: acct.unit ?? null,
            lead_sheet_id: remapLeadSheet(acct.lead_sheet_id ?? null),
            lead_sheet_source: acct.lead_sheet_source ?? null,
            is_active: true,
          });
          inserted++;
        }
      }
    });

    res.json({ data: { inserted, updated, skipped, total: sourceAccounts.length }, error: null });
  } catch (err: unknown) {
    sendServerError(res, err, 'coa');
  }
});

// GET /api/v1/chart-of-accounts/:id
coaItemRouter.get('/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  const id = Number(req.params.id);
  if (isNaN(id)) {
    res
      .status(400)
      .json({ data: null, error: { code: 'INVALID_ID', message: 'Invalid account ID' } });
    return;
  }

  try {
    const account = await db('chart_of_accounts').where({ id }).first();
    if (!account) {
      res
        .status(404)
        .json({ data: null, error: { code: 'NOT_FOUND', message: 'Account not found' } });
      return;
    }
    res.json({ data: account, error: null });
  } catch (err: unknown) {
    sendServerError(res, err, 'coa');
  }
});

// PATCH /api/v1/chart-of-accounts/:id
coaItemRouter.patch('/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  const id = Number(req.params.id);
  if (isNaN(id)) {
    res
      .status(400)
      .json({ data: null, error: { code: 'INVALID_ID', message: 'Invalid account ID' } });
    return;
  }

  const result = accountSchema.partial().safeParse(req.body);
  if (!result.success) {
    res.status(400).json({
      data: null,
      error: { code: 'VALIDATION_ERROR', message: result.error.message },
    });
    return;
  }

  const updates: Record<string, unknown> = { updated_at: db.fn.now() };
  const d = result.data;
  if (d.accountNumber !== undefined) updates.account_number = d.accountNumber;
  if (d.accountName !== undefined) updates.account_name = d.accountName;
  if (d.category !== undefined) updates.category = d.category;
  if (d.subcategory !== undefined) updates.subcategory = d.subcategory;
  if (d.normalBalance !== undefined) updates.normal_balance = d.normalBalance;
  if (d.taxLine !== undefined) updates.tax_line = d.taxLine;
  if (d.taxCodeId !== undefined) {
    updates.tax_code_id = d.taxCodeId;
    // Dual-write: if assigning a code, look up its string for backward compat
    if (d.taxCodeId !== null) {
      const tc = await db('tax_codes').where({ id: d.taxCodeId }).first();
      if (tc) updates.tax_line = tc.tax_code;
    } else {
      updates.tax_line = null;
    }
  }
  if (d.taxLineSource !== undefined) updates.tax_line_source = d.taxLineSource;
  if (d.taxLineConfidence !== undefined) updates.tax_line_confidence = d.taxLineConfidence;
  if (d.workpaperRef !== undefined) updates.workpaper_ref = d.workpaperRef;
  if (d.preparerNotes !== undefined) updates.preparer_notes = d.preparerNotes;
  if (d.reviewerNotes !== undefined) updates.reviewer_notes = d.reviewerNotes;
  if (d.unit               !== undefined) updates.unit               = d.unit;
  if (d.cashFlowCategory   !== undefined) updates.cash_flow_category = d.cashFlowCategory;
  if (d.leadSheetId !== undefined) {
    if (d.leadSheetId !== null) {
      // The account's own client is the authority — read it rather than
      // trusting anything in the body.
      const owner = await db('chart_of_accounts').where({ id }).first('client_id');
      if (!owner) {
        res.status(404).json({ data: null, error: { code: 'NOT_FOUND', message: 'Account not found' } });
        return;
      }
      if (!(await leadSheetBelongsToClient(owner.client_id as number, d.leadSheetId))) {
        res.status(403).json({ data: null, error: { code: 'FORBIDDEN', message: 'That lead sheet belongs to a different client.' } });
        return;
      }
    }
    updates.lead_sheet_id = d.leadSheetId;
    // A hand-set assignment is manual, and clearing it clears the provenance.
    updates.lead_sheet_source = d.leadSheetId === null ? null : 'manual';
  }

  // Handle import_aliases: auto-save old name when renaming, merge with explicit list
  if (d.accountName !== undefined || d.importAliases !== undefined) {
    const current = await db('chart_of_accounts').where({ id }).first('account_name', 'import_aliases');
    if (current) {
      // Start from explicit list if provided, else keep existing
      let aliases = d.importAliases !== undefined ? [...d.importAliases] : parseAliases(current.import_aliases);
      // Auto-save old name as alias when renaming
      if (d.accountName !== undefined && d.accountName !== current.account_name) {
        if (!aliases.includes(current.account_name)) {
          aliases.push(current.account_name);
        }
      }
      updates.import_aliases = JSON.stringify(aliases);
    }
  }

  try {
    const [updated] = await db('chart_of_accounts').where({ id }).update(updates).returning('*');
    if (!updated) {
      res
        .status(404)
        .json({ data: null, error: { code: 'NOT_FOUND', message: 'Account not found' } });
      return;
    }
    await logAudit({ userId: req.user!.userId, periodId: null, entityType: 'chart_of_accounts', entityId: id, action: 'update', description: `Updated account ${updated.account_number} — ${Object.keys(updates).join(', ')}` });
    res.json({ data: updated, error: null });
  } catch (err: unknown) {
    sendServerError(res, err, 'coa');
  }
});

// DELETE /api/v1/chart-of-accounts/:id
coaItemRouter.delete('/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  const id = Number(req.params.id);
  if (isNaN(id)) {
    res
      .status(400)
      .json({ data: null, error: { code: 'INVALID_ID', message: 'Invalid account ID' } });
    return;
  }

  try {
    // Block deactivation if the account carries ANY activity: non-zero
    // unadjusted or prior-year balances, or journal-entry lines. The TB query
    // filters on is_active, so deactivating an account with AJE activity
    // would hide one side of a balanced entry from every column total.
    const balanceRows = await db('trial_balance')
      .where({ account_id: id })
      .where(function () {
        this.whereNot({ unadjusted_debit: 0 })
          .orWhereNot({ unadjusted_credit: 0 })
          .orWhereNot({ prior_year_debit: 0 })
          .orWhereNot({ prior_year_credit: 0 });
      })
      .count('id as cnt')
      .first();
    if (Number(balanceRows?.cnt ?? 0) > 0) {
      res.status(409).json({
        data: null,
        error: { code: 'HAS_BALANCE', message: 'Cannot delete an account that has trial balance or prior-year entries. Zero out the balance first.' },
      });
      return;
    }
    const jeLines = await db('journal_entry_lines')
      .where({ account_id: id })
      .where(function () {
        this.whereNot({ debit: 0 }).orWhereNot({ credit: 0 });
      })
      .count('id as cnt')
      .first();
    if (Number(jeLines?.cnt ?? 0) > 0) {
      res.status(409).json({
        data: null,
        error: { code: 'HAS_JE_ACTIVITY', message: 'Cannot delete an account referenced by journal entries. Remove or repost those entries first.' },
      });
      return;
    }

    const [updated] = await db('chart_of_accounts')
      .where({ id })
      .update({ is_active: false, updated_at: db.fn.now() })
      .returning('id');
    if (!updated) {
      res
        .status(404)
        .json({ data: null, error: { code: 'NOT_FOUND', message: 'Account not found' } });
      return;
    }
    await logAudit({ userId: req.user!.userId, periodId: null, entityType: 'chart_of_accounts', entityId: id, action: 'delete', description: `Deactivated account #${id}` });
    res.json({ data: { id }, error: null });
  } catch (err: unknown) {
    sendServerError(res, err, 'coa');
  }
});
