// Copyright 2025-2026 Kisaes LLC
// Licensed under the PolyForm Internal Use License 1.0.0.
// You may not distribute this software. See LICENSE for terms.

import { Router, Response, NextFunction } from 'express';
import { z } from 'zod';
import bcrypt from 'bcrypt';
import { db } from '../db';
import { authMiddleware, AuthRequest, invalidateAuthCache } from '../middleware/auth';
import { logAudit } from '../lib/periodGuard';
import { sendServerError } from '../lib/safeError';
import { passwordSchema } from '../lib/passwordPolicy';

export const usersRouter = Router();
usersRouter.use(authMiddleware);

function adminOnly(req: AuthRequest, res: Response, next: NextFunction): void {
  if (req.user?.role !== 'admin') {
    res.status(403).json({ data: null, error: { code: 'FORBIDDEN', message: 'Admin access required.' } });
    return;
  }
  next();
}

// Treat empty string as "not set" so the form can submit a blank email field
// without tripping the email-format validator.
const optionalEmail = z
  .union([z.literal(''), z.string().email().max(320)])
  .optional()
  .transform((v) => (v === '' || v === undefined ? null : v));

const userSchema = z.object({
  username: z.string().min(2).max(100),
  displayName: z.string().min(1).max(255),
  email: optionalEmail,
  password: passwordSchema,
  role: z.enum(['admin', 'reviewer', 'preparer']),
});

// GET /api/v1/users
usersRouter.get('/', adminOnly, async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    const users = await db('app_users')
      .select('id', 'username', 'display_name', 'email', 'role', 'is_active', 'created_at', 'updated_at')
      .orderBy('display_name');
    res.json({ data: users, error: null, meta: { count: users.length } });
  } catch (err: unknown) {
    sendServerError(res, err, 'users');
  }
});

// POST /api/v1/users
usersRouter.post('/', adminOnly, async (req: AuthRequest, res: Response): Promise<void> => {
  const parsed = userSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ data: null, error: { code: 'VALIDATION_ERROR', message: parsed.error.message } });
    return;
  }
  const { username, displayName, email, password, role } = parsed.data;

  try {
    const hash = await bcrypt.hash(password, 12);
    const [user] = await db('app_users').insert({
      username,
      display_name: displayName,
      email: email ?? null,
      password_hash: hash,
      role,
      is_active: true,
      // Admin-provisioned accounts must rotate on first login — the creating admin
      // necessarily knows the initial password.
      must_change_password: true,
    }).returning(['id', 'username', 'display_name', 'email', 'role', 'is_active', 'created_at']);

    await logAudit({ userId: req.user!.userId, periodId: null, entityType: 'user', entityId: user.id, action: 'create', description: `Created user "${username}" (role: ${role})` });
    res.status(201).json({ data: user, error: null });
  } catch (err: unknown) {
    const internal = err instanceof Error ? err.message : '';
    if (internal.includes('unique') || internal.includes('duplicate')) {
      res.status(409).json({ data: null, error: { code: 'DUPLICATE', message: 'Username already exists.' } });
      return;
    }
    sendServerError(res, err, 'users');
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
    email: optionalEmail,
    password: passwordSchema.optional(),
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
  if (parsed.data.email !== undefined) updates.email = parsed.data.email;
  if (parsed.data.role !== undefined) updates.role = parsed.data.role;
  if (parsed.data.isActive !== undefined) updates.is_active = parsed.data.isActive;
  if (parsed.data.password) {
    updates.password_hash = await bcrypt.hash(parsed.data.password, 12);
    // Admin-initiated password reset: force target user to rotate on next login.
    // Exception: if the admin is resetting their own password here, the change-password
    // flow is a better fit — but this endpoint still requires rotation for safety.
    updates.must_change_password = true;
  }

  try {
    const [updated] = await db('app_users').where({ id }).update(updates)
      .returning(['id', 'username', 'display_name', 'email', 'role', 'is_active', 'updated_at']);
    if (!updated) {
      res.status(404).json({ data: null, error: { code: 'NOT_FOUND', message: 'User not found' } });
      return;
    }
    // Role or is_active change must take effect immediately for an already-
    // authenticated target user, so drop their cached auth lookup.
    invalidateAuthCache(id);
    const changedFields = Object.keys(updates).filter(k => k !== 'updated_at');
    const hasPasswordChange = changedFields.includes('password_hash');
    await logAudit({ userId: req.user!.userId, periodId: null, entityType: 'user', entityId: id, action: 'update', description: `Updated user "${updated.username}" — ${hasPasswordChange ? 'password changed' : changedFields.join(', ')}` });
    res.json({ data: updated, error: null });
  } catch (err: unknown) {
    sendServerError(res, err, 'users');
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
    invalidateAuthCache(id);
    await logAudit({ userId: req.user!.userId, periodId: null, entityType: 'user', entityId: id, action: 'delete', description: `Deactivated user "${updated.username}"` });
    res.json({ data: updated, error: null });
  } catch (err: unknown) {
    sendServerError(res, err, 'users');
  }
});
