// Copyright 2025-2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Use is limited to qualifying small businesses. See LICENSE for terms.

import { Router, Response } from 'express';
import { z } from 'zod';
import { db } from '../db';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { assertPeriodUnlocked } from '../lib/periodGuard';
import { sendServerError } from '../lib/safeError';
import { categoryNet } from '../lib/accounting';
import { whereHasActivity } from '../lib/tbActivity';

export const comparisonRouter = Router({ mergeParams: true });
comparisonRouter.use(authMiddleware);

// GET /api/v1/periods/:periodId/compare/:comparePeriodId
comparisonRouter.get('/', async (req: AuthRequest, res: Response): Promise<void> => {
  const periodId      = Number(req.params.periodId);
  const comparePeriodId = Number(req.params.comparePeriodId);
  if (isNaN(periodId) || isNaN(comparePeriodId)) {
    res.status(400).json({ data: null, error: { code: 'INVALID_ID', message: 'Invalid period IDs' } });
    return;
  }

  try {
    const [period, comparePeriod] = await Promise.all([
      db('periods').where({ id: periodId }).first('id', 'period_name', 'start_date', 'end_date', 'client_id'),
      db('periods').where({ id: comparePeriodId }).first('id', 'period_name', 'start_date', 'end_date', 'client_id'),
    ]);

    if (!period || !comparePeriod) {
      res.status(404).json({ data: null, error: { code: 'NOT_FOUND', message: 'Period not found' } });
      return;
    }

    if (period.client_id !== comparePeriod.client_id) {
      res.status(403).json({ data: null, error: { code: 'FORBIDDEN', message: 'Periods must belong to the same client' } });
      return;
    }

    // Fetch both periods' balances. We need FULL rows for both so accounts
    // that exist in the compare period but were deactivated in the current
    // period still appear (previously silently dropped — which broke
    // year-over-year expense totals when a closed-out account disappeared).
    const [currentRows, compareRows] = await Promise.all([
      db('v_adjusted_trial_balance as vtb')
        .where('vtb.period_id', periodId)
        .modify(whereHasActivity, 'vtb')
        .select(
          'vtb.account_id', 'vtb.account_number', 'vtb.account_name',
          'vtb.category', 'vtb.normal_balance', 'vtb.is_active',
          'vtb.book_adjusted_debit', 'vtb.book_adjusted_credit',
        )
        .orderBy('vtb.account_number', 'asc'),
      db('v_adjusted_trial_balance as vtb')
        .where('vtb.period_id', comparePeriodId)
        .modify(whereHasActivity, 'vtb')
        .select(
          'vtb.account_id', 'vtb.account_number', 'vtb.account_name',
          'vtb.category', 'vtb.normal_balance', 'vtb.is_active',
          'vtb.book_adjusted_debit', 'vtb.book_adjusted_credit',
        ),
    ]);

    type Row = Record<string, unknown>;

    // Index both periods by account_id. Union the key sets so every account
    // in either period appears in the output.
    const currentMap = new Map<number, Row>();
    for (const r of currentRows as Row[]) currentMap.set(Number(r.account_id), r);
    const compareMap = new Map<number, Row>();
    for (const r of compareRows as Row[]) compareMap.set(Number(r.account_id), r);

    // Fetch variance notes for this comparison pair
    const notes = await db('variance_notes')
      .where({ period_id: periodId, compare_period_id: comparePeriodId })
      .select('account_id', 'note');
    const notesMap = new Map<number, string>();
    for (const n of notes as Row[]) notesMap.set(Number(n.account_id), String(n.note));

    // Walk union, preferring the current-period row for metadata; fall back
    // to compare-period metadata for deactivated/removed accounts.
    const allAccountIds = new Set<number>([
      ...Array.from(currentMap.keys()),
      ...Array.from(compareMap.keys()),
    ]);

    const rows = Array.from(allAccountIds).map((accountId) => {
      const cur = currentMap.get(accountId);
      const cmp = compareMap.get(accountId);
      const meta = cur ?? cmp!;
      const nb = String(meta.normal_balance);
      // Balances are signed by CATEGORY (not per-account normal_balance) so
      // contra accounts come out negative and category subtotals downstream
      // net correctly (e.g. Accumulated Depreciation reduces Total Assets).
      const cat = String(meta.category);

      const currentBalance = cur
        ? categoryNet(cat, Number(cur.book_adjusted_debit), Number(cur.book_adjusted_credit))
        : 0;
      const compareBalance = cmp
        ? categoryNet(cat, Number(cmp.book_adjusted_debit), Number(cmp.book_adjusted_credit))
        : 0;

      const varianceAmount = currentBalance - compareBalance;
      // Variance %: null when we can't compute a meaningful rate (prior is
      // zero). `0` when both sides are zero (no movement). Clients render
      // null as "N/A" or "New"/"Closed" as appropriate.
      let variancePct: number | null;
      if (compareBalance !== 0) {
        variancePct = Math.round((varianceAmount / Math.abs(compareBalance)) * 1000) / 10;
      } else if (currentBalance === 0) {
        variancePct = 0;
      } else {
        variancePct = null;
      }

      return {
        account_id:      accountId,
        account_number:  String(meta.account_number),
        account_name:    String(meta.account_name),
        category:        String(meta.category),
        normal_balance:  nb,
        is_active:       Boolean(meta.is_active),
        in_current:      !!cur,
        in_compare:      !!cmp,
        current_balance: currentBalance,
        compare_balance: compareBalance,
        variance_amount: varianceAmount,
        variance_pct:    variancePct,
        note:            notesMap.get(accountId) ?? null,
      };
    })
    // Stable sort by account number for consistent rendering. `numeric: true`
    // makes "200" sort before "1000" instead of the lexical "1000" < "200".
    .sort((a, b) => a.account_number.localeCompare(b.account_number, undefined, { numeric: true }));

    res.json({ data: { period, comparePeriod, rows }, error: null });
  } catch (err: unknown) {
    sendServerError(res, err, 'comparison');
  }
});

// PUT /api/v1/periods/:periodId/compare/:comparePeriodId/variance-notes/:accountId
comparisonRouter.put('/variance-notes/:accountId', async (req: AuthRequest, res: Response): Promise<void> => {
  const periodId        = Number(req.params.periodId);
  const comparePeriodId = Number(req.params.comparePeriodId);
  const accountId       = Number(req.params.accountId);
  if (isNaN(periodId) || isNaN(comparePeriodId) || isNaN(accountId)) {
    res.status(400).json({ data: null, error: { code: 'INVALID_ID', message: 'Invalid IDs' } });
    return;
  }

  const schema = z.object({ note: z.string().max(2000) });
  const result = schema.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({ data: null, error: { code: 'VALIDATION_ERROR', message: result.error.message } });
    return;
  }

  try {
    await assertPeriodUnlocked(periodId);

    if (!result.data.note.trim()) {
      await db('variance_notes')
        .where({ period_id: periodId, account_id: accountId, compare_period_id: comparePeriodId })
        .delete();
      res.json({ data: { deleted: true }, error: null });
      return;
    }

    const [row] = await db('variance_notes')
      .insert({
        period_id:         periodId,
        account_id:        accountId,
        compare_period_id: comparePeriodId,
        note:              result.data.note.trim(),
        created_by:        req.user!.userId,
      })
      .onConflict(['period_id', 'account_id', 'compare_period_id'])
      .merge({ note: result.data.note.trim() })
      .returning('*');

    res.json({ data: row, error: null });
  } catch (err: unknown) {
    const e = err as { code?: string; message?: string };
    if (e.code === 'PERIOD_LOCKED') {
      res.status(409).json({ data: null, error: { code: 'PERIOD_LOCKED', message: e.message ?? 'Period is locked' } });
      return;
    }
    sendServerError(res, err, 'comparison');
  }
});
