import { Router, Response } from 'express';
import { z } from 'zod';
import { db } from '../db';
import { authMiddleware, AuthRequest } from '../middleware/auth';

// Tickmark library (per client)
export const tickmarkLibraryCollectionRouter = Router({ mergeParams: true });
tickmarkLibraryCollectionRouter.use(authMiddleware);

export const tickmarkLibraryItemRouter = Router({ mergeParams: true });
tickmarkLibraryItemRouter.use(authMiddleware);

// TB tickmark assignments (per period)
export const tbTickmarkRouter = Router({ mergeParams: true });
tbTickmarkRouter.use(authMiddleware);

const COLORS = ['gray', 'blue', 'green', 'red', 'purple', 'amber'] as const;

const librarySchema = z.object({
  symbol:      z.string().min(1).max(10),
  description: z.string().min(1).max(500),
  color:       z.enum(COLORS).optional().default('gray'),
  sortOrder:   z.number().int().optional(),
});

// GET /api/v1/clients/:clientId/tickmarks
tickmarkLibraryCollectionRouter.get('/', async (req: AuthRequest, res: Response): Promise<void> => {
  const clientId = Number(req.params.clientId);
  if (isNaN(clientId)) { res.status(400).json({ data: null, error: { code: 'INVALID_ID', message: 'Invalid client ID' } }); return; }
  try {
    const rows = await db('tickmark_library').where({ client_id: clientId })
      .orderBy([{ column: 'sort_order', order: 'asc' }, { column: 'id', order: 'asc' }]);
    res.json({ data: rows, error: null });
  } catch (err: unknown) {
    res.status(500).json({ data: null, error: { code: 'SERVER_ERROR', message: (err as Error).message } });
  }
});

// POST /api/v1/clients/:clientId/tickmarks
tickmarkLibraryCollectionRouter.post('/', async (req: AuthRequest, res: Response): Promise<void> => {
  const clientId = Number(req.params.clientId);
  if (isNaN(clientId)) { res.status(400).json({ data: null, error: { code: 'INVALID_ID', message: 'Invalid client ID' } }); return; }
  const result = librarySchema.safeParse(req.body);
  if (!result.success) { res.status(400).json({ data: null, error: { code: 'VALIDATION_ERROR', message: result.error.message } }); return; }
  const d = result.data;
  try {
    const [row] = await db('tickmark_library').insert({
      client_id:   clientId,
      symbol:      d.symbol,
      description: d.description,
      color:       d.color,
      sort_order:  d.sortOrder ?? 0,
      created_by:  req.user!.userId,
    }).returning('*');
    res.status(201).json({ data: row, error: null });
  } catch (err: unknown) {
    res.status(500).json({ data: null, error: { code: 'SERVER_ERROR', message: (err as Error).message } });
  }
});

// PATCH /api/v1/tickmarks/:id
tickmarkLibraryItemRouter.patch('/', async (req: AuthRequest, res: Response): Promise<void> => {
  const id = Number(req.params.id);
  if (isNaN(id)) { res.status(400).json({ data: null, error: { code: 'INVALID_ID', message: 'Invalid ID' } }); return; }
  const result = librarySchema.partial().safeParse(req.body);
  if (!result.success) { res.status(400).json({ data: null, error: { code: 'VALIDATION_ERROR', message: result.error.message } }); return; }
  const d = result.data;
  const updates: Record<string, unknown> = {};
  if (d.symbol      !== undefined) updates.symbol      = d.symbol;
  if (d.description !== undefined) updates.description = d.description;
  if (d.color       !== undefined) updates.color       = d.color;
  if (d.sortOrder   !== undefined) updates.sort_order  = d.sortOrder;
  try {
    const [updated] = await db('tickmark_library').where({ id }).update(updates).returning('*');
    if (!updated) { res.status(404).json({ data: null, error: { code: 'NOT_FOUND', message: 'Tickmark not found' } }); return; }
    res.json({ data: updated, error: null });
  } catch (err: unknown) {
    res.status(500).json({ data: null, error: { code: 'SERVER_ERROR', message: (err as Error).message } });
  }
});

// DELETE /api/v1/tickmarks/:id
tickmarkLibraryItemRouter.delete('/', async (req: AuthRequest, res: Response): Promise<void> => {
  const id = Number(req.params.id);
  if (isNaN(id)) { res.status(400).json({ data: null, error: { code: 'INVALID_ID', message: 'Invalid ID' } }); return; }
  try {
    const deleted = await db('tickmark_library').where({ id }).delete();
    if (!deleted) { res.status(404).json({ data: null, error: { code: 'NOT_FOUND', message: 'Tickmark not found' } }); return; }
    res.json({ data: { id }, error: null });
  } catch (err: unknown) {
    res.status(500).json({ data: null, error: { code: 'SERVER_ERROR', message: (err as Error).message } });
  }
});

// GET /api/v1/periods/:periodId/tb-tickmarks
// Returns { [accountId]: TickmarkLibraryRow[] }
tbTickmarkRouter.get('/', async (req: AuthRequest, res: Response): Promise<void> => {
  const periodId = Number(req.params.periodId);
  if (isNaN(periodId)) { res.status(400).json({ data: null, error: { code: 'INVALID_ID', message: 'Invalid period ID' } }); return; }
  try {
    const rows = await db('tb_tickmarks as tt')
      .join('tickmark_library as tl', 'tl.id', 'tt.tickmark_id')
      .where('tt.period_id', periodId)
      .select('tt.account_id', 'tl.id', 'tl.symbol', 'tl.description', 'tl.color', 'tl.sort_order');
    // Group by account_id
    const map: Record<number, object[]> = {};
    for (const r of rows) {
      const aid = r.account_id as number;
      if (!map[aid]) map[aid] = [];
      map[aid].push({ id: r.id, symbol: r.symbol, description: r.description, color: r.color });
    }
    res.json({ data: map, error: null });
  } catch (err: unknown) {
    res.status(500).json({ data: null, error: { code: 'SERVER_ERROR', message: (err as Error).message } });
  }
});

// POST /api/v1/periods/:periodId/tb-tickmarks/toggle
tbTickmarkRouter.post('/toggle', async (req: AuthRequest, res: Response): Promise<void> => {
  const periodId = Number(req.params.periodId);
  if (isNaN(periodId)) { res.status(400).json({ data: null, error: { code: 'INVALID_ID', message: 'Invalid period ID' } }); return; }
  const bodySchema = z.object({ accountId: z.number().int(), tickmarkId: z.number().int() });
  const result = bodySchema.safeParse(req.body);
  if (!result.success) { res.status(400).json({ data: null, error: { code: 'VALIDATION_ERROR', message: result.error.message } }); return; }
  const { accountId, tickmarkId } = result.data;
  try {
    const existing = await db('tb_tickmarks').where({ period_id: periodId, account_id: accountId, tickmark_id: tickmarkId }).first('id');
    if (existing) {
      await db('tb_tickmarks').where({ id: existing.id }).delete();
      res.json({ data: { action: 'removed' }, error: null });
    } else {
      await db('tb_tickmarks').insert({ period_id: periodId, account_id: accountId, tickmark_id: tickmarkId, created_by: req.user!.userId });
      res.json({ data: { action: 'assigned' }, error: null });
    }
  } catch (err: unknown) {
    res.status(500).json({ data: null, error: { code: 'SERVER_ERROR', message: (err as Error).message } });
  }
});
