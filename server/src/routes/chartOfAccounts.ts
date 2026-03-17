import { Router, Response } from 'express';
import { z } from 'zod';
import { db } from '../db';
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
  cashFlowCategory: z.enum(['operating', 'investing', 'financing', 'non_cash', 'cash']).optional().nullable(),
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
        cash_flow_category: result.data.cashFlowCategory ?? null,
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

// POST /api/v1/clients/:clientId/chart-of-accounts/import
coaCollectionRouter.post('/import', async (req: AuthRequest, res: Response): Promise<void> => {
  const clientId = Number(req.params.clientId);
  if (isNaN(clientId)) {
    res.status(400).json({ data: null, error: { code: 'INVALID_ID', message: 'Invalid client ID' } });
    return;
  }

  const rowSchema = accountSchema.extend({ sortOrder: z.number().int().optional().default(0) });
  const bodySchema = z.object({ rows: z.array(rowSchema).min(1).max(2000) });
  const parsed = bodySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ data: null, error: { code: 'VALIDATION_ERROR', message: parsed.error.message } });
    return;
  }

  const { rows } = parsed.data;
  let inserted = 0;
  let updated = 0;

  try {
    await db.transaction(async (trx) => {
      for (const r of rows) {
        const existing = await trx('chart_of_accounts')
          .where({ client_id: clientId, account_number: r.accountNumber })
          .first('id');

        if (existing) {
          await trx('chart_of_accounts').where({ id: existing.id }).update({
            account_name: r.accountName,
            category: r.category,
            subcategory: r.subcategory ?? null,
            normal_balance: r.normalBalance,
            tax_line: r.taxLine ?? null,
            workpaper_ref: r.workpaperRef ?? null,
            sort_order: r.sortOrder ?? 0,
            is_active: true,
            updated_at: trx.fn.now(),
          });
          updated++;
        } else {
          await trx('chart_of_accounts').insert({
            client_id: clientId,
            account_number: r.accountNumber,
            account_name: r.accountName,
            category: r.category,
            subcategory: r.subcategory ?? null,
            normal_balance: r.normalBalance,
            tax_line: r.taxLine ?? null,
            workpaper_ref: r.workpaperRef ?? null,
            sort_order: r.sortOrder ?? 0,
            is_active: true,
          });
          inserted++;
        }
      }
    });
    res.json({ data: { inserted, updated, total: rows.length }, error: null });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ data: null, error: { code: 'SERVER_ERROR', message } });
  }
});

// POST /api/v1/clients/:clientId/chart-of-accounts/copy-from/:sourceClientId
coaCollectionRouter.post('/copy-from/:sourceClientId', async (req: AuthRequest, res: Response): Promise<void> => {
  const clientId = Number(req.params.clientId);
  const sourceClientId = Number(req.params.sourceClientId);
  if (isNaN(clientId) || isNaN(sourceClientId)) {
    res.status(400).json({ data: null, error: { code: 'INVALID_ID', message: 'Invalid client ID' } });
    return;
  }
  if (clientId === sourceClientId) {
    res.status(400).json({ data: null, error: { code: 'INVALID_INPUT', message: 'Source and destination cannot be the same client.' } });
    return;
  }

  const overwrite = req.query.overwrite === 'true';
  let inserted = 0;
  let updated = 0;
  let skipped = 0;

  try {
    const sourceAccounts = await db('chart_of_accounts')
      .where({ client_id: sourceClientId, is_active: true });

    if (sourceAccounts.length === 0) {
      res.json({ data: { inserted: 0, updated: 0, skipped: 0, total: 0 }, error: null });
      return;
    }

    await db.transaction(async (trx) => {
      for (const acct of sourceAccounts) {
        const existing = await trx('chart_of_accounts')
          .where({ client_id: clientId, account_number: acct.account_number })
          .first('id');

        if (existing) {
          if (overwrite) {
            await trx('chart_of_accounts').where({ id: existing.id }).update({
              account_name: acct.account_name,
              category: acct.category,
              subcategory: acct.subcategory,
              normal_balance: acct.normal_balance,
              tax_line: acct.tax_line,
              workpaper_ref: acct.workpaper_ref,
              sort_order: acct.sort_order,
              is_active: true,
              updated_at: trx.fn.now(),
            });
            updated++;
          } else {
            skipped++;
          }
        } else {
          await trx('chart_of_accounts').insert({
            client_id: clientId,
            account_number: acct.account_number,
            account_name: acct.account_name,
            category: acct.category,
            subcategory: acct.subcategory,
            normal_balance: acct.normal_balance,
            tax_line: acct.tax_line,
            workpaper_ref: acct.workpaper_ref,
            sort_order: acct.sort_order,
            is_active: true,
          });
          inserted++;
        }
      }
    });

    res.json({ data: { inserted, updated, skipped, total: sourceAccounts.length }, error: null });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
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
  if (d.sortOrder          !== undefined) updates.sort_order         = d.sortOrder;
  if (d.cashFlowCategory   !== undefined) updates.cash_flow_category = d.cashFlowCategory;

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
