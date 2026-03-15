import { Router, Response } from 'express';
import { z } from 'zod';
import { db } from '../app';
import { authMiddleware, AuthRequest } from '../middleware/auth';

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
  workpaperRef: z.string().max(50).optional(),
  preparerNotes: z.string().optional(),
  reviewerNotes: z.string().optional(),
  sortOrder: z.number().int().optional(),
});

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
      .orderBy([
        { column: 'sort_order', order: 'asc' },
        { column: 'account_number', order: 'asc' },
      ]);
    res.json({ data: accounts, error: null, meta: { count: accounts.length } });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ data: null, error: { code: 'SERVER_ERROR', message } });
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
    workpaperRef,
    preparerNotes,
    reviewerNotes,
    sortOrder,
  } = result.data;

  try {
    const [account] = await db('chart_of_accounts')
      .insert({
        client_id: clientId,
        account_number: accountNumber,
        account_name: accountName,
        category,
        subcategory: subcategory ?? null,
        normal_balance: normalBalance,
        tax_line: taxLine ?? null,
        workpaper_ref: workpaperRef ?? null,
        preparer_notes: preparerNotes ?? null,
        reviewer_notes: reviewerNotes ?? null,
        sort_order: sortOrder ?? 0,
        is_active: true,
      })
      .returning('*');
    res.status(201).json({ data: account, error: null });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    if (message.includes('unique') || message.includes('duplicate')) {
      res.status(409).json({
        data: null,
        error: { code: 'DUPLICATE', message: 'Account number already exists for this client' },
      });
      return;
    }
    res.status(500).json({ data: null, error: { code: 'SERVER_ERROR', message } });
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
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ data: null, error: { code: 'SERVER_ERROR', message } });
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
  if (d.workpaperRef !== undefined) updates.workpaper_ref = d.workpaperRef;
  if (d.preparerNotes !== undefined) updates.preparer_notes = d.preparerNotes;
  if (d.reviewerNotes !== undefined) updates.reviewer_notes = d.reviewerNotes;
  if (d.sortOrder !== undefined) updates.sort_order = d.sortOrder;

  try {
    const [updated] = await db('chart_of_accounts').where({ id }).update(updates).returning('*');
    if (!updated) {
      res
        .status(404)
        .json({ data: null, error: { code: 'NOT_FOUND', message: 'Account not found' } });
      return;
    }
    res.json({ data: updated, error: null });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ data: null, error: { code: 'SERVER_ERROR', message } });
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
    res.json({ data: { id }, error: null });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ data: null, error: { code: 'SERVER_ERROR', message } });
  }
});
