import { Router, Response } from 'express';
import { db } from '../db';
import { authMiddleware, AuthRequest } from '../middleware/auth';

export const dashboardRouter = Router({ mergeParams: true });
dashboardRouter.use(authMiddleware);

// GET /api/v1/periods/:periodId/dashboard
dashboardRouter.get('/', async (req: AuthRequest, res: Response): Promise<void> => {
  const periodId = Number(req.params.periodId);
  if (isNaN(periodId)) {
    res.status(400).json({ data: null, error: { code: 'INVALID_ID', message: 'Invalid period ID' } });
    return;
  }

  try {
    // Period info (including lock status + locker name)
    const period = await db('periods')
      .leftJoin('app_users as locker', 'locker.id', 'periods.locked_by')
      .leftJoin('clients', 'clients.id', 'periods.client_id')
      .where('periods.id', periodId)
      .first(
        'periods.*',
        'locker.display_name as locked_by_name',
        'clients.name as client_name',
      );

    if (!period) {
      res.status(404).json({ data: null, error: { code: 'NOT_FOUND', message: 'Period not found' } });
      return;
    }

    // JE counts by type
    const jeCounts = await db('journal_entries')
      .where({ period_id: periodId })
      .groupBy('entry_type')
      .select('entry_type')
      .count('* as count') as { entry_type: string; count: string | number }[];

    const jeByType: Record<string, number> = {};
    for (const r of jeCounts) jeByType[r.entry_type] = Number(r.count);

    // Bank transaction counts by status
    const btCounts = await db('bank_transactions')
      .where({ client_id: period.client_id, period_id: periodId })
      .groupBy('classification_status')
      .select('classification_status')
      .count('* as count') as { classification_status: string; count: string | number }[];

    const btByStatus: Record<string, number> = {};
    for (const r of btCounts) btByStatus[r.classification_status] = Number(r.count);

    // TB balance check — do total adjusted debits = total adjusted credits?
    const tbCheck = await db('v_adjusted_trial_balance')
      .where({ period_id: periodId })
      .sum('book_adjusted_debit as total_debit')
      .sum('book_adjusted_credit as total_credit')
      .first();

    const totalDebit = Number(tbCheck?.total_debit ?? 0);
    const totalCredit = Number(tbCheck?.total_credit ?? 0);
    const isBalanced = totalDebit === totalCredit;

    // Recent audit log (last 25)
    const auditLog = await db('audit_log')
      .leftJoin('app_users', 'app_users.id', 'audit_log.user_id')
      .where('audit_log.period_id', periodId)
      .orderBy('audit_log.created_at', 'desc')
      .limit(25)
      .select(
        'audit_log.id',
        'audit_log.entity_type',
        'audit_log.entity_id',
        'audit_log.action',
        'audit_log.description',
        'audit_log.created_at',
        'app_users.display_name as user_name',
      );

    res.json({
      data: {
        period,
        stats: {
          je: {
            book: jeByType['book'] ?? 0,
            tax: jeByType['tax'] ?? 0,
            trans: jeByType['trans'] ?? 0,
          },
          bank_transactions: {
            unclassified: btByStatus['unclassified'] ?? 0,
            classified: btByStatus['classified'] ?? 0,
            confirmed: btByStatus['confirmed'] ?? 0,
            manual: btByStatus['manual'] ?? 0,
          },
          trial_balance: {
            total_debit: totalDebit,
            total_credit: totalCredit,
            is_balanced: isBalanced,
          },
        },
        audit_log: auditLog,
      },
      error: null,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ data: null, error: { code: 'SERVER_ERROR', message } });
  }
});

// GET /api/v1/periods/:periodId/audit-log  (full log, paginated)
dashboardRouter.get('/audit-log', async (req: AuthRequest, res: Response): Promise<void> => {
  const periodId = Number(req.params.periodId);
  if (isNaN(periodId)) {
    res.status(400).json({ data: null, error: { code: 'INVALID_ID', message: 'Invalid period ID' } });
    return;
  }
  const limit = Math.min(Number(req.query.limit) || 50, 200);
  const offset = Number(req.query.offset) || 0;

  try {
    const rows = await db('audit_log')
      .leftJoin('app_users', 'app_users.id', 'audit_log.user_id')
      .where('audit_log.period_id', periodId)
      .orderBy('audit_log.created_at', 'desc')
      .limit(limit)
      .offset(offset)
      .select(
        'audit_log.*',
        'app_users.display_name as user_name',
      );

    const [{ count }] = await db('audit_log').where({ period_id: periodId }).count('* as count');
    res.json({ data: rows, error: null, meta: { total: Number(count), limit, offset } });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ data: null, error: { code: 'SERVER_ERROR', message } });
  }
});
