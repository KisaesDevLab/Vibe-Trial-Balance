import { Router, Response } from 'express';
import { z } from 'zod';
import { db } from '../db';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { logAudit } from '../lib/periodGuard';

export const periodCollectionRouter = Router({ mergeParams: true });
periodCollectionRouter.use(authMiddleware);

export const periodItemRouter = Router();
periodItemRouter.use(authMiddleware);

const periodSchema = z.object({
  periodName: z.string().min(1).max(100),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  isCurrent: z.boolean().optional(),
});

// GET /api/v1/clients/:clientId/periods
periodCollectionRouter.get('/', async (req: AuthRequest, res: Response): Promise<void> => {
  const clientId = Number(req.params.clientId);
  if (isNaN(clientId)) {
    res.status(400).json({ data: null, error: { code: 'INVALID_ID', message: 'Invalid client ID' } });
    return;
  }
  try {
    const periods = await db('periods')
      .where({ client_id: clientId })
      .orderBy('end_date', 'desc');
    res.json({ data: periods, error: null, meta: { count: periods.length } });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ data: null, error: { code: 'SERVER_ERROR', message } });
  }
});

// POST /api/v1/clients/:clientId/periods
periodCollectionRouter.post('/', async (req: AuthRequest, res: Response): Promise<void> => {
  const clientId = Number(req.params.clientId);
  if (isNaN(clientId)) {
    res.status(400).json({ data: null, error: { code: 'INVALID_ID', message: 'Invalid client ID' } });
    return;
  }
  const result = periodSchema.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({ data: null, error: { code: 'VALIDATION_ERROR', message: result.error.message } });
    return;
  }
  const { periodName, startDate, endDate, isCurrent } = result.data;

  try {
    await db.transaction(async (trx) => {
      if (isCurrent) {
        await trx('periods').where({ client_id: clientId }).update({ is_current: false });
      }
      const [period] = await trx('periods')
        .insert({
          client_id: clientId,
          period_name: periodName,
          start_date: startDate ?? null,
          end_date: endDate ?? null,
          is_current: isCurrent ?? false,
        })
        .returning('*');
      res.status(201).json({ data: period, error: null });
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ data: null, error: { code: 'SERVER_ERROR', message } });
  }
});

// PATCH /api/v1/periods/:id
periodItemRouter.patch('/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  const id = Number(req.params.id);
  if (isNaN(id)) {
    res.status(400).json({ data: null, error: { code: 'INVALID_ID', message: 'Invalid period ID' } });
    return;
  }
  const result = periodSchema.partial().safeParse(req.body);
  if (!result.success) {
    res.status(400).json({ data: null, error: { code: 'VALIDATION_ERROR', message: result.error.message } });
    return;
  }
  const d = result.data;

  try {
    await db.transaction(async (trx) => {
      if (d.isCurrent === true) {
        const period = await trx('periods').where({ id }).first('client_id');
        if (period) {
          await trx('periods').where({ client_id: period.client_id }).update({ is_current: false });
        }
      }
      const updates: Record<string, unknown> = {};
      if (d.periodName !== undefined) updates.period_name = d.periodName;
      if (d.startDate !== undefined) updates.start_date = d.startDate;
      if (d.endDate !== undefined) updates.end_date = d.endDate;
      if (d.isCurrent !== undefined) updates.is_current = d.isCurrent;

      const [updated] = await trx('periods').where({ id }).update(updates).returning('*');
      if (!updated) {
        res.status(404).json({ data: null, error: { code: 'NOT_FOUND', message: 'Period not found' } });
        return;
      }
      res.json({ data: updated, error: null });
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ data: null, error: { code: 'SERVER_ERROR', message } });
  }
});

// POST /api/v1/periods/:id/lock
periodItemRouter.post('/:id/lock', async (req: AuthRequest, res: Response): Promise<void> => {
  const id = Number(req.params.id);
  if (isNaN(id)) {
    res.status(400).json({ data: null, error: { code: 'INVALID_ID', message: 'Invalid period ID' } });
    return;
  }
  try {
    // Check TB is balanced before allowing lock
    const tbRows = await db('v_adjusted_trial_balance').where({ period_id: id });
    if (tbRows.length > 0) {
      const bkDr = tbRows.reduce((s: number, r: Record<string,unknown>) => s + Number(r.book_adjusted_debit), 0);
      const bkCr = tbRows.reduce((s: number, r: Record<string,unknown>) => s + Number(r.book_adjusted_credit), 0);
      if (Math.abs(bkDr - bkCr) > 0) {
        const diff = (Math.abs(bkDr - bkCr) / 100).toFixed(2);
        res.status(409).json({ data: null, error: { code: 'TB_OUT_OF_BALANCE', message: `Trial balance is out of balance by $${diff}. Resolve before locking.` } });
        return;
      }
    }
    const [updated] = await db('periods')
      .where({ id })
      .update({ locked_at: db.fn.now(), locked_by: req.user!.userId })
      .returning('*');
    if (!updated) {
      res.status(404).json({ data: null, error: { code: 'NOT_FOUND', message: 'Period not found' } });
      return;
    }
    await logAudit({ userId: req.user!.userId, periodId: id, entityType: 'period', entityId: id, action: 'lock', description: `Locked period "${updated.period_name}"` });
    res.json({ data: updated, error: null });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ data: null, error: { code: 'SERVER_ERROR', message } });
  }
});

// POST /api/v1/periods/:id/unlock  (admin only)
periodItemRouter.post('/:id/unlock', async (req: AuthRequest, res: Response): Promise<void> => {
  if (req.user?.role !== 'admin') {
    res.status(403).json({ data: null, error: { code: 'FORBIDDEN', message: 'Only admins can unlock periods.' } });
    return;
  }
  const id = Number(req.params.id);
  if (isNaN(id)) {
    res.status(400).json({ data: null, error: { code: 'INVALID_ID', message: 'Invalid period ID' } });
    return;
  }
  try {
    const [updated] = await db('periods')
      .where({ id })
      .update({ locked_at: null, locked_by: null })
      .returning('*');
    if (!updated) {
      res.status(404).json({ data: null, error: { code: 'NOT_FOUND', message: 'Period not found' } });
      return;
    }
    await logAudit({ userId: req.user!.userId, periodId: id, entityType: 'period', entityId: id, action: 'unlock', description: `Unlocked period "${updated.period_name}"` });
    res.json({ data: updated, error: null });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ data: null, error: { code: 'SERVER_ERROR', message } });
  }
});

// DELETE /api/v1/periods/:id
periodItemRouter.delete('/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  const id = Number(req.params.id);
  if (isNaN(id)) {
    res.status(400).json({ data: null, error: { code: 'INVALID_ID', message: 'Invalid period ID' } });
    return;
  }
  try {
    const period = await db('periods').where({ id }).first('id', 'locked_at');
    if (!period) {
      res.status(404).json({ data: null, error: { code: 'NOT_FOUND', message: 'Period not found' } });
      return;
    }
    if (period.locked_at && req.user?.role !== 'admin') {
      res.status(409).json({ data: null, error: { code: 'PERIOD_LOCKED', message: 'Cannot delete a locked period. Ask an admin to unlock it first.' } });
      return;
    }
    const [deleted] = await db('periods').where({ id }).delete().returning('id');
    if (!deleted) {
      res.status(404).json({ data: null, error: { code: 'NOT_FOUND', message: 'Period not found' } });
      return;
    }
    res.json({ data: { id }, error: null });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ data: null, error: { code: 'SERVER_ERROR', message } });
  }
});
