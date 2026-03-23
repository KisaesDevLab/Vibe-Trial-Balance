import { Router, Response } from 'express';
import { z } from 'zod';
import { db } from '../db';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { assertPeriodUnlocked } from '../lib/periodGuard';

export const comparisonRouter = Router({ mergeParams: true });
comparisonRouter.use(authMiddleware);

function netBal(dr: number, cr: number, normalBalance: string): number {
  return normalBalance === 'debit' ? dr - cr : cr - dr;
}

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

    // Fetch both periods' balances
    const [currentRows, compareRows] = await Promise.all([
      db('v_adjusted_trial_balance as vtb')
        .where('vtb.period_id', periodId)
        .where('vtb.is_active', true)
        .select(
          'vtb.account_id', 'vtb.account_number', 'vtb.account_name',
          'vtb.category', 'vtb.normal_balance',
          'vtb.book_adjusted_debit', 'vtb.book_adjusted_credit',
        )
        .orderBy('vtb.account_number', 'asc'),
      db('v_adjusted_trial_balance as vtb')
        .where('vtb.period_id', comparePeriodId)
        .where('vtb.is_active', true)
        .select('vtb.account_id', 'vtb.book_adjusted_debit', 'vtb.book_adjusted_credit'),
    ]);

    // Map compare period balances by account_id
    const compareMap = new Map<number, { dr: number; cr: number }>();
    for (const r of compareRows as Record<string, unknown>[]) {
      compareMap.set(Number(r.account_id), {
        dr: Number(r.book_adjusted_debit),
        cr: Number(r.book_adjusted_credit),
      });
    }

    // Fetch variance notes for this comparison pair
    const notes = await db('variance_notes')
      .where({ period_id: periodId, compare_period_id: comparePeriodId })
      .select('account_id', 'note');
    const notesMap = new Map<number, string>();
    for (const n of notes as Record<string, unknown>[]) notesMap.set(Number(n.account_id), String(n.note));

    // Build rows
    const rows = (currentRows as Record<string, unknown>[]).map((r) => {
      const currDr = Number(r.book_adjusted_debit);
      const currCr = Number(r.book_adjusted_credit);
      const nb     = r.normal_balance as string;
      const currentBalance = netBal(currDr, currCr, nb);

      const cmp = compareMap.get(Number(r.account_id));
      const compareBalance = cmp ? netBal(cmp.dr, cmp.cr, nb) : 0;

      const varianceAmount = currentBalance - compareBalance;
      const variancePct =
        compareBalance !== 0
          ? Math.round((varianceAmount / Math.abs(compareBalance)) * 1000) / 10
          : currentBalance !== 0 ? null : 0;

      return {
        account_id:      Number(r.account_id),
        account_number:  r.account_number as string,
        account_name:    r.account_name as string,
        category:        r.category as string,
        normal_balance:  nb,
        current_balance: currentBalance,
        compare_balance: compareBalance,
        variance_amount: varianceAmount,
        variance_pct:    variancePct,
        note:            notesMap.get(Number(r.account_id)) ?? null,
      };
    });

    res.json({ data: { period, comparePeriod, rows }, error: null });
  } catch (err: unknown) {
    res.status(500).json({ data: null, error: { code: 'SERVER_ERROR', message: (err as Error).message } });
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
    res.status(500).json({ data: null, error: { code: 'SERVER_ERROR', message: (err as Error).message } });
  }
});
