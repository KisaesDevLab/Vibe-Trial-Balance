// Copyright 2025-2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Use is limited to qualifying small businesses. See LICENSE for terms.

import { Router, Response } from 'express';
import { z } from 'zod';
import { db } from '../db';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { logAudit } from '../lib/periodGuard';
import { sendServerError } from '../lib/safeError';

const router = Router();
router.use(authMiddleware);

const clientSchema = z.object({
  name: z.string().min(1).max(255),
  entityType: z.enum(['1065', '1120', '1120S', '1040_C']),
  taxYearEnd: z.string().max(4).optional(),
  defaultTaxSoftware: z.enum(['ultratax', 'cch', 'lacerte', 'gosystem']).optional(),
  taxId: z.string().max(20).optional().nullable(),
  activityType: z.enum(['business', 'rental', 'farm', 'farm_rental']).optional().default('business'),
  // Transaction Entry: pre-fills the Account column on new register rows.
  defaultSourceAccountId: z.number().int().positive().nullable().optional(),
});

/** A default source account must be an active account owned by this client. */
async function validateDefaultSourceAccount(
  clientId: number,
  accountId: number | null | undefined,
): Promise<string | null> {
  if (accountId === null || accountId === undefined) return null;
  const acct = await db('chart_of_accounts')
    .where({ id: accountId, client_id: clientId, is_active: true })
    .first('id');
  return acct ? null : "Default account must be an active account in this client's chart of accounts";
}

router.get('/', async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    const clients = await db('clients').where({ is_active: true }).orderBy('name');
    res.json({ data: clients, error: null, meta: { count: clients.length } });
  } catch (err: unknown) {
    sendServerError(res, err, 'clients');
  }
});

router.post('/', async (req: AuthRequest, res: Response): Promise<void> => {
  const result = clientSchema.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({
      data: null,
      error: { code: 'VALIDATION_ERROR', message: result.error.message },
    });
    return;
  }

  const { name, entityType, taxYearEnd, defaultTaxSoftware, taxId, activityType } = result.data;

  try {
    const [client] = await db('clients')
      .insert({
        name,
        entity_type: entityType,
        tax_year_end: taxYearEnd ?? '1231',
        default_tax_software: defaultTaxSoftware ?? 'ultratax',
        tax_id: taxId ?? null,
        activity_type: activityType ?? 'business',
        is_active: true,
      })
      .returning('*');
    await logAudit({ userId: req.user!.userId, periodId: null, clientId: client.id, entityType: 'client', entityId: client.id, action: 'create', description: `Created client "${client.name}"` });
    res.status(201).json({ data: client, error: null });
  } catch (err: unknown) {
    sendServerError(res, err, 'clients');
  }
});

router.get('/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  const id = Number(req.params.id);
  if (isNaN(id)) {
    res.status(400).json({ data: null, error: { code: 'INVALID_ID', message: 'Invalid client ID' } });
    return;
  }

  try {
    const client = await db('clients').where({ id }).first();
    if (!client) {
      res
        .status(404)
        .json({ data: null, error: { code: 'NOT_FOUND', message: 'Client not found' } });
      return;
    }
    res.json({ data: client, error: null });
  } catch (err: unknown) {
    sendServerError(res, err, 'clients');
  }
});

router.patch('/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  const id = Number(req.params.id);
  if (isNaN(id)) {
    res.status(400).json({ data: null, error: { code: 'INVALID_ID', message: 'Invalid client ID' } });
    return;
  }

  const result = clientSchema.partial().safeParse(req.body);
  if (!result.success) {
    res.status(400).json({
      data: null,
      error: { code: 'VALIDATION_ERROR', message: result.error.message },
    });
    return;
  }

  const updates: Record<string, unknown> = { updated_at: db.fn.now() };
  if (result.data.name !== undefined) updates.name = result.data.name;
  if (result.data.entityType !== undefined) updates.entity_type = result.data.entityType;
  if (result.data.taxYearEnd !== undefined) updates.tax_year_end = result.data.taxYearEnd;
  if (result.data.defaultTaxSoftware !== undefined)
    updates.default_tax_software = result.data.defaultTaxSoftware;
  if (result.data.taxId !== undefined)
    updates.tax_id = result.data.taxId;
  if (result.data.activityType !== undefined)
    updates.activity_type = result.data.activityType;
  if (result.data.defaultSourceAccountId !== undefined)
    updates.default_source_account_id = result.data.defaultSourceAccountId;

  try {
    if (result.data.defaultSourceAccountId !== undefined) {
      const problem = await validateDefaultSourceAccount(id, result.data.defaultSourceAccountId);
      if (problem) {
        res.status(400).json({ data: null, error: { code: 'VALIDATION_ERROR', message: problem } });
        return;
      }
    }
    const [updated] = await db('clients').where({ id }).update(updates).returning('*');
    if (!updated) {
      res
        .status(404)
        .json({ data: null, error: { code: 'NOT_FOUND', message: 'Client not found' } });
      return;
    }
    await logAudit({ userId: req.user!.userId, periodId: null, clientId: id, entityType: 'client', entityId: id, action: 'update', description: `Updated client "${updated.name}"` });
    res.json({ data: updated, error: null });
  } catch (err: unknown) {
    sendServerError(res, err, 'clients');
  }
});

router.delete('/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  if (req.user?.role !== 'admin') {
    res.status(403).json({ data: null, error: { code: 'FORBIDDEN', message: 'Only admins can deactivate clients.' } });
    return;
  }
  const id = Number(req.params.id);
  if (isNaN(id)) {
    res.status(400).json({ data: null, error: { code: 'INVALID_ID', message: 'Invalid client ID' } });
    return;
  }

  try {
    const [updated] = await db('clients')
      .where({ id })
      .update({ is_active: false, updated_at: db.fn.now() })
      .returning('id');
    if (!updated) {
      res
        .status(404)
        .json({ data: null, error: { code: 'NOT_FOUND', message: 'Client not found' } });
      return;
    }
    await logAudit({ userId: req.user!.userId, periodId: null, clientId: id, entityType: 'client', entityId: id, action: 'delete', description: `Deactivated client #${id}` });
    res.json({ data: { id }, error: null });
  } catch (err: unknown) {
    sendServerError(res, err, 'clients');
  }
});

export default router;
