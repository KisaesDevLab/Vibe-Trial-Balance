import { Router, Response, NextFunction } from 'express';
import { z } from 'zod';
import bcrypt from 'bcrypt';
import { db } from '../db';
import { authMiddleware, AuthRequest } from '../middleware/auth';

export const usersRouter = Router();
usersRouter.use(authMiddleware);

function adminOnly(req: AuthRequest, res: Response, next: NextFunction): void {
  if (req.user?.role !== 'admin') {
    res.status(403).json({ data: null, error: { code: 'FORBIDDEN', message: 'Admin access required.' } });
    return;
  }
  next();
}

const userSchema = z.object({
  username: z.string().min(2).max(100),
  displayName: z.string().min(1).max(255),
  password: z.string().min(6),
  role: z.enum(['admin', 'reviewer', 'preparer']),
});

// GET /api/v1/users
usersRouter.get('/', adminOnly, async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    const users = await db('app_users')
      .select('id', 'username', 'display_name', 'role', 'is_active', 'created_at', 'updated_at')
      .orderBy('display_name');
    res.json({ data: users, error: null, meta: { count: users.length } });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ data: null, error: { code: 'SERVER_ERROR', message } });
  }
});

// POST /api/v1/users
usersRouter.post('/', adminOnly, async (req: AuthRequest, res: Response): Promise<void> => {
  const parsed = userSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ data: null, error: { code: 'VALIDATION_ERROR', message: parsed.error.message } });
    return;
  }
  const { username, displayName, password, role } = parsed.data;

  try {
    const hash = await bcrypt.hash(password, 12);
    const [user] = await db('app_users').insert({
      username,
      display_name: displayName,
      password_hash: hash,
      role,
      is_active: true,
    }).returning(['id', 'username', 'display_name', 'role', 'is_active', 'created_at']);

    res.status(201).json({ data: user, error: null });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    if (message.includes('unique') || message.includes('duplicate')) {
      res.status(409).json({ data: null, error: { code: 'DUPLICATE', message: 'Username already exists.' } });
      return;
    }
    res.status(500).json({ data: null, error: { code: 'SERVER_ERROR', message } });
  }
});

// PATCH /api/v1/users/:id
usersRouter.patch('/:id', adminOnly, async (req: AuthRequest, res: Response): Promise<void> => {
  const id = Number(req.params.id);
  if (isNaN(id)) {
    res.status(400).json({ data: null, error: { code: 'INVALID_ID', message: 'Invalid user ID' } });
    return;
  }

  const patchSchema = z.object({
    displayName: z.string().min(1).max(255).optional(),
    password: z.string().min(6).optional(),
    role: z.enum(['admin', 'reviewer', 'preparer']).optional(),
    isActive: z.boolean().optional(),
  });
  const parsed = patchSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ data: null, error: { code: 'VALIDATION_ERROR', message: parsed.error.message } });
    return;
  }

  if (id === req.user!.userId && parsed.data.isActive === false) {
    res.status(400).json({ data: null, error: { code: 'INVALID_INPUT', message: 'You cannot deactivate your own account.' } });
    return;
  }

  const updates: Record<string, unknown> = { updated_at: db.fn.now() };
  if (parsed.data.displayName !== undefined) updates.display_name = parsed.data.displayName;
  if (parsed.data.role !== undefined) updates.role = parsed.data.role;
  if (parsed.data.isActive !== undefined) updates.is_active = parsed.data.isActive;
  if (parsed.data.password) updates.password_hash = await bcrypt.hash(parsed.data.password, 12);

  try {
    const [updated] = await db('app_users').where({ id }).update(updates)
      .returning(['id', 'username', 'display_name', 'role', 'is_active', 'updated_at']);
    if (!updated) {
      res.status(404).json({ data: null, error: { code: 'NOT_FOUND', message: 'User not found' } });
      return;
    }
    res.json({ data: updated, error: null });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ data: null, error: { code: 'SERVER_ERROR', message } });
  }
});

// DELETE /api/v1/users/:id  (deactivate — never hard delete)
usersRouter.delete('/:id', adminOnly, async (req: AuthRequest, res: Response): Promise<void> => {
  const id = Number(req.params.id);
  if (isNaN(id)) {
    res.status(400).json({ data: null, error: { code: 'INVALID_ID', message: 'Invalid user ID' } });
    return;
  }
  if (id === req.user!.userId) {
    res.status(400).json({ data: null, error: { code: 'INVALID_INPUT', message: 'You cannot deactivate your own account.' } });
    return;
  }
  try {
    const [updated] = await db('app_users').where({ id })
      .update({ is_active: false, updated_at: db.fn.now() })
      .returning(['id', 'username', 'is_active']);
    if (!updated) {
      res.status(404).json({ data: null, error: { code: 'NOT_FOUND', message: 'User not found' } });
      return;
    }
    res.json({ data: updated, error: null });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ data: null, error: { code: 'SERVER_ERROR', message } });
  }
});
