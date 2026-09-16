// Copyright 2025-2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Use is limited to qualifying small businesses. See LICENSE for terms.

/**
 * Authenticator-app (TOTP) enrolment and removal. Mounted under /api/v1/auth.
 *
 * Enrolment is two steps: /enrol/start writes a pending row (confirmed_at
 * NULL) and returns the secret + QR; /enrol/confirm proves the app has it by
 * accepting one code. A user holding an `enrol`-stage token gets a fresh full
 * token back from confirm, which is how forced enrolment ends.
 */

import { Router, Response } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import QRCode from 'qrcode';
import { db } from '../db';
import { authMiddleware, AuthRequest, assertStage } from '../middleware/auth';
import { sendServerError } from '../lib/safeError';
import { logAudit } from '../lib/periodGuard';
import { assertCurrentPassword } from '../lib/stepUp';
import { securitySettings } from '../lib/securitySettings';
import { rateLimitKey } from '../lib/rateLimitKey';
import {
  buildOtpauthUrl,
  decryptTotpSecret,
  encryptTotpSecret,
  generateTotpSecret,
  isReplay,
  verifyTotpCode,
} from '../lib/totp';
import {
  USER_ROW_COLUMNS,
  firmDisplayName,
  loadUserFactors,
  publicUser,
  signFullToken,
  type UserRow,
} from '../lib/sessionTokens';

export const totpRouter = Router();

const enrolLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: rateLimitKey,
  message: { data: null, error: { code: 'RATE_LIMITED', message: 'Too many attempts. Please wait 15 minutes.' } },
});

const startSchema = z.object({ currentPassword: z.string().min(1) });

// POST /api/v1/auth/totp/enrol/start
totpRouter.post('/totp/enrol/start', enrolLimiter, authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  if (!assertStage(req, res, 'full-or-enrol')) return;
  const parsed = startSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ data: null, error: { code: 'VALIDATION_ERROR', message: 'Your current password is required.' } });
    return;
  }
  try {
    const userId = req.user!.userId;
    if (!(await assertCurrentPassword(userId, parsed.data.currentPassword, res))) return;
    const existing = await db('user_totp').where({ user_id: userId }).first('confirmed_at');
    if (existing?.confirmed_at) {
      res.status(409).json({ data: null, error: { code: 'TOTP_ALREADY_ENABLED', message: 'An authenticator app is already set up. Turn it off first to set up a new one.' } });
      return;
    }
    const secret = generateTotpSecret();
    await db('user_totp')
      .insert({ user_id: userId, secret_enc: encryptTotpSecret(secret), confirmed_at: null, last_used_step: null })
      .onConflict('user_id')
      .merge({ secret_enc: encryptTotpSecret(secret), confirmed_at: null, last_used_step: null, updated_at: db.fn.now() });
    const otpauthUrl = buildOtpauthUrl({ issuer: await firmDisplayName(), label: req.user!.username, secret });
    const qrDataUrl = await QRCode.toDataURL(otpauthUrl, { margin: 1, width: 220 });
    res.json({ data: { secretBase32: secret, otpauthUrl, qrDataUrl }, error: null });
  } catch (err: unknown) {
    sendServerError(res, err, 'auth/totp');
  }
});

const confirmSchema = z.object({ code: z.string().min(1).max(16) });

// POST /api/v1/auth/totp/enrol/confirm
totpRouter.post('/totp/enrol/confirm', enrolLimiter, authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  if (!assertStage(req, res, 'full-or-enrol')) return;
  const parsed = confirmSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ data: null, error: { code: 'VALIDATION_ERROR', message: 'A verification code is required.' } });
    return;
  }
  try {
    const userId = req.user!.userId;
    const row = await db('user_totp').where({ user_id: userId }).first();
    if (!row || row.confirmed_at) {
      res.status(409).json({ data: null, error: { code: 'NO_PENDING_ENROLMENT', message: 'Start the authenticator setup first.' } });
      return;
    }
    const check = await verifyTotpCode({ secret: decryptTotpSecret(row.secret_enc as string), code: parsed.data.code });
    if (!check.valid) {
      res.status(400).json({ data: null, error: { code: 'INVALID_CODE', message: 'That code is not valid. Make sure the app shows the newest code and try again.' } });
      return;
    }
    await db('user_totp').where({ user_id: userId }).update({ confirmed_at: db.fn.now(), last_used_step: check.step, updated_at: db.fn.now() });
    await logAudit({ userId, periodId: null, entityType: 'user', entityId: userId, action: 'totp_enabled', description: `User "${req.user!.username}" set up an authenticator app` });

    // Forced enrolment ends here: hand back a full session.
    const user = (await db('app_users').where({ id: userId, is_active: true }).select(...USER_ROW_COLUMNS).first()) as UserRow;
    const factors = await loadUserFactors(userId);
    const token = req.user!.stage === 'enrol' ? signFullToken(user) : null;
    res.json({ data: { ok: true, token, user: publicUser(user, factors) }, error: null });
  } catch (err: unknown) {
    sendServerError(res, err, 'auth/totp');
  }
});

const disableSchema = z.object({ currentPassword: z.string().min(1), code: z.string().min(1).max(16) });

// DELETE /api/v1/auth/totp
totpRouter.delete('/totp', enrolLimiter, authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  if (!assertStage(req, res, 'full')) return;
  const parsed = disableSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ data: null, error: { code: 'VALIDATION_ERROR', message: 'Your current password and a verification code are required.' } });
    return;
  }
  try {
    const userId = req.user!.userId;
    if (!(await assertCurrentPassword(userId, parsed.data.currentPassword, res))) return;
    const row = await db('user_totp').where({ user_id: userId }).whereNotNull('confirmed_at').first();
    if (!row) {
      res.status(404).json({ data: null, error: { code: 'NOT_FOUND', message: 'No authenticator app is set up.' } });
      return;
    }
    const factors = await loadUserFactors(userId);
    if (securitySettings().requireTwoFactor && !factors.hasPasskey) {
      res.status(409).json({ data: null, error: { code: 'LAST_FACTOR_REQUIRED', message: 'Your firm requires two-factor authentication. Add a passkey before turning off the authenticator app.' } });
      return;
    }
    const check = await verifyTotpCode({ secret: decryptTotpSecret(row.secret_enc as string), code: parsed.data.code });
    if (!check.valid || isReplay(row.last_used_step as number | null, check.step!)) {
      res.status(400).json({ data: null, error: { code: 'INVALID_CODE', message: 'That code is not valid.' } });
      return;
    }
    await db.transaction(async (trx) => {
      await trx('user_totp').where({ user_id: userId }).delete();
      // The remembered browsers were minted by a factor that no longer exists.
      await trx('trusted_browsers').where({ user_id: userId }).whereNull('revoked_at').update({ revoked_at: trx.fn.now() });
    });
    await logAudit({ userId, periodId: null, entityType: 'user', entityId: userId, action: 'totp_disabled', description: `User "${req.user!.username}" turned off their authenticator app` });
    res.json({ data: { ok: true }, error: null });
  } catch (err: unknown) {
    sendServerError(res, err, 'auth/totp');
  }
});
