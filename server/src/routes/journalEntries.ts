import { Router, Response } from 'express';
import { z } from 'zod';
import { db } from '../db';
import { authMiddleware, AuthRequest } from '../middleware/auth';

export const jeCollectionRouter = Router({ mergeParams: true });
jeCollectionRouter.use(authMiddleware);

export const jeItemRouter = Router();
jeItemRouter.use(authMiddleware);

const lineSchema = z.object({
  accountId: z.number().int().positive(),
  debit: z.number().int().min(0),
  credit: z.number().int().min(0),
});

const jeSchema = z.object({
  entryType: z.enum(['book', 'tax']),
  entryDate: z.string(),
  description: z.string().optional(),
  isRecurring: z.boolean().optional(),
  lines: z.array(lineSchema).min(2),
});

function parseBigIntLines(lines: Record<string, unknown>[]): Record<string, unknown>[] {
  return lines.map((l) => ({
    ...l,
    debit: Number(l.debit),
    credit: Number(l.credit),
  }));
}

// GET /api/v1/periods/:periodId/journal-entries
jeCollectionRouter.get('/', async (req: AuthRequest, res: Response): Promise<void> => {
  const periodId = Number(req.params.periodId);
  if (isNaN(periodId)) {
    res.status(400).json({ data: null, error: { code: 'INVALID_ID', message: 'Invalid period ID' } });
    return;
  }
  const typeFilter = typeof req.query.type === 'string' ? req.query.type : null;

  try {
    let q = db('journal_entries').where({ period_id: periodId });
    if (typeFilter) q = q.where({ entry_type: typeFilter });
    const entries = await q.orderBy('entry_type').orderBy('entry_number');

    const entryIds = entries.map((e: { id: number }) => e.id);
    const lines = entryIds.length > 0
      ? await db('journal_entry_lines')
          .whereIn('journal_entry_id', entryIds)
          .join('chart_of_accounts', 'chart_of_accounts.id', 'journal_entry_lines.account_id')
          .select(
            'journal_entry_lines.*',
            'chart_of_accounts.account_number',
            'chart_of_accounts.account_name',
          )
      : [];

    const linesByEntry = lines.reduce((acc: Record<number, unknown[]>, l: Record<string, unknown>) => {
      const jeId = l.journal_entry_id as number;
      (acc[jeId] = acc[jeId] || []).push({ ...l, debit: Number(l.debit), credit: Number(l.credit) });
      return acc;
    }, {});

    const result = entries.map((e: Record<string, unknown>) => ({
      ...e,
      lines: linesByEntry[e.id as number] ?? [],
    }));

    res.json({ data: result, error: null, meta: { count: result.length } });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ data: null, error: { code: 'SERVER_ERROR', message } });
  }
});

// POST /api/v1/journal-entries
jeItemRouter.post('/', async (req: AuthRequest, res: Response): Promise<void> => {
  // periodId comes from body for POST
  const bodySchema = jeSchema.extend({ periodId: z.number().int().positive() });
  const result = bodySchema.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({ data: null, error: { code: 'VALIDATION_ERROR', message: result.error.message } });
    return;
  }
  const { periodId, entryType, entryDate, description, isRecurring, lines } = result.data;

  const totalDebit = lines.reduce((s, l) => s + l.debit, 0);
  const totalCredit = lines.reduce((s, l) => s + l.credit, 0);
  if (totalDebit !== totalCredit) {
    res.status(400).json({
      data: null,
      error: { code: 'UNBALANCED', message: `Journal entry must balance. Debit: ${totalDebit}, Credit: ${totalCredit}` },
    });
    return;
  }

  try {
    await db.transaction(async (trx) => {
      const lastEntry = await trx('journal_entries')
        .where({ period_id: periodId, entry_type: entryType })
        .max('entry_number as max')
        .first();
      const entryNumber = (lastEntry?.max ?? 0) + 1;

      const [entry] = await trx('journal_entries')
        .insert({
          period_id: periodId,
          entry_number: entryNumber,
          entry_type: entryType,
          entry_date: entryDate,
          description: description ?? null,
          is_recurring: isRecurring ?? false,
          created_by: req.user!.userId,
        })
        .returning('*');

      await trx('journal_entry_lines').insert(
        lines.map((l) => ({
          journal_entry_id: entry.id,
          account_id: l.accountId,
          debit: l.debit,
          credit: l.credit,
        })),
      );

      res.status(201).json({ data: { ...entry, lines }, error: null });
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ data: null, error: { code: 'SERVER_ERROR', message } });
  }
});

// GET /api/v1/journal-entries/:id
jeItemRouter.get('/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  const id = Number(req.params.id);
  if (isNaN(id)) {
    res.status(400).json({ data: null, error: { code: 'INVALID_ID', message: 'Invalid ID' } });
    return;
  }
  try {
    const entry = await db('journal_entries').where({ id }).first();
    if (!entry) {
      res.status(404).json({ data: null, error: { code: 'NOT_FOUND', message: 'Journal entry not found' } });
      return;
    }
    const lines = await db('journal_entry_lines')
      .where({ journal_entry_id: id })
      .join('chart_of_accounts', 'chart_of_accounts.id', 'journal_entry_lines.account_id')
      .select('journal_entry_lines.*', 'chart_of_accounts.account_number', 'chart_of_accounts.account_name');

    res.json({ data: { ...entry, lines: parseBigIntLines(lines) }, error: null });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ data: null, error: { code: 'SERVER_ERROR', message } });
  }
});

// PUT /api/v1/journal-entries/:id/lines  (replace all lines + validate balance)
jeItemRouter.put('/:id/lines', async (req: AuthRequest, res: Response): Promise<void> => {
  const id = Number(req.params.id);
  if (isNaN(id)) {
    res.status(400).json({ data: null, error: { code: 'INVALID_ID', message: 'Invalid ID' } });
    return;
  }
  const result = z.object({ lines: z.array(lineSchema).min(2) }).safeParse(req.body);
  if (!result.success) {
    res.status(400).json({ data: null, error: { code: 'VALIDATION_ERROR', message: result.error.message } });
    return;
  }
  const { lines } = result.data;

  const totalDebit = lines.reduce((s, l) => s + l.debit, 0);
  const totalCredit = lines.reduce((s, l) => s + l.credit, 0);
  if (totalDebit !== totalCredit) {
    res.status(400).json({
      data: null,
      error: { code: 'UNBALANCED', message: `Journal entry must balance. Debit: ${totalDebit}, Credit: ${totalCredit}` },
    });
    return;
  }

  try {
    await db.transaction(async (trx) => {
      await trx('journal_entry_lines').where({ journal_entry_id: id }).delete();
      await trx('journal_entry_lines').insert(
        lines.map((l) => ({
          journal_entry_id: id,
          account_id: l.accountId,
          debit: l.debit,
          credit: l.credit,
        })),
      );
    });
    res.json({ data: { id, lines }, error: null });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ data: null, error: { code: 'SERVER_ERROR', message } });
  }
});

// PATCH /api/v1/journal-entries/:id  (update header fields + optionally replace lines)
jeItemRouter.patch('/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  const id = Number(req.params.id);
  if (isNaN(id)) {
    res.status(400).json({ data: null, error: { code: 'INVALID_ID', message: 'Invalid ID' } });
    return;
  }
  try {
    const existing = await db('journal_entries').where({ id }).first('entry_type');
    if (!existing) {
      res.status(404).json({ data: null, error: { code: 'NOT_FOUND', message: 'Journal entry not found' } });
      return;
    }
    if (existing.entry_type === 'trans') {
      res.status(403).json({ data: null, error: { code: 'FORBIDDEN', message: 'Trans entries are managed via Bank Transactions and cannot be edited directly.' } });
      return;
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ data: null, error: { code: 'SERVER_ERROR', message } });
    return;
  }
  const patchSchema = z.object({
    entryType: z.enum(['book', 'tax']).optional(),
    entryDate: z.string().optional(),
    description: z.string().nullable().optional(),
    lines: z.array(lineSchema).min(2).optional(),
  });
  const result = patchSchema.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({ data: null, error: { code: 'VALIDATION_ERROR', message: result.error.message } });
    return;
  }
  const { entryType, entryDate, description, lines } = result.data;

  if (lines) {
    const totalDebit = lines.reduce((s, l) => s + l.debit, 0);
    const totalCredit = lines.reduce((s, l) => s + l.credit, 0);
    if (totalDebit !== totalCredit) {
      res.status(400).json({
        data: null,
        error: { code: 'UNBALANCED', message: `Journal entry must balance. Debit: ${totalDebit}, Credit: ${totalCredit}` },
      });
      return;
    }
  }

  try {
    const updatedEntry = await db.transaction(async (trx) => {
      const headerUpdates: Record<string, unknown> = { updated_at: trx.fn.now() };
      if (entryType !== undefined) headerUpdates.entry_type = entryType;
      if (entryDate !== undefined) headerUpdates.entry_date = entryDate;
      if (description !== undefined) headerUpdates.description = description;

      const [entry] = await trx('journal_entries').where({ id }).update(headerUpdates).returning('*');
      if (!entry) throw new Error('NOT_FOUND');

      if (lines) {
        await trx('journal_entry_lines').where({ journal_entry_id: id }).delete();
        await trx('journal_entry_lines').insert(
          lines.map((l) => ({ journal_entry_id: id, account_id: l.accountId, debit: l.debit, credit: l.credit })),
        );
      }
      return entry;
    });
    res.json({ data: updatedEntry, error: null });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    if (message === 'NOT_FOUND') {
      res.status(404).json({ data: null, error: { code: 'NOT_FOUND', message: 'Journal entry not found' } });
    } else {
      res.status(500).json({ data: null, error: { code: 'SERVER_ERROR', message } });
    }
  }
});

// DELETE /api/v1/journal-entries/:id
jeItemRouter.delete('/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  const id = Number(req.params.id);
  if (isNaN(id)) {
    res.status(400).json({ data: null, error: { code: 'INVALID_ID', message: 'Invalid ID' } });
    return;
  }
  try {
    const existing = await db('journal_entries').where({ id }).first('entry_type');
    if (!existing) {
      res.status(404).json({ data: null, error: { code: 'NOT_FOUND', message: 'Journal entry not found' } });
      return;
    }
    if (existing.entry_type === 'trans') {
      res.status(403).json({ data: null, error: { code: 'FORBIDDEN', message: 'Trans entries are managed via Bank Transactions and cannot be deleted directly.' } });
      return;
    }
    const [deleted] = await db('journal_entries').where({ id }).delete().returning('id');
    if (!deleted) {
      res.status(404).json({ data: null, error: { code: 'NOT_FOUND', message: 'Journal entry not found' } });
      return;
    }
    res.json({ data: { id }, error: null });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ data: null, error: { code: 'SERVER_ERROR', message } });
  }
});
