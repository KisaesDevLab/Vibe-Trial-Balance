import { Router, Response } from 'express';
import { z } from 'zod';
import { db } from '../db';
import { authMiddleware, AuthRequest } from '../middleware/auth';

export const m1CollectionRouter = Router({ mergeParams: true });
m1CollectionRouter.use(authMiddleware);

export const m1ItemRouter = Router({ mergeParams: true });
m1ItemRouter.use(authMiddleware);

const m1Schema = z.object({
  description: z.string().min(1).max(500),
  category:    z.string().max(100).optional().nullable(),
  bookAmount:  z.number().int(),
  taxAmount:   z.number().int(),
  sortOrder:   z.number().int().optional(),
  notes:       z.string().optional().nullable(),
});

function parseRow(r: Record<string, unknown>) {
  return {
    ...r,
    book_amount: Number(r.book_amount ?? 0),
    tax_amount:  Number(r.tax_amount  ?? 0),
  };
}

// GET /api/v1/periods/:periodId/m1-adjustments
m1CollectionRouter.get('/', async (req: AuthRequest, res: Response): Promise<void> => {
  const periodId = Number(req.params.periodId);
  if (isNaN(periodId)) { res.status(400).json({ data: null, error: { code: 'INVALID_ID', message: 'Invalid period ID' } }); return; }
  try {
    const rows = await db('m1_adjustments')
      .where({ period_id: periodId })
      .orderBy([{ column: 'sort_order', order: 'asc' }, { column: 'id', order: 'asc' }]);
    res.json({ data: rows.map(r => parseRow(r as Record<string, unknown>)), error: null, meta: { count: rows.length } });
  } catch (err: unknown) {
    res.status(500).json({ data: null, error: { code: 'SERVER_ERROR', message: (err as Error).message } });
  }
});

// POST /api/v1/periods/:periodId/m1-adjustments
m1CollectionRouter.post('/', async (req: AuthRequest, res: Response): Promise<void> => {
  const periodId = Number(req.params.periodId);
  if (isNaN(periodId)) { res.status(400).json({ data: null, error: { code: 'INVALID_ID', message: 'Invalid period ID' } }); return; }
  const result = m1Schema.safeParse(req.body);
  if (!result.success) { res.status(400).json({ data: null, error: { code: 'VALIDATION_ERROR', message: result.error.message } }); return; }
  const d = result.data;
  try {
    const [row] = await db('m1_adjustments').insert({
      period_id:   periodId,
      description: d.description,
      category:    d.category ?? null,
      book_amount: d.bookAmount,
      tax_amount:  d.taxAmount,
      sort_order:  d.sortOrder ?? 0,
      notes:       d.notes ?? null,
      created_by:  req.user!.userId,
    }).returning('*');
    res.status(201).json({ data: parseRow(row as Record<string, unknown>), error: null });
  } catch (err: unknown) {
    res.status(500).json({ data: null, error: { code: 'SERVER_ERROR', message: (err as Error).message } });
  }
});

// PATCH /api/v1/m1-adjustments/:id
m1ItemRouter.patch('/', async (req: AuthRequest, res: Response): Promise<void> => {
  const id = Number(req.params.id);
  if (isNaN(id)) { res.status(400).json({ data: null, error: { code: 'INVALID_ID', message: 'Invalid ID' } }); return; }
  const result = m1Schema.partial().safeParse(req.body);
  if (!result.success) { res.status(400).json({ data: null, error: { code: 'VALIDATION_ERROR', message: result.error.message } }); return; }
  const d = result.data;
  const updates: Record<string, unknown> = { updated_at: db.fn.now() };
  if (d.description !== undefined) updates.description = d.description;
  if (d.category    !== undefined) updates.category    = d.category;
  if (d.bookAmount  !== undefined) updates.book_amount = d.bookAmount;
  if (d.taxAmount   !== undefined) updates.tax_amount  = d.taxAmount;
  if (d.sortOrder   !== undefined) updates.sort_order  = d.sortOrder;
  if (d.notes       !== undefined) updates.notes       = d.notes;
  try {
    const [updated] = await db('m1_adjustments').where({ id }).update(updates).returning('*');
    if (!updated) { res.status(404).json({ data: null, error: { code: 'NOT_FOUND', message: 'Adjustment not found' } }); return; }
    res.json({ data: parseRow(updated as Record<string, unknown>), error: null });
  } catch (err: unknown) {
    res.status(500).json({ data: null, error: { code: 'SERVER_ERROR', message: (err as Error).message } });
  }
});

// DELETE /api/v1/m1-adjustments/:id
m1ItemRouter.delete('/', async (req: AuthRequest, res: Response): Promise<void> => {
  const id = Number(req.params.id);
  if (isNaN(id)) { res.status(400).json({ data: null, error: { code: 'INVALID_ID', message: 'Invalid ID' } }); return; }
  try {
    const deleted = await db('m1_adjustments').where({ id }).delete();
    if (!deleted) { res.status(404).json({ data: null, error: { code: 'NOT_FOUND', message: 'Adjustment not found' } }); return; }
    res.json({ data: { id }, error: null });
  } catch (err: unknown) {
    res.status(500).json({ data: null, error: { code: 'SERVER_ERROR', message: (err as Error).message } });
  }
});
