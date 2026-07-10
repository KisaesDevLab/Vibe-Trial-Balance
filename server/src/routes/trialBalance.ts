// Copyright 2025-2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Use is limited to qualifying small businesses. See LICENSE for terms.

import { Router, Response } from 'express';
import { z } from 'zod';
import { db } from '../db';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { assertPeriodUnlocked, logAudit } from '../lib/periodGuard';
import { sendServerError } from '../lib/safeError';

export const tbPeriodRouter = Router({ mergeParams: true });
tbPeriodRouter.use(authMiddleware);

// Convert bigint strings from pg to numbers
function parseBigInts(row: Record<string, unknown>): Record<string, unknown> {
  const bigintFields = [
    'unadjusted_debit', 'unadjusted_credit',
    'prior_year_debit', 'prior_year_credit',
    'trans_adj_debit', 'trans_adj_credit',
    'post_trans_debit', 'post_trans_credit',
    'book_adj_debit', 'book_adj_credit',
    'tax_adj_debit', 'tax_adj_credit',
    'book_adjusted_debit', 'book_adjusted_credit',
    'tax_adjusted_debit', 'tax_adjusted_credit',
  ];
  const out = { ...row };
  for (const f of bigintFields) {
    if (out[f] !== undefined && out[f] !== null) {
      out[f] = Number(out[f]);
    }
  }
  return out;
}

// GET /api/v1/periods/:periodId/trial-balance
tbPeriodRouter.get('/', async (req: AuthRequest, res: Response): Promise<void> => {
  const periodId = Number(req.params.periodId);
  if (isNaN(periodId)) {
    res.status(400).json({ data: null, error: { code: 'INVALID_ID', message: 'Invalid period ID' } });
    return;
  }
  try {
    const rows = await db('v_adjusted_trial_balance')
      .where({ period_id: periodId, is_active: true })
      .orderBy('account_number', 'asc');
    res.json({ data: rows.map(parseBigInts), error: null, meta: { count: rows.length } });
  } catch (err: unknown) {
    sendServerError(res, err, 'trial-balance');
  }
});

// POST /api/v1/periods/:periodId/trial-balance/initialize
// Creates 0-balance rows for all active COA accounts not yet in trial_balance
tbPeriodRouter.post('/initialize', async (req: AuthRequest, res: Response): Promise<void> => {
  const periodId = Number(req.params.periodId);
  if (isNaN(periodId)) {
    res.status(400).json({ data: null, error: { code: 'INVALID_ID', message: 'Invalid period ID' } });
    return;
  }
  try {
    let initialized = 0;
    let removed = 0;
    let notFound = false;
    await db.transaction(async (trx) => {
      // Lock the period row for the duration of the transaction so that a
      // concurrent lock attempt can't slip in between the assert and the write.
      await trx.raw('SELECT id FROM periods WHERE id = ? FOR UPDATE', [periodId]);
      await assertPeriodUnlocked(periodId, trx);
      const period = await trx('periods').where({ id: periodId }).first('client_id');
      if (!period) {
        notFound = true;
        return;
      }
      const accounts = await trx('chart_of_accounts')
        .where({ client_id: period.client_id, is_active: true })
        .select('id');

      if (accounts.length === 0) return;

      const existing = await trx('trial_balance')
        .where({ period_id: periodId })
        .pluck('account_id');
      const existingSet = new Set(existing.map(Number));

      const toInsert = accounts
        .filter((a: { id: number }) => !existingSet.has(a.id))
        .map((a: { id: number }) => ({
          period_id: periodId,
          account_id: a.id,
          unadjusted_debit: 0,
          unadjusted_credit: 0,
          updated_by: req.user!.userId,
        }));

      if (toInsert.length > 0) {
        await trx('trial_balance')
          .insert(toInsert)
          .onConflict(['period_id', 'account_id'])
          .ignore();
        initialized = toInsert.length;
      }

      // Remove zero-balance rows for accounts now inactive in COA
      const inactiveIds = await trx('chart_of_accounts')
        .where({ client_id: period.client_id, is_active: false })
        .pluck('id');
      if (inactiveIds.length > 0) {
        removed = await trx('trial_balance')
          .where({ period_id: periodId })
          .whereIn('account_id', inactiveIds.map(Number))
          .where({ unadjusted_debit: 0, unadjusted_credit: 0 })
          .delete();
      }

      await logAudit({ userId: req.user!.userId, periodId, entityType: 'trial_balance', entityId: periodId, action: 'create', description: `Initialized TB from COA — ${initialized} rows created, ${removed} inactive removed` }, trx);
    });
    if (notFound) {
      res.status(404).json({ data: null, error: { code: 'NOT_FOUND', message: 'Period not found' } });
      return;
    }
    res.json({ data: { initialized, removed }, error: null });
  } catch (err: unknown) {
    const e = err as { code?: string; message?: string };
    if (e.code === 'PERIOD_LOCKED') {
      res.status(409).json({ data: null, error: { code: 'PERIOD_LOCKED', message: e.message ?? 'Period is locked' } });
      return;
    }
    sendServerError(res, err, 'trial-balance');
  }
});

// POST /api/v1/periods/:periodId/trial-balance/import
// Bulk upsert unadjusted balances matched by account_number
const importRowSchema = z.object({
  accountNumber: z.string().min(1),
  accountName: z.string().optional(),
  debit: z.number().int().min(0),
  credit: z.number().int().min(0),
});
const importSchema = z.object({ rows: z.array(importRowSchema).min(1) });

function parseAliases(val: unknown): string[] {
  if (Array.isArray(val)) return val as string[];
  if (typeof val === 'string') { try { return JSON.parse(val); } catch { return []; } }
  return [];
}

tbPeriodRouter.post('/import', async (req: AuthRequest, res: Response): Promise<void> => {
  const periodId = Number(req.params.periodId);
  if (isNaN(periodId)) {
    res.status(400).json({ data: null, error: { code: 'INVALID_ID', message: 'Invalid period ID' } });
    return;
  }
  const result = importSchema.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({ data: null, error: { code: 'VALIDATION_ERROR', message: result.error.message } });
    return;
  }
  try {
    let upserted = 0;
    let skipped = 0;
    let notFound = false;
    await db.transaction(async (trx) => {
      await trx.raw('SELECT id FROM periods WHERE id = ? FOR UPDATE', [periodId]);
      await assertPeriodUnlocked(periodId, trx);
      const period = await trx('periods').where({ id: periodId }).first('client_id');
      if (!period) {
        notFound = true;
        return;
      }
      const accounts = await trx('chart_of_accounts')
        .where({ client_id: period.client_id, is_active: true })
        .select('id', 'account_number');
      const accountMap = new Map<string, number>(accounts.map((a: { id: number; account_number: string }) => [a.account_number, a.id]));

      const aliasUpdates: Array<{ accountId: number; importName: string }> = [];
      for (const row of result.data.rows) {
        const accountId = accountMap.get(row.accountNumber);
        if (!accountId) { skipped++; continue; }
        await trx('trial_balance')
          .insert({
            period_id: periodId,
            account_id: accountId,
            unadjusted_debit: row.debit,
            unadjusted_credit: row.credit,
            updated_by: req.user!.userId,
            updated_at: trx.fn.now(),
          })
          .onConflict(['period_id', 'account_id'])
          .merge(['unadjusted_debit', 'unadjusted_credit', 'updated_by', 'updated_at']);
        upserted++;
        if (row.accountName?.trim()) {
          aliasUpdates.push({ accountId, importName: row.accountName.trim() });
        }
      }

      // Store imported account names as aliases for future matching
      if (aliasUpdates.length > 0) {
        const uniqueIds = [...new Set(aliasUpdates.map((u) => u.accountId))];
        const currentAliasData = await trx('chart_of_accounts')
          .whereIn('id', uniqueIds)
          .select('id', 'account_name', 'import_aliases');
        const aliasMap = new Map(currentAliasData.map((a: { id: number; account_name: string; import_aliases: unknown }) => [
          a.id, { accountName: a.account_name, aliases: parseAliases(a.import_aliases) },
        ]));
        for (const { accountId, importName } of aliasUpdates) {
          const data = aliasMap.get(accountId);
          if (!data) continue;
          if (importName.toLowerCase() !== data.accountName.toLowerCase() && !data.aliases.some((a) => a.toLowerCase() === importName.toLowerCase())) {
            data.aliases.push(importName);
            await trx('chart_of_accounts')
              .where({ id: accountId })
              .update({ import_aliases: JSON.stringify(data.aliases), updated_at: trx.fn.now() });
          }
        }
      }
      await logAudit({ userId: req.user!.userId, periodId, entityType: 'trial_balance', entityId: periodId, action: 'import', description: `Imported unadjusted balances — ${upserted} upserted, ${skipped} skipped` }, trx);
    });
    if (notFound) {
      res.status(404).json({ data: null, error: { code: 'NOT_FOUND', message: 'Period not found' } });
      return;
    }
    res.json({ data: { upserted, skipped, total: result.data.rows.length }, error: null });
  } catch (err: unknown) {
    const e = err as { code?: string; message?: string };
    if (e.code === 'PERIOD_LOCKED') {
      res.status(409).json({ data: null, error: { code: 'PERIOD_LOCKED', message: e.message ?? 'Period is locked' } });
      return;
    }
    sendServerError(res, err, 'trial-balance');
  }
});

// POST /api/v1/periods/:periodId/trial-balance/import-prior-year
const priorYearRowSchema = z.object({
  accountNumber: z.string().min(1),
  accountName: z.string().optional(),
  debit: z.number().int().min(0),
  credit: z.number().int().min(0),
});
const priorYearImportSchema = z.object({ rows: z.array(priorYearRowSchema).min(1) });

tbPeriodRouter.post('/import-prior-year', async (req: AuthRequest, res: Response): Promise<void> => {
  const periodId = Number(req.params.periodId);
  if (isNaN(periodId)) {
    res.status(400).json({ data: null, error: { code: 'INVALID_ID', message: 'Invalid period ID' } });
    return;
  }
  const result = priorYearImportSchema.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({ data: null, error: { code: 'VALIDATION_ERROR', message: result.error.message } });
    return;
  }
  try {
    let upserted = 0;
    let skipped = 0;
    let notFound = false;
    await db.transaction(async (trx) => {
      await trx.raw('SELECT id FROM periods WHERE id = ? FOR UPDATE', [periodId]);
      await assertPeriodUnlocked(periodId, trx);
      const period = await trx('periods').where({ id: periodId }).first('client_id');
      if (!period) {
        notFound = true;
        return;
      }
      const accounts = await trx('chart_of_accounts')
        .where({ client_id: period.client_id, is_active: true })
        .select('id', 'account_number');
      const accountMap = new Map<string, number>(accounts.map((a: { id: number; account_number: string }) => [a.account_number, a.id]));

      const aliasUpdates: Array<{ accountId: number; importName: string }> = [];
      for (const row of result.data.rows) {
        const accountId = accountMap.get(row.accountNumber);
        if (!accountId) { skipped++; continue; }
        await trx('trial_balance')
          .insert({
            period_id: periodId,
            account_id: accountId,
            unadjusted_debit: 0,
            unadjusted_credit: 0,
            prior_year_debit: row.debit,
            prior_year_credit: row.credit,
            updated_by: req.user!.userId,
            updated_at: trx.fn.now(),
          })
          .onConflict(['period_id', 'account_id'])
          .merge(['prior_year_debit', 'prior_year_credit', 'updated_by', 'updated_at']);
        upserted++;
        if (row.accountName?.trim()) {
          aliasUpdates.push({ accountId, importName: row.accountName.trim() });
        }
      }

      // Store imported account names as aliases for future matching
      if (aliasUpdates.length > 0) {
        const uniqueIds = [...new Set(aliasUpdates.map((u) => u.accountId))];
        const currentAliasData = await trx('chart_of_accounts')
          .whereIn('id', uniqueIds)
          .select('id', 'account_name', 'import_aliases');
        const aliasMap = new Map(currentAliasData.map((a: { id: number; account_name: string; import_aliases: unknown }) => [
          a.id, { accountName: a.account_name, aliases: parseAliases(a.import_aliases) },
        ]));
        for (const { accountId, importName } of aliasUpdates) {
          const data = aliasMap.get(accountId);
          if (!data) continue;
          if (importName.toLowerCase() !== data.accountName.toLowerCase() && !data.aliases.some((a) => a.toLowerCase() === importName.toLowerCase())) {
            data.aliases.push(importName);
            await trx('chart_of_accounts')
              .where({ id: accountId })
              .update({ import_aliases: JSON.stringify(data.aliases), updated_at: trx.fn.now() });
          }
        }
      }
      await logAudit({ userId: req.user!.userId, periodId, entityType: 'trial_balance', entityId: periodId, action: 'import', description: `Imported prior year balances — ${upserted} upserted, ${skipped} skipped` }, trx);
    });
    if (notFound) {
      res.status(404).json({ data: null, error: { code: 'NOT_FOUND', message: 'Period not found' } });
      return;
    }
    res.json({ data: { upserted, skipped, total: result.data.rows.length }, error: null });
  } catch (err: unknown) {
    const e = err as { code?: string; message?: string };
    if (e.code === 'PERIOD_LOCKED') {
      res.status(409).json({ data: null, error: { code: 'PERIOD_LOCKED', message: e.message ?? 'Period is locked' } });
      return;
    }
    sendServerError(res, err, 'trial-balance');
  }
});

// PUT /api/v1/periods/:periodId/trial-balance/:accountId
const balanceSchema = z.object({
  unadjustedDebit: z.number().int().min(0),
  unadjustedCredit: z.number().int().min(0),
  // Optional: when set, the row's current updated_at must match. This is the
  // optimistic-concurrency guard that turns a silent last-write-wins into an
  // explicit 409 the client can recover from.
  expectedUpdatedAt: z.string().datetime({ offset: true }).optional(),
});

tbPeriodRouter.put('/:accountId', async (req: AuthRequest, res: Response): Promise<void> => {
  const periodId = Number(req.params.periodId);
  const accountId = Number(req.params.accountId);
  if (isNaN(periodId) || isNaN(accountId)) {
    res.status(400).json({ data: null, error: { code: 'INVALID_ID', message: 'Invalid ID' } });
    return;
  }
  const result = balanceSchema.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({ data: null, error: { code: 'VALIDATION_ERROR', message: result.error.message } });
    return;
  }
  const { unadjustedDebit, unadjustedCredit, expectedUpdatedAt } = result.data;

  try {
    let newUpdatedAt: string | null = null;
    let conflictActual: string | null = null;
    await db.transaction(async (trx) => {
      await assertPeriodUnlocked(periodId, trx);

      // Optimistic concurrency check: if the client sent an expectedUpdatedAt,
      // the row must still have that timestamp. Otherwise another user has
      // written the same cell since we loaded it and we must refuse.
      if (expectedUpdatedAt) {
        const current = await trx('trial_balance')
          .where({ period_id: periodId, account_id: accountId })
          .first('updated_at');
        if (current) {
          const actualIso = new Date(current.updated_at as string | Date).toISOString();
          const expectedIso = new Date(expectedUpdatedAt).toISOString();
          if (actualIso !== expectedIso) {
            conflictActual = actualIso;
            return;
          }
        }
        // If no row exists yet, the expectedUpdatedAt was for a row we thought
        // existed — treat that as a conflict too.
        else {
          conflictActual = '';
          return;
        }
      }

      const [row] = await trx('trial_balance')
        .insert({
          period_id: periodId,
          account_id: accountId,
          unadjusted_debit: unadjustedDebit,
          unadjusted_credit: unadjustedCredit,
          updated_by: req.user!.userId,
          updated_at: trx.fn.now(),
        })
        .onConflict(['period_id', 'account_id'])
        .merge(['unadjusted_debit', 'unadjusted_credit', 'updated_by', 'updated_at'])
        .returning('updated_at');
      newUpdatedAt = row?.updated_at ? new Date(row.updated_at as string | Date).toISOString() : null;

      await logAudit({ userId: req.user!.userId, periodId, entityType: 'trial_balance', entityId: accountId, action: 'update', description: `Updated balance — Dr: ${unadjustedDebit} Cr: ${unadjustedCredit}` }, trx);
    });

    if (conflictActual !== null) {
      res.status(409).json({
        data: null,
        error: {
          code: 'STALE_WRITE',
          message: 'This cell was changed by another user since you loaded it. Reload and re-enter your edit.',
        },
      });
      return;
    }

    res.json({ data: { periodId, accountId, unadjustedDebit, unadjustedCredit, updatedAt: newUpdatedAt }, error: null });
  } catch (err: unknown) {
    const e = err as { code?: string; status?: number; message?: string };
    if (e.code === 'PERIOD_LOCKED') {
      res.status(409).json({ data: null, error: { code: 'PERIOD_LOCKED', message: e.message ?? 'Period is locked' } });
      return;
    }
    sendServerError(res, err, 'trial-balance');
  }
});
