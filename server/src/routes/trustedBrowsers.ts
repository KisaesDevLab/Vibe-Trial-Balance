// Copyright 2025-2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Use is limited to qualifying small businesses. See LICENSE for terms.

/**
 * "Remembered" browsers — the rows behind the 30-day cookie. Mounted under
 * /api/v1/auth. Listing is part of GET /auth/two-factor; this file is revoke.
 */

import { Router, Response } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { db } from '../db';
import { authMiddleware, AuthRequest, assertStage } from '../middleware/auth';
import { sendServerError } from '../lib/safeError';
import { logAudit } from '../lib/periodGuard';
import { assertCurrentPassword } from '../lib/stepUp';
import { rateLimitKey } from '../lib/rateLimitKey';
import { parseCookieHeader } from '../lib/cookies';
import { TRUSTED_BROWSER_COOKIE, clearTrustedBrowserCookie, hashTrustedBrowserToken } from '../lib/trustedBrowser';
import { cookiesAreSecure } from '../lib/sessionTokens';

export const trustedBrowsersRouter = Router();

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: rateLimitKey,
  message: { data: null, error: { code: 'RATE_LIMITED', message: 'Too many attempts. Please wait 15 minutes.' } },
});

const bodySchema = z.object({ currentPassword: z.string().min(1) });

function currentHash(req: AuthRequest): string | null {
  const raw = parseCookieHeader(req.headers.cookie)[TRUSTED_BROWSER_COOKIE];
  return raw ? hashTrustedBrowserToken(raw) : null;
}

// DELETE /api/v1/auth/trusted-browsers  — revoke all
trustedBrowsersRouter.delete('/trusted-browsers', limiter, authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  if (!assertStage(req, res, 'full')) return;
  const parsed = bodySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ data: null, error: { code: 'VALIDATION_ERROR', message: 'Your current password is required.' } });
    return;
  }
  try {
    const userId = req.user!.userId;
    if (!(await assertCurrentPassword(userId, parsed.data.currentPassword, res))) return;
    const revoked = await db('trusted_browsers').where({ user_id: userId }).whereNull('revoked_at').update({ revoked_at: db.fn.now() });
    res.setHeader('Set-Cookie', clearTrustedBrowserCookie({ secure: cookiesAreSecure() }));
    await logAudit({ userId, periodId: null, entityType: 'user', entityId: userId, action: 'trusted_browser_revoked', description: `User "${req.user!.username}" revoked all ${revoked} remembered browser(s)` });
    res.json({ data: { revoked }, error: null });
  } catch (err: unknown) {
    sendServerError(res, err, 'auth/trusted-browsers');
  }
});

// DELETE /api/v1/auth/trusted-browsers/:id
trustedBrowsersRouter.delete('/trusted-browsers/:id', limiter, authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  if (!assertStage(req, res, 'full')) return;
  const id = Number(req.params.id);
  const parsed = bodySchema.safeParse(req.body);
  if (!Number.isInteger(id) || !parsed.success) {
    res.status(400).json({ data: null, error: { code: 'VALIDATION_ERROR', message: 'Your current password is required.' } });
    return;
  }
  try {
    const userId = req.user!.userId;
    if (!(await assertCurrentPassword(userId, parsed.data.currentPassword, res))) return;
    const row = await db('trusted_browsers').where({ id, user_id: userId }).whereNull('revoked_at').first('id', 'token_hash');
    if (!row) {
      res.status(404).json({ data: null, error: { code: 'NOT_FOUND', message: 'Remembered browser not found' } });
      return;
    }
    await db('trusted_browsers').where({ id }).update({ revoked_at: db.fn.now() });
    if (row.token_hash === currentHash(req)) {
      res.setHeader('Set-Cookie', clearTrustedBrowserCookie({ secure: cookiesAreSecure() }));
    }
    await logAudit({ userId, periodId: null, entityType: 'user', entityId: userId, action: 'trusted_browser_revoked', description: `User "${req.user!.username}" revoked a remembered browser` });
    res.json({ data: { ok: true }, error: null });
  } catch (err: unknown) {
    sendServerError(res, err, 'auth/trusted-browsers');
  }
});
