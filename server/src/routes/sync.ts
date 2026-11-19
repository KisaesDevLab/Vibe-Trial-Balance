// Copyright 2025-2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Use is limited to qualifying small businesses. See LICENSE for terms.

/**
 * Desktop sync S2: pairing and the device routes.
 *
 *   POST /api/v1/sync/pair          public: a one-time code → a device token
 *   GET  /api/v1/sync/me            the device and the user it acts as
 *   GET  /api/v1/sync/clients       the clients a paired desktop may open (S3 widens it)
 *
 *   POST   /api/v1/desktop-sync/codes          (signed in) a code to pair a desktop
 *   GET    /api/v1/desktop-sync/devices        (signed in) my devices; an admin, everyone's with ?all=1
 *   DELETE /api/v1/desktop-sync/devices/:id    (signed in) revoke mine; an admin, anyone's
 *
 * A code is made from a signed-in session, so pairing works however that
 * session was made (password, passkey, single sign-on, `oidc_only` too): the
 * desktop never signs in itself.
 */

import { Router, type Response } from 'express';
import rateLimit from 'express-rate-limit';
import { db } from '../db';
import { authMiddleware, blockReviewerWrites, type AuthRequest } from '../middleware/auth';
import { logAudit } from '../lib/periodGuard';
import { sendServerError } from '../lib/safeError';
import {
  CODE_TTL_MS, formatCode, newDeviceToken, newPairingCode, normaliseCode, sha256, tidyDeviceName,
} from '../lib/sync/deviceTokens';
import { syncAuthMiddleware, type SyncRequest } from '../lib/sync/syncAuth';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const APP_VERSION = (require('../../package.json') as { version: string }).version;

const bad = (res: Response, status: number, code: string, message: string): void => {
  res.status(status).json({ data: null, error: { code, message } });
};

const CODE_REFUSED = 'That code is not right or has expired. Make a new one in Vibe Trial Balance › Settings › Desktop sync.';

/**
 * Pairing is public: 10 failed tries per 15 minutes per ADDRESS. Not `rateLimitKey`,
 * which groups by an unverified JWT claim: on a public route a guesser could
 * send a made-up token per request and get a fresh bucket each time.
 */
const pairLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => `ip:${req.ip ?? req.socket?.remoteAddress ?? 'unknown'}`,
  // Guesses are what it is for: a code that pairs does not use up a try.
  skipSuccessfulRequests: true,
  message: { data: null, error: { code: 'RATE_LIMITED', message: 'Too many pairing attempts. Wait a few minutes and try again.' } },
});

// ───────────────────────────────────────────────────────── /api/v1/sync

export const syncRouter = Router();

syncRouter.post('/pair', pairLimiter, async (req: AuthRequest, res: Response): Promise<void> => {
  const body = (req.body ?? {}) as { code?: unknown; deviceName?: unknown };
  const code = typeof body.code === 'string' ? normaliseCode(body.code) : null;
  const name = tidyDeviceName(body.deviceName);
  if (!name) {
    bad(res, 400, 'VALIDATION_ERROR', 'Give this computer a name (up to 100 characters).');
    return;
  }
  if (!code) {
    bad(res, 400, 'SYNC_CODE_INVALID', CODE_REFUSED);
    return;
  }
  try {
    const result = await db.transaction(async (trx) => {
      // One use: the row is locked, so two desktops typing the same code
      // cannot both pair.
      const row = await trx('sync_pairing_codes')
        .where({ code_hash: sha256(code) })
        .whereNull('used_at')
        .where('expires_at', '>', trx.fn.now())
        .forUpdate()
        .first('id', 'user_id');
      if (!row) return null;
      const user = await trx('app_users').where({ id: row.user_id, is_active: true }).first('id', 'username', 'display_name', 'role');
      if (!user) return null;
      const token = newDeviceToken();
      const [device] = await trx('sync_devices')
        .insert({ user_id: user.id, name, token_hash: sha256(token) })
        .returning(['id', 'name', 'created_at']);
      await trx('sync_pairing_codes').where({ id: row.id }).update({ used_at: trx.fn.now(), device_id: device.id });
      await logAudit({
        userId: user.id, periodId: null, entityType: 'sync_device', entityId: device.id, action: 'pair',
        description: `Paired desktop "${name}"`,
      }, trx);
      return { token, device, user };
    });
    if (!result) {
      bad(res, 400, 'SYNC_CODE_INVALID', CODE_REFUSED);
      return;
    }
    res.status(201).json({
      data: {
        token: result.token,
        device: { id: result.device.id, name: result.device.name, createdAt: result.device.created_at },
        user: { username: result.user.username, displayName: result.user.display_name ?? null, role: result.user.role },
        server: { appVersion: APP_VERSION },
      },
      error: null,
    });
  } catch (err: unknown) {
    sendServerError(res, err, 'sync/pair');
  }
});

// Everything else under /api/v1/sync is a paired device's.
syncRouter.use(syncAuthMiddleware, blockReviewerWrites);

syncRouter.get('/me', (req: SyncRequest, res: Response): void => {
  res.json({
    data: {
      device: req.syncDevice,
      user: { username: req.user!.username, role: req.user!.role },
      server: { appVersion: APP_VERSION },
    },
    error: null,
  });
});

syncRouter.get('/clients', async (_req: SyncRequest, res: Response): Promise<void> => {
  try {
    const rows = await db('clients')
      .orderBy('name')
      .select('sync_uid', 'name', 'client_code', 'entity_type', 'is_active');
    res.json({ data: rows, error: null, meta: { count: rows.length } });
  } catch (err: unknown) {
    sendServerError(res, err, 'sync/clients');
  }
});

// ───────────────────────────────────────────────────────── /api/v1/desktop-sync

export const desktopSyncRouter = Router();
desktopSyncRouter.use(authMiddleware);

desktopSyncRouter.post('/codes', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const code = newPairingCode();
    const expires = new Date(Date.now() + CODE_TTL_MS);
    await db.transaction(async (trx) => {
      // One live code per user: a new one retires the earlier, unused ones.
      await trx('sync_pairing_codes').where({ user_id: req.user!.userId }).whereNull('used_at').delete();
      // Unused codes that expired a day ago are of no use to anyone.
      await trx('sync_pairing_codes').whereNull('used_at').where('expires_at', '<', trx.raw("now() - interval '1 day'")).delete();
      await trx('sync_pairing_codes').insert({ user_id: req.user!.userId, code_hash: sha256(code), expires_at: expires });
    });
    await logAudit({
      userId: req.user!.userId, periodId: null, entityType: 'sync_device', action: 'pairing_code',
      description: 'Made a code to pair a desktop',
    });
    res.status(201).json({ data: { code: formatCode(code), expiresAt: expires.toISOString() }, error: null });
  } catch (err: unknown) {
    sendServerError(res, err, 'desktop-sync/codes');
  }
});

desktopSyncRouter.get('/devices', async (req: AuthRequest, res: Response): Promise<void> => {
  const all = req.query.all === '1' && req.user!.role === 'admin';
  try {
    const q = db('sync_devices as d')
      .join('app_users as u', 'u.id', 'd.user_id')
      .whereNull('d.revoked_at')
      .orderBy('d.created_at', 'desc')
      .select('d.id', 'd.name', 'd.created_at', 'd.last_used_at', 'u.username', 'u.display_name');
    if (!all) q.where('d.user_id', req.user!.userId);
    const rows = await q;
    res.json({
      data: rows.map((r) => ({
        id: r.id, name: r.name, createdAt: r.created_at, lastUsedAt: r.last_used_at,
        user: r.display_name ?? r.username,
      })),
      error: null,
      meta: { count: rows.length, all },
    });
  } catch (err: unknown) {
    sendServerError(res, err, 'desktop-sync/devices');
  }
});

desktopSyncRouter.delete('/devices/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    bad(res, 400, 'INVALID_ID', 'Invalid device id');
    return;
  }
  try {
    const device = await db('sync_devices').where({ id }).whereNull('revoked_at').first('id', 'user_id', 'name');
    // Someone else's device is "not found" to a non-admin, not "forbidden".
    if (!device || (device.user_id !== req.user!.userId && req.user!.role !== 'admin')) {
      bad(res, 404, 'NOT_FOUND', 'Device not found');
      return;
    }
    await db('sync_devices').where({ id }).update({ revoked_at: db.fn.now(), revoked_by: req.user!.userId });
    await logAudit({
      userId: req.user!.userId, periodId: null, entityType: 'sync_device', entityId: id, action: 'revoke',
      description: `Removed desktop "${device.name}"`,
    });
    res.json({ data: { id }, error: null });
  } catch (err: unknown) {
    sendServerError(res, err, 'desktop-sync/devices');
  }
});
