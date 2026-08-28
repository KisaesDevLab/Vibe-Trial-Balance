// Copyright 2025-2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Use is limited to qualifying small businesses. See LICENSE for terms.

/**
 * Document storage administration: provider settings, the folder template, and
 * client ↔ folder links.
 *
 * Kept out of settings.ts (already 1100+ lines) but follows its conventions
 * exactly — SENTINEL_KEEP for secrets, `hasX` booleans rather than values in
 * GET responses, and a /test probe that accepts unsaved form values.
 *
 * Everything here is admin-only and driven from the UI; nothing requires
 * editing .env or running a script.
 */

import { Router, Response, NextFunction } from 'express';
import { z } from 'zod';
import { db } from '../db';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { sendServerError } from '../lib/safeError';
import { logAudit } from '../lib/periodGuard';
import { encrypt } from '../lib/encryption';
import { B2StorageDriver, explainStorageError } from '../lib/storage/b2Driver';
import {
  DEFAULT_PREFIX,
  getStorageConfig,
  invalidateStorageCache,
  loadStorageConfig,
} from '../lib/storage';
import {
  createClientFolder,
  getInstallId,
  getLink,
  linkClientFolder,
  listUnboundFolders,
  suggestedFolderPath,
  unlinkClientFolder,
  verifyClientFolder,
} from '../lib/clientFolders';

export const storageRouter = Router();
storageRouter.use(authMiddleware);

function adminOnly(req: AuthRequest, res: Response, next: NextFunction): void {
  if (req.user?.role !== 'admin') {
    res.status(403).json({ data: null, error: { code: 'FORBIDDEN', message: 'Admin access required.' } });
    return;
  }
  next();
}

/** Same sentinel settings.ts uses: "leave the stored secret alone". */
const SECRET_KEEP = '__keep__';

const settingsSchema = z.object({
  provider: z.enum(['local', 'b2']),
  prefix: z.string().trim().max(100).optional(),
  b2Endpoint: z.string().trim().max(500).optional(),
  b2Region: z.string().trim().max(100).optional(),
  b2Bucket: z.string().trim().max(255).optional(),
  b2KeyId: z.string().max(500).optional(),
  b2ApplicationKey: z.string().max(500).optional(),
});

async function upsertSetting(key: string, value: string): Promise<void> {
  await db('settings')
    .insert({ key, value, updated_at: db.fn.now() })
    .onConflict('key')
    .merge({ value, updated_at: db.fn.now() });
}

async function readRaw(key: string): Promise<string | null> {
  const row = await db('settings').where({ key }).first('value');
  return (row?.value as string | undefined) ?? null;
}

// ─── GET /api/v1/storage/settings ────────────────────────────────────────────
// Secrets are reported only as booleans, never echoed back.

storageRouter.get('/settings', adminOnly, async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    const cfg = await loadStorageConfig();
    const [keyId, appKey, lastTested, lastError] = await Promise.all([
      readRaw('storage.b2_key_id'),
      readRaw('storage.b2_application_key'),
      readRaw('storage.last_tested_at'),
      readRaw('storage.last_test_error'),
    ]);
    res.json({
      data: {
        provider: cfg.provider,
        prefix: cfg.prefix || DEFAULT_PREFIX,
        b2: {
          endpoint: cfg.b2?.endpoint ?? '',
          region: cfg.b2?.region ?? '',
          bucket: cfg.b2?.bucket ?? '',
          hasKeyId: !!keyId,
          hasApplicationKey: !!appKey,
        },
        envOverride: cfg.envOverride,
        configError: cfg.configError ?? null,
        installId: await getInstallId(),
        lastTestedAt: lastTested,
        lastTestError: lastError,
      },
      error: null,
    });
  } catch (err: unknown) {
    sendServerError(res, err, 'storage/settings');
  }
});

// ─── PUT /api/v1/storage/settings ────────────────────────────────────────────

storageRouter.put('/settings', adminOnly, async (req: AuthRequest, res: Response): Promise<void> => {
  const parsed = settingsSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ data: null, error: { code: 'VALIDATION_ERROR', message: parsed.error.message } });
    return;
  }
  const d = parsed.data;
  try {
    const ops: Promise<void>[] = [
      upsertSetting('storage.provider', d.provider),
      upsertSetting('storage.prefix', d.prefix || DEFAULT_PREFIX),
    ];
    if (d.b2Endpoint !== undefined) ops.push(upsertSetting('storage.b2_endpoint', d.b2Endpoint));
    if (d.b2Region !== undefined) ops.push(upsertSetting('storage.b2_region', d.b2Region));
    if (d.b2Bucket !== undefined) ops.push(upsertSetting('storage.b2_bucket', d.b2Bucket));

    // Undefined or the sentinel leaves the stored secret alone; '' clears it.
    const writeSecret = (key: string, value: string | undefined): void => {
      if (value === undefined || value === SECRET_KEEP) return;
      ops.push(upsertSetting(key, value === '' ? '' : encrypt(value)));
    };
    writeSecret('storage.b2_key_id', d.b2KeyId);
    writeSecret('storage.b2_application_key', d.b2ApplicationKey);

    await Promise.all(ops);
    invalidateStorageCache();
    await logAudit({
      userId: req.user!.userId, periodId: null, entityType: 'setting', entityId: null,
      action: 'update', description: `Updated document storage settings (provider: ${d.provider})`,
    });

    const cfg = await getStorageConfig();
    res.json({ data: { ok: true, provider: cfg.provider, configError: cfg.configError ?? null }, error: null });
  } catch (err: unknown) {
    sendServerError(res, err, 'storage/settings');
  }
});

// ─── POST /api/v1/storage/settings/test ──────────────────────────────────────
// Accepts unsaved form values so an admin can validate before committing.

storageRouter.post('/settings/test', adminOnly, async (req: AuthRequest, res: Response): Promise<void> => {
  const parsed = settingsSchema.partial().safeParse(req.body ?? {});
  if (!parsed.success) {
    res.status(400).json({ data: null, error: { code: 'VALIDATION_ERROR', message: parsed.error.message } });
    return;
  }
  const started = Date.now();
  try {
    const stored = await loadStorageConfig();
    const d = parsed.data;
    const provider = d.provider ?? stored.provider;

    if (provider !== 'b2') {
      res.json({ data: { ok: true, provider: 'local', latencyMs: 0, message: 'Local disk needs no connection test.' }, error: null });
      return;
    }

    const keep = (supplied: string | undefined, current: string): string =>
      supplied === undefined || supplied === SECRET_KEEP ? current : supplied;

    const driver = new B2StorageDriver({
      endpoint: d.b2Endpoint ?? stored.b2?.endpoint ?? '',
      region: d.b2Region ?? stored.b2?.region ?? '',
      bucket: d.b2Bucket ?? stored.b2?.bucket ?? '',
      accessKeyId: keep(d.b2KeyId, stored.b2?.keyId ?? ''),
      secretAccessKey: keep(d.b2ApplicationKey, stored.b2?.applicationKey ?? ''),
      forcePathStyle: true,
      maxRetries: 2,
    });

    // list -> put -> head -> delete. list leads because it is a GET, so the SDK
    // can parse a real error body from it; a HEAD carries none and degrades to
    // a bare "UnknownError".
    const probeKey = `_vibe_health/probe-${Date.now()}.txt`;
    let drained = 0;
    for await (const _o of driver.list('_vibe_health/', { limit: 5 })) drained++;
    await driver.put(probeKey, Buffer.from('vibe-tb storage probe'), { contentType: 'text/plain' });
    const readBack = await driver.head(probeKey);
    if (!readBack) throw new Error('The probe object could not be read back immediately after writing.');
    await driver.delete(probeKey);

    const latencyMs = Date.now() - started;
    await upsertSetting('storage.last_tested_at', new Date().toISOString());
    await upsertSetting('storage.last_test_error', '');
    res.json({ data: { ok: true, provider: 'b2', latencyMs, listed: drained }, error: null });
  } catch (err: unknown) {
    const message = explainStorageError(err);
    await upsertSetting('storage.last_tested_at', new Date().toISOString()).catch(() => undefined);
    await upsertSetting('storage.last_test_error', message).catch(() => undefined);
    res.status(502).json({ data: null, error: { code: 'STORAGE_TEST_FAILED', message, meta: { latencyMs: Date.now() - started } } });
  }
});

// ─── Folder template ─────────────────────────────────────────────────────────

const templateSchema = z.object({
  sections: z.array(z.object({
    id: z.number().int().positive().optional(),
    name: z.string().trim().min(1).max(100),
    sortOrder: z.number().int(),
    isWorkpaperTarget: z.boolean(),
    isDefaultUpload: z.boolean(),
  })).min(1).max(50),
});

storageRouter.get('/folder-template', async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    const rows = await db('storage_folder_template').orderBy([{ column: 'sort_order', order: 'asc' }, { column: 'id', order: 'asc' }]);
    res.json({ data: rows, error: null });
  } catch (err: unknown) {
    sendServerError(res, err, 'storage/folder-template');
  }
});

storageRouter.put('/folder-template', adminOnly, async (req: AuthRequest, res: Response): Promise<void> => {
  const parsed = templateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ data: null, error: { code: 'VALIDATION_ERROR', message: parsed.error.message } });
    return;
  }
  const { sections } = parsed.data;

  // Exactly one of each flag. The DB enforces this too, but a clear message
  // beats a unique-violation.
  if (sections.filter((s) => s.isWorkpaperTarget).length !== 1) {
    res.status(400).json({ data: null, error: { code: 'VALIDATION_ERROR', message: 'Exactly one section must be the workpaper destination.' } });
    return;
  }
  if (sections.filter((s) => s.isDefaultUpload).length !== 1) {
    res.status(400).json({ data: null, error: { code: 'VALIDATION_ERROR', message: 'Exactly one section must be the default upload folder.' } });
    return;
  }

  try {
    await db.transaction(async (trx) => {
      const keepIds = sections.map((s) => s.id).filter((v): v is number => typeof v === 'number');
      if (keepIds.length > 0) await trx('storage_folder_template').whereNotIn('id', keepIds).delete();
      else await trx('storage_folder_template').delete();

      // Clear both flags first so the partial unique indexes can't trip
      // part-way through the rewrite.
      await trx('storage_folder_template').update({ is_workpaper_target: false, is_default_upload: false });

      for (const s of sections) {
        const row = {
          name: s.name,
          sort_order: s.sortOrder,
          is_workpaper_target: s.isWorkpaperTarget,
          is_default_upload: s.isDefaultUpload,
          updated_at: trx.fn.now(),
        };
        if (s.id) await trx('storage_folder_template').where({ id: s.id }).update(row);
        else await trx('storage_folder_template').insert(row);
      }
    });
    await logAudit({
      userId: req.user!.userId, periodId: null, entityType: 'setting', entityId: null,
      action: 'update', description: `Updated storage folder template (${sections.length} sections)`,
    });
    const rows = await db('storage_folder_template').orderBy('sort_order', 'asc');
    res.json({ data: rows, error: null });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : '';
    if (msg.includes('unique') || msg.includes('duplicate')) {
      res.status(409).json({ data: null, error: { code: 'DUPLICATE', message: 'Section names must be unique.' } });
      return;
    }
    sendServerError(res, err, 'storage/folder-template');
  }
});

// ─── Client folder links ─────────────────────────────────────────────────────

storageRouter.get('/links', adminOnly, async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    const rows = await db('clients as c')
      .leftJoin('client_folder_links as l', 'l.client_id', 'c.id')
      .where('c.is_active', true)
      .orderByRaw(`
        CASE
          WHEN l.id IS NULL THEN 0
          WHEN l.status <> 'active' THEN 1
          WHEN l.is_legacy_layout THEN 2
          ELSE 3
        END, c.name ASC
      `)
      .select(
        'c.id as client_id', 'c.name as client_name',
        'l.id as link_id', 'l.storage_backend', 'l.storage_path', 'l.sentinel_id',
        'l.is_legacy_layout', 'l.status', 'l.last_verified_at',
      );
    res.json({ data: rows, error: null, meta: { count: rows.length } });
  } catch (err: unknown) {
    sendServerError(res, err, 'storage/links');
  }
});

storageRouter.get('/unbound-folders', adminOnly, async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    res.json({ data: await listUnboundFolders(), error: null });
  } catch (err: unknown) {
    handleStorageError(err, res);
  }
});

storageRouter.get('/links/:clientId', async (req: AuthRequest, res: Response): Promise<void> => {
  const clientId = Number(req.params.clientId);
  if (isNaN(clientId)) { res.status(400).json({ data: null, error: { code: 'INVALID_ID', message: 'Invalid client ID' } }); return; }
  try {
    const link = await getLink(clientId);
    const client = await db('clients').where({ id: clientId }).first('id', 'name');
    res.json({
      data: {
        link,
        suggestedPath: client ? await suggestedFolderPath(clientId, client.name as string) : null,
      },
      error: null,
    });
  } catch (err: unknown) {
    handleStorageError(err, res);
  }
});

storageRouter.post('/links/:clientId/link', adminOnly, async (req: AuthRequest, res: Response): Promise<void> => {
  const clientId = Number(req.params.clientId);
  const parsed = z.object({ storagePath: z.string().trim().min(1).max(1024) }).safeParse(req.body);
  if (isNaN(clientId) || !parsed.success) {
    res.status(400).json({ data: null, error: { code: 'VALIDATION_ERROR', message: 'clientId and storagePath are required.' } });
    return;
  }
  try {
    const result = await linkClientFolder(clientId, parsed.data.storagePath, req.user!.userId);
    if (!result.ok) {
      res.status(409).json({ data: null, error: { code: result.code, message: result.message, boundToClientId: result.boundToClientId ?? null } });
      return;
    }
    await logAudit({
      userId: req.user!.userId, periodId: null, clientId, entityType: 'client_folder_link',
      entityId: result.link.id, action: 'create',
      description: `Linked client to storage folder ${result.link.storage_path}`,
    });
    res.status(result.idempotent ? 200 : 201).json({ data: result, error: null });
  } catch (err: unknown) {
    handleStorageError(err, res);
  }
});

storageRouter.post('/links/:clientId/create', adminOnly, async (req: AuthRequest, res: Response): Promise<void> => {
  const clientId = Number(req.params.clientId);
  const parsed = z.object({ folderName: z.string().trim().max(240).optional() }).safeParse(req.body ?? {});
  if (isNaN(clientId) || !parsed.success) {
    res.status(400).json({ data: null, error: { code: 'VALIDATION_ERROR', message: 'Invalid request.' } });
    return;
  }
  try {
    const result = await createClientFolder(clientId, parsed.data.folderName ?? null, req.user!.userId);
    if (!result.ok) {
      res.status(409).json({ data: null, error: { code: result.code, message: result.message } });
      return;
    }
    await logAudit({
      userId: req.user!.userId, periodId: null, clientId, entityType: 'client_folder_link',
      entityId: result.link.id, action: 'create',
      description: `Created storage folder ${result.link.storage_path}`,
    });
    res.status(201).json({ data: result, error: null });
  } catch (err: unknown) {
    handleStorageError(err, res);
  }
});

storageRouter.post('/links/:clientId/verify', adminOnly, async (req: AuthRequest, res: Response): Promise<void> => {
  const clientId = Number(req.params.clientId);
  if (isNaN(clientId)) { res.status(400).json({ data: null, error: { code: 'INVALID_ID', message: 'Invalid client ID' } }); return; }
  try {
    const result = await verifyClientFolder(clientId);
    if (result.rebound) {
      await logAudit({
        userId: req.user!.userId, periodId: null, clientId, entityType: 'client_folder_link',
        entityId: null, action: 'update',
        description: `Storage folder re-bound after rename: ${result.rebound.from} -> ${result.rebound.to}`,
      });
    }
    res.json({ data: result, error: null });
  } catch (err: unknown) {
    handleStorageError(err, res);
  }
});

storageRouter.delete('/links/:clientId', adminOnly, async (req: AuthRequest, res: Response): Promise<void> => {
  const clientId = Number(req.params.clientId);
  if (isNaN(clientId)) { res.status(400).json({ data: null, error: { code: 'INVALID_ID', message: 'Invalid client ID' } }); return; }
  try {
    const { removed } = await unlinkClientFolder(clientId);
    if (removed === 0) {
      res.status(404).json({ data: null, error: { code: 'NOT_FOUND', message: 'This client has no storage folder link.' } });
      return;
    }
    await logAudit({
      userId: req.user!.userId, periodId: null, clientId, entityType: 'client_folder_link',
      entityId: null, action: 'delete',
      description: 'Unlinked client from its storage folder (files left in place)',
    });
    res.json({ data: { removed }, error: null });
  } catch (err: unknown) {
    handleStorageError(err, res);
  }
});

/** StorageError carries its own status; anything else is a real 500. */
function handleStorageError(err: unknown, res: Response): void {
  const e = err as { name?: string; code?: string; status?: number; message?: string };
  if (e?.name === 'StorageError') {
    res.status(e.status ?? 500).json({
      data: null,
      error: { code: e.code ?? 'STORAGE_ERROR', message: explainStorageError(err) },
    });
    return;
  }
  sendServerError(res, err, 'storage');
}
