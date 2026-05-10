// Copyright 2025-2026 Kisaes LLC
// Licensed under the PolyForm Internal Use License 1.0.0.
// You may not distribute this software. See LICENSE for terms.

import { Router, Request, Response } from 'express';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { db } from '../db';
import { invalidateAuthCache } from '../middleware/auth';
import { sendServerError } from '../lib/safeError';
import { passwordSchema } from '../lib/passwordPolicy';
import { logAudit } from '../lib/periodGuard';
import { getMailer } from '../lib/mailService';

const router = Router();

// Tokens are valid for 30 minutes from issue. Short enough that a leaked
// inbox is low-impact, long enough that a user can finish the flow without
// rushing.
const TOKEN_TTL_MS = 30 * 60 * 1000;

// 5 reset requests per hour per IP. Stops abuse without blocking legitimate
// retries (typo'd email, didn't get the email).
const requestLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    data: null,
    error: { code: 'RATE_LIMITED', message: 'Too many reset requests. Please try again later.' },
  },
});

// Verify and confirm endpoints are GET-ish — they're only useful with a
// valid token, but we still rate-limit to thwart token guessing.
const verifyLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    data: null,
    error: { code: 'RATE_LIMITED', message: 'Too many attempts. Please try again later.' },
  },
});

const requestSchema = z.object({
  identifier: z.string().min(1).max(320),
});

const verifySchema = z.object({
  token: z.string().min(1).max(128),
});

const confirmSchema = z.object({
  token: z.string().min(1).max(128),
  newPassword: passwordSchema,
});

function hashToken(raw: string): string {
  return crypto.createHash('sha256').update(raw).digest('hex');
}

function buildResetUrl(rawToken: string): string {
  // Match the existing convention used elsewhere: prefer APP_BASE_URL, fall
  // back to the first ALLOWED_ORIGIN entry, then localhost for dev.
  const allowedFirst = (process.env.ALLOWED_ORIGIN || '').split(',')[0]?.trim();
  const base = (process.env.APP_BASE_URL?.trim() || allowedFirst || 'http://localhost:5173').replace(/\/$/, '');
  return `${base}/password-reset/confirm?token=${encodeURIComponent(rawToken)}`;
}

function buildResetEmail(displayName: string, link: string): { subject: string; html: string; text: string } {
  const subject = 'Reset your Vibe TB password';
  const text = [
    `Hi ${displayName},`,
    '',
    'We received a request to reset your Vibe TB password.',
    '',
    `Reset link (valid for 30 minutes):`,
    link,
    '',
    `If you didn't request this, you can ignore this email — your password will not change.`,
  ].join('\n');
  const html = `
    <p>Hi ${escapeHtml(displayName)},</p>
    <p>We received a request to reset your Vibe TB password.</p>
    <p>
      <a href="${escapeAttr(link)}" style="display:inline-block;background:#2563eb;color:#fff;padding:10px 18px;border-radius:6px;text-decoration:none;font-weight:500">
        Reset password
      </a>
    </p>
    <p style="color:#555;font-size:13px">Or paste this link into your browser (valid for 30 minutes):<br><span style="word-break:break-all">${escapeHtml(link)}</span></p>
    <p style="color:#555;font-size:13px">If you didn't request this, you can ignore this email — your password will not change.</p>
  `;
  return { subject, html, text };
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));
}
function escapeAttr(s: string): string {
  return escapeHtml(s);
}

// POST /password-reset/request
// Always returns 200 with a generic success message — never leaks whether
// the identifier matched a real user, prevents enumeration.
router.post('/password-reset/request', requestLimiter, async (req: Request, res: Response): Promise<void> => {
  const parsed = requestSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ data: null, error: { code: 'VALIDATION_ERROR', message: 'Identifier required.' } });
    return;
  }
  const identifier = parsed.data.identifier.trim();
  const requesterIp = (req.ip ?? req.socket?.remoteAddress ?? null) as string | null;

  try {
    // Look up by username OR email (case-insensitive). Active users only.
    const user = await db('app_users')
      .whereRaw('LOWER(username) = LOWER(?)', [identifier])
      .orWhereRaw('LOWER(email) = LOWER(?)', [identifier])
      .andWhere({ is_active: true })
      .first('id', 'username', 'display_name', 'email');

    if (user && user.email) {
      const rawToken = crypto.randomBytes(32).toString('hex');
      const tokenHash = hashToken(rawToken);
      const expiresAt = new Date(Date.now() + TOKEN_TTL_MS);

      // Invalidate any prior unconsumed tokens for this user, then insert the new one.
      await db.transaction(async (trx) => {
        await trx('password_reset_tokens')
          .where({ user_id: user.id, consumed_at: null })
          .update({ consumed_at: trx.fn.now() });
        await trx('password_reset_tokens').insert({
          user_id: user.id,
          token_hash: tokenHash,
          expires_at: expiresAt,
          requester_ip: requesterIp,
        });
      });

      // Audit log even if mailer is null — this is still a request.
      await logAudit({
        userId: null,
        periodId: null,
        entityType: 'user',
        entityId: user.id,
        action: 'password_reset_requested',
        description: `Password reset requested for "${user.username}"`,
      });

      const mailer = await getMailer();
      if (mailer) {
        const link = buildResetUrl(rawToken);
        const { subject, html, text } = buildResetEmail(user.display_name || user.username, link);
        try {
          await mailer.send({ to: user.email, subject, html, text });
        } catch (err) {
          console.error('[password-reset] mail send failed:', (err as Error).message);
          // Still return 200 — don't leak send-failure state.
        }
      } else {
        console.warn('[password-reset] mail transport not configured — request silently no-op');
      }
    }
  } catch (err: unknown) {
    // Even on error we return the same generic message, but log the cause.
    console.error('[password-reset] request error:', (err as Error).message);
  }

  res.json({
    data: {
      ok: true,
      message: 'If an account matches, a reset link has been sent. Check your inbox (and spam) within 30 minutes.',
    },
    error: null,
  });
});

// POST /password-reset/verify — preflight used by the confirm page to gate
// the new-password form. Returns { valid: boolean, reason? } so the UI can
// show a meaningful error before the user types a password.
router.post('/password-reset/verify', verifyLimiter, async (req: Request, res: Response): Promise<void> => {
  const parsed = verifySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ data: null, error: { code: 'VALIDATION_ERROR', message: 'Token required.' } });
    return;
  }
  try {
    const tokenHash = hashToken(parsed.data.token);
    const row = await db('password_reset_tokens').where({ token_hash: tokenHash }).first();
    if (!row) {
      res.json({ data: { valid: false, reason: 'unknown' }, error: null });
      return;
    }
    if (row.consumed_at) {
      res.json({ data: { valid: false, reason: 'consumed' }, error: null });
      return;
    }
    if (new Date(row.expires_at).getTime() < Date.now()) {
      res.json({ data: { valid: false, reason: 'expired' }, error: null });
      return;
    }
    res.json({ data: { valid: true }, error: null });
  } catch (err: unknown) {
    sendServerError(res, err, 'password-reset/verify');
  }
});

// POST /password-reset/confirm — atomically rotate the password.
router.post('/password-reset/confirm', verifyLimiter, async (req: Request, res: Response): Promise<void> => {
  const parsed = confirmSchema.safeParse(req.body);
  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0]?.message ?? 'Password does not meet complexity requirements.';
    res.status(400).json({ data: null, error: { code: 'VALIDATION_ERROR', message: firstIssue } });
    return;
  }
  try {
    const tokenHash = hashToken(parsed.data.token);
    const newHash = await bcrypt.hash(parsed.data.newPassword, 12);

    let userId: number | null = null;
    let username: string | null = null;

    await db.transaction(async (trx) => {
      const tokenRow = await trx('password_reset_tokens')
        .where({ token_hash: tokenHash })
        .forUpdate()
        .first();
      if (!tokenRow) throw Object.assign(new Error('Invalid or expired reset link.'), { status: 400, code: 'INVALID_TOKEN' });
      if (tokenRow.consumed_at) throw Object.assign(new Error('This reset link has already been used.'), { status: 400, code: 'INVALID_TOKEN' });
      if (new Date(tokenRow.expires_at).getTime() < Date.now()) {
        throw Object.assign(new Error('This reset link has expired.'), { status: 400, code: 'INVALID_TOKEN' });
      }

      const user = await trx('app_users')
        .where({ id: tokenRow.user_id, is_active: true })
        .first('id', 'username');
      if (!user) throw Object.assign(new Error('Account is no longer active.'), { status: 400, code: 'INVALID_TOKEN' });

      userId = user.id;
      username = user.username;

      await trx('app_users').where({ id: user.id }).update({
        password_hash: newHash,
        must_change_password: false,
        email_verified_at: trx.fn.now(),
        updated_at: trx.fn.now(),
      });

      // Mark this token consumed and invalidate every other unconsumed token for this user.
      await trx('password_reset_tokens')
        .where({ user_id: user.id, consumed_at: null })
        .update({ consumed_at: trx.fn.now() });
    });

    if (userId !== null) {
      invalidateAuthCache(userId);
      await logAudit({
        userId: null,
        periodId: null,
        entityType: 'user',
        entityId: userId,
        action: 'password_reset_completed',
        description: `Password reset completed for "${username ?? userId}"`,
      });
    }

    res.json({ data: { ok: true }, error: null });
  } catch (err: unknown) {
    const e = err as { status?: number; code?: string; message?: string };
    if (e?.status && e?.code) {
      res.status(e.status).json({ data: null, error: { code: e.code, message: e.message ?? 'Reset failed.' } });
      return;
    }
    sendServerError(res, err, 'password-reset/confirm');
  }
});

export default router;
