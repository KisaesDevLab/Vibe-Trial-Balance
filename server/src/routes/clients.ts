import { Router, Response } from 'express';
import { z } from 'zod';
import { db } from '../db';
import { authMiddleware, AuthRequest } from '../middleware/auth';

const router = Router();
router.use(authMiddleware);

const clientSchema = z.object({
  name: z.string().min(1).max(255),
  entityType: z.enum(['1065', '1120', '1120S', '1040_C']),
  taxYearEnd: z.string().max(4).optional(),
  defaultTaxSoftware: z.enum(['ultratax', 'cch', 'lacerte', 'drake']).optional(),
  taxId: z.string().max(20).optional().nullable(),
});

router.get('/', async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    const clients = await db('clients').where({ is_active: true }).orderBy('name');
    res.json({ data: clients, error: null, meta: { count: clients.length } });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ data: null, error: { code: 'SERVER_ERROR', message } });
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

  const { name, entityType, taxYearEnd, defaultTaxSoftware, taxId } = result.data;

  try {
    const [client] = await db('clients')
      .insert({
        name,
        entity_type: entityType,
        tax_year_end: taxYearEnd ?? '1231',
        default_tax_software: defaultTaxSoftware ?? 'ultratax',
        tax_id: taxId ?? null,
        is_active: true,
      })
      .returning('*');
    res.status(201).json({ data: client, error: null });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ data: null, error: { code: 'SERVER_ERROR', message } });
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
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ data: null, error: { code: 'SERVER_ERROR', message } });
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

  try {
    const [updated] = await db('clients').where({ id }).update(updates).returning('*');
    if (!updated) {
      res
        .status(404)
        .json({ data: null, error: { code: 'NOT_FOUND', message: 'Client not found' } });
      return;
    }
    res.json({ data: updated, error: null });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ data: null, error: { code: 'SERVER_ERROR', message } });
  }
});

router.delete('/:id', async (req: AuthRequest, res: Response): Promise<void> => {
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
    res.json({ data: { id }, error: null });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ data: null, error: { code: 'SERVER_ERROR', message } });
  }
});

export default router;
