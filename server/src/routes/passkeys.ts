// Copyright 2025-2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Use is limited to qualifying small businesses. See LICENSE for terms.

/**
 * Passkeys (WebAuthn). Mounted under /api/v1/auth.
 *   /passkeys/register/*   add a passkey (full or enrol token, password step-up)
 *   /passkeys, /passkeys/:id   list / rename / remove
 *   /passkeys/login/*      usernameless sign-in — public, mints a full token
 */

import { Router, Request, Response } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import type { AuthenticationResponseJSON, RegistrationResponseJSON } from '@simplewebauthn/server';
import { db } from '../db';
import { authMiddleware, AuthRequest, assertStage } from '../middleware/auth';
import { sendServerError } from '../lib/safeError';
import { logAudit } from '../lib/periodGuard';
import { assertCurrentPassword } from '../lib/stepUp';
import { securitySettings } from '../lib/securitySettings';
import { getRelyingParty } from '../lib/publicUrl';
import { rateLimitKey } from '../lib/rateLimitKey';
import {
  beginAuthentication,
  beginRegistration,
  finishAuthentication,
  finishRegistration,
  passkeyToJson,
  type PasskeyRow,
} from '../lib/passkeyCeremony';
import {
  USER_ROW_COLUMNS,
  loadUserFactors,
  publicUser,
  signFullToken,
  type UserRow,
} from '../lib/sessionTokens';

export const passkeysRouter = Router();

const perUserLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: rateLimitKey,
  message: { data: null, error: { code: 'RATE_LIMITED', message: 'Too many attempts. Please wait 15 minutes.' } },
});

const loginOptionsLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { data: null, error: { code: 'RATE_LIMITED', message: 'Too many attempts. Please try again later.' } },
});

const loginVerifyLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { data: null, error: { code: 'RATE_LIMITED', message: 'Too many login attempts. Please try again later.' } },
});

function unavailable(res: Response): boolean {
  const rp = getRelyingParty();
  if (rp.ok) return false;
  res.status(503).json({ data: null, error: { code: 'PASSKEYS_UNAVAILABLE', message: rp.reason } });
  return true;
}

const isCredentialJson = (v: unknown): boolean => !!v && typeof v === 'object' && typeof (v as { id?: unknown }).id === 'string';

// ── Registration ─────────────────────────────────────────────────────────────

const registerOptionsSchema = z.object({ currentPassword: z.string().min(1) });

// POST /api/v1/auth/passkeys/register/options
passkeysRouter.post('/passkeys/register/options', perUserLimiter, authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  if (!assertStage(req, res, 'full-or-enrol')) return;
  const parsed = registerOptionsSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ data: null, error: { code: 'VALIDATION_ERROR', message: 'Your current password is required.' } });
    return;
  }
  if (unavailable(res)) return;
  try {
    const userId = req.user!.userId;
    if (!(await assertCurrentPassword(userId, parsed.data.currentPassword, res))) return;
    const user = await db('app_users').where({ id: userId, is_active: true }).first('id', 'username', 'display_name');
    if (!user) {
      res.status(404).json({ data: null, error: { code: 'NOT_FOUND', message: 'User not found' } });
      return;
    }
    const data = await beginRegistration(user as { id: number; username: string; display_name: string | null });
    res.json({ data, error: null });
  } catch (err: unknown) {
    sendServerError(res, err, 'auth/passkeys');
  }
});

const registerVerifySchema = z.object({
  challengeId: z.string().min(1).max(128),
  response: z.custom<RegistrationResponseJSON>(isCredentialJson),
  name: z.string().trim().min(1).max(64).optional(),
});

// POST /api/v1/auth/passkeys/register/verify
passkeysRouter.post('/passkeys/register/verify', perUserLimiter, authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  if (!assertStage(req, res, 'full-or-enrol')) return;
  const parsed = registerVerifySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ data: null, error: { code: 'VALIDATION_ERROR', message: 'A challenge id and a passkey response are required.' } });
    return;
  }
  try {
    const userId = req.user!.userId;
    const name = parsed.data.name ?? `Passkey ${new Date().toISOString().slice(0, 10)}`;
    const outcome = await finishRegistration({ userId, challengeId: parsed.data.challengeId, response: parsed.data.response, name });
    if (!outcome.ok) {
      const status = outcome.code === 'PASSKEYS_UNAVAILABLE' ? 503 : outcome.code === 'PASSKEY_EXISTS' ? 409 : 400;
      res.status(status).json({ data: null, error: { code: outcome.code, message: outcome.message } });
      return;
    }
    await logAudit({ userId, periodId: null, entityType: 'user', entityId: userId, action: 'passkey_added', description: `User "${req.user!.username}" added passkey "${name}"` });

    const user = (await db('app_users').where({ id: userId, is_active: true }).select(...USER_ROW_COLUMNS).first()) as UserRow;
    const factors = await loadUserFactors(userId);
    const token = req.user!.stage === 'enrol' ? signFullToken(user) : null;
    res.status(201).json({ data: { passkey: passkeyToJson(outcome.passkey), token, user: publicUser(user, factors) }, error: null });
  } catch (err: unknown) {
    sendServerError(res, err, 'auth/passkeys');
  }
});

// ── Management ───────────────────────────────────────────────────────────────

// GET /api/v1/auth/passkeys
passkeysRouter.get('/passkeys', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  if (!assertStage(req, res, 'full-or-enrol')) return;
  try {
    const rows = (await db('user_passkeys').where({ user_id: req.user!.userId }).orderBy('created_at', 'asc').select('*')) as PasskeyRow[];
    res.json({ data: rows.map(passkeyToJson), error: null });
  } catch (err: unknown) {
    sendServerError(res, err, 'auth/passkeys');
  }
});

const renameSchema = z.object({ name: z.string().trim().min(1).max(64) });

// PATCH /api/v1/auth/passkeys/:id
passkeysRouter.patch('/passkeys/:id', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  if (!assertStage(req, res, 'full')) return;
  const id = Number(req.params.id);
  const parsed = renameSchema.safeParse(req.body);
  if (!Number.isInteger(id) || !parsed.success) {
    res.status(400).json({ data: null, error: { code: 'VALIDATION_ERROR', message: 'A name of 1–64 characters is required.' } });
    return;
  }
  try {
    const [row] = await db('user_passkeys').where({ id, user_id: req.user!.userId }).update({ name: parsed.data.name }).returning('*');
    if (!row) {
      res.status(404).json({ data: null, error: { code: 'NOT_FOUND', message: 'Passkey not found' } });
      return;
    }
    res.json({ data: passkeyToJson(row as PasskeyRow), error: null });
  } catch (err: unknown) {
    sendServerError(res, err, 'auth/passkeys');
  }
});

const deleteSchema = z.object({ currentPassword: z.string().min(1) });

// DELETE /api/v1/auth/passkeys/:id
passkeysRouter.delete('/passkeys/:id', perUserLimiter, authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  if (!assertStage(req, res, 'full')) return;
  const id = Number(req.params.id);
  const parsed = deleteSchema.safeParse(req.body);
  if (!Number.isInteger(id) || !parsed.success) {
    res.status(400).json({ data: null, error: { code: 'VALIDATION_ERROR', message: 'Your current password is required.' } });
    return;
  }
  try {
    const userId = req.user!.userId;
    if (!(await assertCurrentPassword(userId, parsed.data.currentPassword, res))) return;
    const row = await db('user_passkeys').where({ id, user_id: userId }).first('id', 'name');
    if (!row) {
      res.status(404).json({ data: null, error: { code: 'NOT_FOUND', message: 'Passkey not found' } });
      return;
    }
    const factors = await loadUserFactors(userId);
    if (securitySettings().requireTwoFactor && !factors.hasTotp && factors.passkeyCount <= 1) {
      res.status(409).json({ data: null, error: { code: 'LAST_FACTOR_REQUIRED', message: 'Your firm requires two-factor authentication. Set up an authenticator app or another passkey before removing this one.' } });
      return;
    }
    await db('user_passkeys').where({ id }).delete();
    await logAudit({ userId, periodId: null, entityType: 'user', entityId: userId, action: 'passkey_removed', description: `User "${req.user!.username}" removed passkey "${row.name}"` });
    res.json({ data: { ok: true }, error: null });
  } catch (err: unknown) {
    sendServerError(res, err, 'auth/passkeys');
  }
});

// ── Usernameless sign-in (public) ────────────────────────────────────────────

// POST /api/v1/auth/passkeys/login/options
passkeysRouter.post('/passkeys/login/options', loginOptionsLimiter, async (_req: Request, res: Response): Promise<void> => {
  if (unavailable(res)) return;
  try {
    const data = await beginAuthentication('login', null);
    res.json({ data, error: null });
  } catch (err: unknown) {
    sendServerError(res, err, 'auth/passkeys');
  }
});

const loginVerifySchema = z.object({
  challengeId: z.string().min(1).max(128),
  response: z.custom<AuthenticationResponseJSON>(isCredentialJson),
});

// POST /api/v1/auth/passkeys/login/verify
passkeysRouter.post('/passkeys/login/verify', loginVerifyLimiter, async (req: Request, res: Response): Promise<void> => {
  const parsed = loginVerifySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ data: null, error: { code: 'VALIDATION_ERROR', message: 'A challenge id and a passkey response are required.' } });
    return;
  }
  try {
    const outcome = await finishAuthentication({ kind: 'login', userId: null, challengeId: parsed.data.challengeId, response: parsed.data.response });
    if (!outcome.ok) {
      const status = outcome.code === 'PASSKEYS_UNAVAILABLE' ? 503 : outcome.code === 'INVALID_CREDENTIALS' ? 401 : 400;
      res.status(status).json({ data: null, error: { code: outcome.code, message: outcome.message } });
      return;
    }
    const user = (await db('app_users').where({ id: outcome.userId, is_active: true }).select(...USER_ROW_COLUMNS).first()) as UserRow | undefined;
    if (!user) {
      res.status(401).json({ data: null, error: { code: 'INVALID_CREDENTIALS', message: 'That passkey is not registered here.' } });
      return;
    }
    await logAudit({ userId: user.id, periodId: null, entityType: 'user', entityId: user.id, action: 'login_passkey', description: `User "${user.username}" signed in with passkey "${outcome.passkey.name}"` });
    const factors = await loadUserFactors(user.id);
    // A passkey IS two factors; the enrolment requirement is satisfied by construction.
    res.json({ data: { stage: 'ok', token: signFullToken(user), methods: [], user: publicUser(user, factors) }, error: null });
  } catch (err: unknown) {
    sendServerError(res, err, 'auth/passkeys');
  }
});
