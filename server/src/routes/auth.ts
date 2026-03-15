import { Router, Request, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { db } from '../db';
import { authMiddleware, AuthRequest } from '../middleware/auth';

const router = Router();

const JWT_SECRET = process.env.JWT_SECRET ?? 'local-dev-secret-12345';
const JWT_EXPIRY = process.env.JWT_EXPIRY ?? '8h';

const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

router.post('/login', async (req: Request, res: Response): Promise<void> => {
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
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ data: null, error: { code: 'SERVER_ERROR', message } });
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
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ data: null, error: { code: 'SERVER_ERROR', message } });
  }
});

export default router;
