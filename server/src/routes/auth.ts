// Copyright 2025-2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Use is limited to qualifying small businesses. See LICENSE for terms.

import { Router, Request, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { db } from '../db';
import { authMiddleware, AuthRequest, invalidateAuthCache } from '../middleware/auth';
import { JWT_SECRET, JWT_EXPIRY } from '../lib/jwtConfig';
import { sendServerError } from '../lib/safeError';
import { passwordSchema } from '../lib/passwordPolicy';
import { logAudit } from '../lib/periodGuard';

const router = Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 attempts per window per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: { data: null, error: { code: 'RATE_LIMITED', message: 'Too many login attempts. Please try again later.' } },
});

const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

router.post('/login', loginLimiter, async (req: Request, res: Response): Promise<void> => {
  const result = loginSchema.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({
      data: null,
      error: { code: 'VALIDATION_ERROR', message: 'Username and password required' },
    });
    return;
  }

  const { username, password } = result.data;

  try {
    const user = await db('app_users').where({ username, is_active: true }).first();

    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      res.status(401).json({
        data: null,
        error: { code: 'INVALID_CREDENTIALS', message: 'Invalid username or password' },
      });
      return;
    }

    const token = jwt.sign(
      { userId: user.id, username: user.username, role: user.role },
      JWT_SECRET,
      { algorithm: 'HS256', expiresIn: JWT_EXPIRY } as jwt.SignOptions,
    );

    res.json({
      data: {
        token,
        user: {
          id: user.id,
          username: user.username,
          displayName: user.display_name,
          email: user.email ?? null,
          role: user.role,
          mustChangePassword: !!user.must_change_password,
        },
      },
      error: null,
    });
  } catch (err: unknown) {
    sendServerError(res, err, 'auth');
  }
});

router.get('/me', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = await db('app_users')
      .where({ id: req.user!.userId, is_active: true })
      .select('id', 'username', 'display_name', 'email', 'role', 'must_change_password')
      .first();

    if (!user) {
      res
        .status(404)
        .json({ data: null, error: { code: 'NOT_FOUND', message: 'User not found' } });
      return;
    }

    res.json({
      data: {
        id: user.id,
        username: user.username,
        displayName: user.display_name,
        email: user.email ?? null,
        role: user.role,
        mustChangePassword: !!user.must_change_password,
      },
      error: null,
    });
  } catch (err: unknown) {
    sendServerError(res, err, 'auth');
  }
});

// POST /api/v1/auth/change-password — any authenticated user can rotate their own
// password. Clears the must_change_password flag so the forced-rotation UI goes away.
const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: passwordSchema,
});

router.post('/change-password', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  const parsed = changePasswordSchema.safeParse(req.body);
  if (!parsed.success) {
    // Surface the first complexity violation so the user knows which rule failed
    // (uppercase / lowercase / digit / length). Zod returns these per-issue.
    const firstIssue = parsed.error.issues[0]?.message ?? 'Password does not meet complexity requirements.';
    res.status(400).json({
      data: null,
      error: { code: 'VALIDATION_ERROR', message: firstIssue },
    });
    return;
  }
  try {
    const me = await db('app_users').where({ id: req.user!.userId, is_active: true }).first();
    if (!me) {
      res.status(404).json({ data: null, error: { code: 'NOT_FOUND', message: 'User not found' } });
      return;
    }
    if (!(await bcrypt.compare(parsed.data.currentPassword, me.password_hash))) {
      res.status(401).json({ data: null, error: { code: 'INVALID_CREDENTIALS', message: 'Current password is incorrect.' } });
      return;
    }
    if (parsed.data.newPassword === parsed.data.currentPassword) {
      res.status(400).json({ data: null, error: { code: 'SAME_PASSWORD', message: 'New password must differ from the current one.' } });
      return;
    }
    const hash = await bcrypt.hash(parsed.data.newPassword, 12);
    await db('app_users').where({ id: me.id }).update({
      password_hash: hash,
      must_change_password: false,
    });
    invalidateAuthCache(me.id);
    await logAudit({ userId: me.id, periodId: null, entityType: 'user', entityId: me.id, action: 'update', description: `User "${me.username}" changed their own password` });
    res.json({ data: { ok: true }, error: null });
  } catch (err: unknown) {
    sendServerError(res, err, 'auth');
  }
});

export default router;
