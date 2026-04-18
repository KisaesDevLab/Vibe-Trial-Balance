// Copyright 2025-2026 Kisaes LLC
// Licensed under the PolyForm Internal Use License 1.0.0.
// You may not distribute this software. See LICENSE for terms.

import { Router, Response } from 'express';
import { z } from 'zod';
import { db } from '../db';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { sendServerError } from '../lib/safeError';

export const varianceNotesRouter = Router({ mergeParams: true });
varianceNotesRouter.use(authMiddleware);

// GET /api/v1/periods/:periodId/variance-notes
varianceNotesRouter.get('/', async (req: AuthRequest, res: Response): Promise<void> => {
  const periodId = Number(req.params.periodId);
  if (isNaN(periodId)) { res.status(400).json({ data: null, error: { code: 'INVALID_ID', message: 'Invalid period ID' } }); return; }
  try {
    const rows = await db('variance_notes').where({ period_id: periodId }).orderBy('account_id');
    res.json({ data: rows, error: null });
  } catch (err: unknown) {
    sendServerError(res, err, 'varianceNotes');
  }
});

// PUT /api/v1/periods/:periodId/variance-notes/:accountId
varianceNotesRouter.put('/:accountId', async (req: AuthRequest, res: Response): Promise<void> => {
  const periodId = Number(req.params.periodId);
  const accountId = Number(req.params.accountId);
  if (isNaN(periodId) || isNaN(accountId)) { res.status(400).json({ data: null, error: { code: 'INVALID_ID', message: 'Invalid ID' } }); return; }
  const schema = z.object({ note: z.string().max(2000) });
  const result = schema.safeParse(req.body);
  if (!result.success) { res.status(400).json({ data: null, error: { code: 'VALIDATION_ERROR', message: result.error.message } }); return; }
  try {
    if (!result.data.note.trim()) {
      await db('variance_notes').where({ period_id: periodId, account_id: accountId }).delete();
      res.json({ data: { deleted: true }, error: null });
      return;
    }
    const [row] = await db('variance_notes')
      .insert({ period_id: periodId, account_id: accountId, compare_period_id: 0, note: result.data.note.trim(), created_by: req.user!.userId })
      .onConflict(['period_id', 'account_id', 'compare_period_id'])
      .merge({ note: result.data.note.trim() })
      .returning('*');
    res.json({ data: row, error: null });
  } catch (err: unknown) {
    sendServerError(res, err, 'varianceNotes');
  }
});
