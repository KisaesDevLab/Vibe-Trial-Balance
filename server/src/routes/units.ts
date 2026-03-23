import { Router, Response } from 'express';
import { z } from 'zod';
import { db } from '../db';
import { authMiddleware, AuthRequest } from '../middleware/auth';

export const unitsRouter = Router({ mergeParams: true });
unitsRouter.use(authMiddleware);

// ─── helpers ──────────────────────────────────────────────────────────────────

function applyStrategy(accountNumber: string, strategy: string, value: string): string {
  if (strategy === 'prefix') return value + accountNumber;
  if (strategy === 'suffix') return accountNumber + value;
  return accountNumber; // 'same'
}

// ─── GET /api/v1/clients/:clientId/units ─────────────────────────────────────
// Returns distinct units with per-category account counts, plus an unassigned row.

unitsRouter.get('/', async (req: AuthRequest, res: Response): Promise<void> => {
  const clientId = Number(req.params.clientId);
  if (isNaN(clientId)) {
    res.status(400).json({ data: null, error: { code: 'INVALID_ID', message: 'Invalid client ID' } });
    return;
  }

  try {
    const rows = await db('chart_of_accounts')
      .where({ client_id: clientId, is_active: true })
      .select('unit', 'category')
      .orderBy('unit', 'asc');

    // Group by unit
    const unitMap = new Map<string | null, Record<string, number>>();
    for (const r of rows as { unit: string | null; category: string }[]) {
      const key = r.unit ?? null;
      if (!unitMap.has(key)) unitMap.set(key, { assets: 0, liabilities: 0, equity: 0, revenue: 0, expenses: 0 });
      const counts = unitMap.get(key)!;
      if (r.category in counts) counts[r.category]++;
    }

    const data = [...unitMap.entries()]
      .sort((a, b) => {
        if (a[0] === null) return 1;  // unassigned last
        if (b[0] === null) return -1;
        return a[0].localeCompare(b[0]);
      })
      .map(([unit, counts]) => ({
        unit,
        total: Object.values(counts).reduce((s, n) => s + n, 0),
        ...counts,
      }));

    res.json({ data, error: null });
  } catch (err: unknown) {
    res.status(500).json({ data: null, error: { code: 'SERVER_ERROR', message: (err as Error).message } });
  }
});

// ─── GET /api/v1/clients/:clientId/units/:unit/accounts ──────────────────────
// Accounts for a specific unit (or "unassigned" for null)

unitsRouter.get('/:unit/accounts', async (req: AuthRequest, res: Response): Promise<void> => {
  const clientId = Number(req.params.clientId);
  const unitParam = req.params.unit === '__unassigned__' ? null : req.params.unit;
  if (isNaN(clientId)) {
    res.status(400).json({ data: null, error: { code: 'INVALID_ID', message: 'Invalid client ID' } });
    return;
  }

  try {
    const q = db('chart_of_accounts').where({ client_id: clientId, is_active: true });
    if (unitParam === null) q.whereNull('unit'); else q.where({ unit: unitParam });
    const accounts = await q.orderBy('account_number', 'asc');
    res.json({ data: accounts, error: null });
  } catch (err: unknown) {
    res.status(500).json({ data: null, error: { code: 'SERVER_ERROR', message: (err as Error).message } });
  }
});

// ─── POST /api/v1/clients/:clientId/units/rename ─────────────────────────────

unitsRouter.post('/rename', async (req: AuthRequest, res: Response): Promise<void> => {
  const clientId = Number(req.params.clientId);
  const schema = z.object({ from: z.string().min(1), to: z.string().min(1).max(100) });
  const parsed = schema.safeParse(req.body);
  if (isNaN(clientId) || !parsed.success) {
    res.status(400).json({ data: null, error: { code: 'VALIDATION_ERROR', message: parsed.success ? 'Invalid client ID' : parsed.error.message } });
    return;
  }
  try {
    const count = await db('chart_of_accounts')
      .where({ client_id: clientId, unit: parsed.data.from })
      .update({ unit: parsed.data.to, updated_at: db.fn.now() });
    res.json({ data: { updated: count }, error: null });
  } catch (err: unknown) {
    res.status(500).json({ data: null, error: { code: 'SERVER_ERROR', message: (err as Error).message } });
  }
});

// ─── POST /api/v1/clients/:clientId/units/merge ──────────────────────────────

unitsRouter.post('/merge', async (req: AuthRequest, res: Response): Promise<void> => {
  const clientId = Number(req.params.clientId);
  const schema = z.object({ from: z.string().min(1), into: z.string().min(1) });
  const parsed = schema.safeParse(req.body);
  if (isNaN(clientId) || !parsed.success) {
    res.status(400).json({ data: null, error: { code: 'VALIDATION_ERROR', message: parsed.success ? 'Invalid client ID' : parsed.error.message } });
    return;
  }
  try {
    const count = await db('chart_of_accounts')
      .where({ client_id: clientId, unit: parsed.data.from })
      .update({ unit: parsed.data.into, updated_at: db.fn.now() });
    res.json({ data: { updated: count }, error: null });
  } catch (err: unknown) {
    res.status(500).json({ data: null, error: { code: 'SERVER_ERROR', message: (err as Error).message } });
  }
});

// ─── POST /api/v1/clients/:clientId/units/clear ──────────────────────────────

unitsRouter.post('/clear', async (req: AuthRequest, res: Response): Promise<void> => {
  const clientId = Number(req.params.clientId);
  const schema = z.object({ unit: z.string().min(1) });
  const parsed = schema.safeParse(req.body);
  if (isNaN(clientId) || !parsed.success) {
    res.status(400).json({ data: null, error: { code: 'VALIDATION_ERROR', message: parsed.success ? 'Invalid client ID' : parsed.error.message } });
    return;
  }
  try {
    const count = await db('chart_of_accounts')
      .where({ client_id: clientId, unit: parsed.data.unit })
      .update({ unit: null, updated_at: db.fn.now() });
    res.json({ data: { updated: count }, error: null });
  } catch (err: unknown) {
    res.status(500).json({ data: null, error: { code: 'SERVER_ERROR', message: (err as Error).message } });
  }
});

// ─── POST /api/v1/clients/:clientId/units/bulk-assign ────────────────────────
// Assign a list of account IDs to a unit (or null to unassign)

unitsRouter.post('/bulk-assign', async (req: AuthRequest, res: Response): Promise<void> => {
  const clientId = Number(req.params.clientId);
  const schema = z.object({
    accountIds: z.array(z.number().int()).min(1),
    unit: z.string().max(100).nullable(),
  });
  const parsed = schema.safeParse(req.body);
  if (isNaN(clientId) || !parsed.success) {
    res.status(400).json({ data: null, error: { code: 'VALIDATION_ERROR', message: parsed.success ? 'Invalid client ID' : parsed.error.message } });
    return;
  }
  try {
    const count = await db('chart_of_accounts')
      .where({ client_id: clientId })
      .whereIn('id', parsed.data.accountIds)
      .update({ unit: parsed.data.unit, updated_at: db.fn.now() });
    res.json({ data: { updated: count }, error: null });
  } catch (err: unknown) {
    res.status(500).json({ data: null, error: { code: 'SERVER_ERROR', message: (err as Error).message } });
  }
});

// ─── POST /api/v1/clients/:clientId/units/clone ──────────────────────────────
// Create a new unit by copying accounts from an existing unit.
// Returns a preview (dry run) when dryRun=true.

unitsRouter.post('/clone', async (req: AuthRequest, res: Response): Promise<void> => {
  const clientId = Number(req.params.clientId);
  const schema = z.object({
    sourceUnit: z.string().min(1),
    newUnit: z.string().min(1).max(100),
    strategy: z.enum(['prefix', 'suffix', 'same']),
    strategyValue: z.string().max(20).default(''),
    dryRun: z.boolean().default(false),
  });
  const parsed = schema.safeParse(req.body);
  if (isNaN(clientId) || !parsed.success) {
    res.status(400).json({ data: null, error: { code: 'VALIDATION_ERROR', message: parsed.success ? 'Invalid client ID' : parsed.error.message } });
    return;
  }

  const { sourceUnit, newUnit, strategy, strategyValue, dryRun } = parsed.data;

  try {
    // Fetch source accounts
    const sourceAccounts = await db('chart_of_accounts')
      .where({ client_id: clientId, unit: sourceUnit, is_active: true })
      .orderBy('account_number', 'asc');

    if (sourceAccounts.length === 0) {
      res.status(404).json({ data: null, error: { code: 'NOT_FOUND', message: `No accounts found for unit "${sourceUnit}"` } });
      return;
    }

    // Build preview rows
    const preview = (sourceAccounts as Record<string, unknown>[]).map((a) => ({
      sourceNumber: a.account_number as string,
      newNumber: applyStrategy(a.account_number as string, strategy, strategyValue),
      accountName: a.account_name as string,
      category: a.category as string,
    }));

    // Check for duplicate account numbers
    const newNumbers = preview.map((p) => p.newNumber);
    const existingRows = await db('chart_of_accounts')
      .where({ client_id: clientId, is_active: true })
      .whereIn('account_number', newNumbers)
      .select('account_number');
    const duplicates = (existingRows as { account_number: string }[]).map((r) => r.account_number);

    if (dryRun || duplicates.length > 0) {
      res.json({
        data: {
          preview: preview.map((p) => ({ ...p, duplicate: duplicates.includes(p.newNumber) })),
          duplicateCount: duplicates.length,
          wouldInsert: sourceAccounts.length - duplicates.length,
        },
        error: null,
      });
      return;
    }

    // Insert new accounts
    const inserts = (sourceAccounts as Record<string, unknown>[]).map((a) => ({
      client_id: clientId,
      account_number: applyStrategy(a.account_number as string, strategy, strategyValue),
      account_name: a.account_name,
      category: a.category,
      subcategory: a.subcategory,
      normal_balance: a.normal_balance,
      tax_line: a.tax_line,
      tax_code_id: a.tax_code_id,
      workpaper_ref: a.workpaper_ref,
      unit: newUnit,
      is_active: true,
    }));

    await db('chart_of_accounts').insert(inserts);

    res.status(201).json({ data: { inserted: inserts.length }, error: null });
  } catch (err: unknown) {
    res.status(500).json({ data: null, error: { code: 'SERVER_ERROR', message: (err as Error).message } });
  }
});

// ─── POST /api/v1/clients/:clientId/units/clone-selected ─────────────────────
// Create a new unit by copying a user-selected list of accounts (by ID).
// Returns a preview (dry run) when dryRun=true.

unitsRouter.post('/clone-selected', async (req: AuthRequest, res: Response): Promise<void> => {
  const clientId = Number(req.params.clientId);
  const schema = z.object({
    accountIds: z.array(z.number().int()).min(1),
    newUnit: z.string().min(1).max(100),
    strategy: z.enum(['prefix', 'suffix', 'same']),
    strategyValue: z.string().max(20).default(''),
    dryRun: z.boolean().default(false),
  });
  const parsed = schema.safeParse(req.body);
  if (isNaN(clientId) || !parsed.success) {
    res.status(400).json({ data: null, error: { code: 'VALIDATION_ERROR', message: parsed.success ? 'Invalid client ID' : parsed.error.message } });
    return;
  }

  const { accountIds, newUnit, strategy, strategyValue, dryRun } = parsed.data;

  try {
    const sourceAccounts = await db('chart_of_accounts')
      .where({ client_id: clientId, is_active: true })
      .whereIn('id', accountIds)
      .orderBy('account_number', 'asc');

    if (sourceAccounts.length === 0) {
      res.status(404).json({ data: null, error: { code: 'NOT_FOUND', message: 'No matching accounts found' } });
      return;
    }

    const preview = (sourceAccounts as Record<string, unknown>[]).map((a) => ({
      sourceNumber: a.account_number as string,
      newNumber: applyStrategy(a.account_number as string, strategy, strategyValue),
      accountName: a.account_name as string,
      category: a.category as string,
    }));

    const newNumbers = preview.map((p) => p.newNumber);
    const existingRows = await db('chart_of_accounts')
      .where({ client_id: clientId, is_active: true })
      .whereIn('account_number', newNumbers)
      .select('account_number');
    const duplicates = (existingRows as { account_number: string }[]).map((r) => r.account_number);

    if (dryRun || duplicates.length > 0) {
      res.json({
        data: {
          preview: preview.map((p) => ({ ...p, duplicate: duplicates.includes(p.newNumber) })),
          duplicateCount: duplicates.length,
          wouldInsert: sourceAccounts.length - duplicates.length,
        },
        error: null,
      });
      return;
    }

    const inserts = (sourceAccounts as Record<string, unknown>[]).map((a) => ({
      client_id: clientId,
      account_number: applyStrategy(a.account_number as string, strategy, strategyValue),
      account_name: a.account_name,
      category: a.category,
      subcategory: a.subcategory,
      normal_balance: a.normal_balance,
      tax_line: a.tax_line,
      tax_code_id: a.tax_code_id,
      workpaper_ref: a.workpaper_ref,
      unit: newUnit,
      is_active: true,
    }));

    await db('chart_of_accounts').insert(inserts);

    res.status(201).json({ data: { inserted: inserts.length }, error: null });
  } catch (err: unknown) {
    res.status(500).json({ data: null, error: { code: 'SERVER_ERROR', message: (err as Error).message } });
  }
});
