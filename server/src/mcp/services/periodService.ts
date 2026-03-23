import { db } from '../../db';
import { logAudit } from '../../lib/periodGuard';

export interface Period {
  id: number;
  client_id: number;
  period_name: string;
  start_date: string | null;
  end_date: string | null;
  is_current: boolean;
  locked_at: string | null;
  locked_by: number | null;
  created_at: string;
}

export async function getPeriods(clientId: number): Promise<Period[]> {
  return db('periods').where({ client_id: clientId }).orderBy('end_date', 'desc');
}

export async function getPeriod(id: number): Promise<Period | undefined> {
  return db('periods').where({ id }).first('*');
}

export async function lockPeriod(id: number, userId: number): Promise<{ period: Period; error?: string }> {
  // Check TB balanced
  const tbRows = await db('v_adjusted_trial_balance').where({ period_id: id });
  if (tbRows.length > 0) {
    const bkDr = tbRows.reduce((s: number, r: Record<string, unknown>) => s + Number(r.book_adjusted_debit), 0);
    const bkCr = tbRows.reduce((s: number, r: Record<string, unknown>) => s + Number(r.book_adjusted_credit), 0);
    if (Math.abs(bkDr - bkCr) > 0) {
      const diff = (Math.abs(bkDr - bkCr) / 100).toFixed(2);
      return { period: {} as Period, error: `Trial balance is out of balance by $${diff}. Resolve before locking.` };
    }
  }

  const [updated] = await db('periods')
    .where({ id })
    .update({ locked_at: db.fn.now(), locked_by: userId })
    .returning('*');

  if (!updated) return { period: {} as Period, error: 'Period not found' };

  await logAudit({ userId, periodId: id, entityType: 'period', entityId: id, action: 'lock', description: `Locked period "${(updated as Period).period_name}" via MCP` });
  return { period: updated as Period };
}

export async function unlockPeriod(id: number, userId: number): Promise<{ period: Period; error?: string }> {
  const [updated] = await db('periods')
    .where({ id })
    .update({ locked_at: null, locked_by: null })
    .returning('*');

  if (!updated) return { period: {} as Period, error: 'Period not found' };

  await logAudit({ userId, periodId: id, entityType: 'period', entityId: id, action: 'unlock', description: `Unlocked period "${(updated as Period).period_name}" via MCP` });
  return { period: updated as Period };
}
