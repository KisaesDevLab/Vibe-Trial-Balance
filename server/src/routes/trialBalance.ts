import { Router, Response } from 'express';
import { z } from 'zod';
import { db } from '../db';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { assertPeriodUnlocked } from '../lib/periodGuard';

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
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ data: null, error: { code: 'SERVER_ERROR', message } });
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
    await assertPeriodUnlocked(periodId);
    const period = await db('periods').where({ id: periodId }).first('client_id');
    if (!period) {
      res.status(404).json({ data: null, error: { code: 'NOT_FOUND', message: 'Period not found' } });
      return;
    }
    const accounts = await db('chart_of_accounts')
      .where({ client_id: period.client_id, is_active: true })
      .select('id');

    if (accounts.length === 0) {
      res.json({ data: { initialized: 0 }, error: null });
      return;
    }

    const existing = await db('trial_balance')
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
      await db('trial_balance').insert(toInsert);
    }

    // Remove zero-balance rows for accounts now inactive in COA
    const inactiveIds = await db('chart_of_accounts')
      .where({ client_id: period.client_id, is_active: false })
      .pluck('id');
    let removed = 0;
    if (inactiveIds.length > 0) {
      removed = await db('trial_balance')
        .where({ period_id: periodId })
        .whereIn('account_id', inactiveIds.map(Number))
        .where({ unadjusted_debit: 0, unadjusted_credit: 0 })
        .delete();
    }

    res.json({ data: { initialized: toInsert.length, removed }, error: null });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ data: null, error: { code: 'SERVER_ERROR', message } });
  }
});

// POST /api/v1/periods/:periodId/trial-balance/import
// Bulk upsert unadjusted balances matched by account_number
const importRowSchema = z.object({
  accountNumber: z.string().min(1),
  debit: z.number().int().min(0),
  credit: z.number().int().min(0),
});
const importSchema = z.object({ rows: z.array(importRowSchema).min(1) });

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
    await assertPeriodUnlocked(periodId);
    const period = await db('periods').where({ id: periodId }).first('client_id');
    if (!period) {
      res.status(404).json({ data: null, error: { code: 'NOT_FOUND', message: 'Period not found' } });
      return;
    }
    const accounts = await db('chart_of_accounts')
      .where({ client_id: period.client_id, is_active: true })
      .select('id', 'account_number');
    const accountMap = new Map<string, number>(accounts.map((a: { id: number; account_number: string }) => [a.account_number, a.id]));

    let upserted = 0;
    let skipped = 0;
    await db.transaction(async (trx) => {
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
            updated_at: db.fn.now(),
          })
          .onConflict(['period_id', 'account_id'])
          .merge(['unadjusted_debit', 'unadjusted_credit', 'updated_by', 'updated_at']);
        upserted++;
      }
    });
    res.json({ data: { upserted, skipped, total: result.data.rows.length }, error: null });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ data: null, error: { code: 'SERVER_ERROR', message } });
  }
});

// POST /api/v1/periods/:periodId/trial-balance/import-prior-year
const priorYearRowSchema = z.object({
  accountNumber: z.string().min(1),
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
    await assertPeriodUnlocked(periodId);
    const period = await db('periods').where({ id: periodId }).first('client_id');
    if (!period) {
      res.status(404).json({ data: null, error: { code: 'NOT_FOUND', message: 'Period not found' } });
      return;
    }
    const accounts = await db('chart_of_accounts')
      .where({ client_id: period.client_id, is_active: true })
      .select('id', 'account_number');
    const accountMap = new Map<string, number>(accounts.map((a: { id: number; account_number: string }) => [a.account_number, a.id]));

    let upserted = 0;
    let skipped = 0;
    await db.transaction(async (trx) => {
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
            updated_at: db.fn.now(),
          })
          .onConflict(['period_id', 'account_id'])
          .merge(['prior_year_debit', 'prior_year_credit', 'updated_by', 'updated_at']);
        upserted++;
      }
    });
    res.json({ data: { upserted, skipped, total: result.data.rows.length }, error: null });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ data: null, error: { code: 'SERVER_ERROR', message } });
  }
});

// PUT /api/v1/periods/:periodId/trial-balance/:accountId
const balanceSchema = z.object({
  unadjustedDebit: z.number().int().min(0),
  unadjustedCredit: z.number().int().min(0),
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
  const { unadjustedDebit, unadjustedCredit } = result.data;

  try {
    await assertPeriodUnlocked(periodId);
    await db('trial_balance')
      .insert({
        period_id: periodId,
        account_id: accountId,
        unadjusted_debit: unadjustedDebit,
        unadjusted_credit: unadjustedCredit,
        updated_by: req.user!.userId,
        updated_at: db.fn.now(),
      })
      .onConflict(['period_id', 'account_id'])
      .merge(['unadjusted_debit', 'unadjusted_credit', 'updated_by', 'updated_at']);

    res.json({ data: { periodId, accountId, unadjustedDebit, unadjustedCredit }, error: null });
  } catch (err: unknown) {
    const e = err as { code?: string; status?: number; message?: string };
    if (e.code === 'PERIOD_LOCKED') {
      res.status(409).json({ data: null, error: { code: 'PERIOD_LOCKED', message: e.message ?? 'Period is locked' } });
      return;
    }
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ data: null, error: { code: 'SERVER_ERROR', message } });
  }
});
