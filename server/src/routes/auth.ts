// Copyright 2025-2026 Kisaes LLC
// Licensed under the Elastic License 2.0 (ELv2); you may not use this file
// except in compliance with the Elastic License 2.0.
// See LICENSE file in the project root for full license text.

import { Router, Request, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { db } from '../db';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { JWT_SECRET, JWT_EXPIRY } from '../lib/jwtConfig';
import { sendServerError } from '../lib/safeError';

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
      { expiresIn: JWT_EXPIRY } as jwt.SignOptions,
    );

    res.json({
      data: {
        token,
        user: {
          id: user.id,
          username: user.username,
          displayName: user.display_name,
          role: user.role,
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
      .select('id', 'username', 'display_name', 'role')
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
        role: user.role,
      },
      error: null,
    });
  } catch (err: unknown) {
    sendServerError(res, err, 'auth');
  }
});

export default router;
