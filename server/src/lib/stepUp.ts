// Copyright 2025-2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Use is limited to qualifying small businesses. See LICENSE for terms.

/**
 * Step-up: the account-security mutations (add a passkey, turn TOTP on or
 * off, remove a passkey, revoke trusted browsers) re-prove the password so a
 * session left open on a shared screen cannot silently weaken the account.
 */

import bcrypt from 'bcrypt';
import type { Response } from 'express';
import { db } from '../db';

/** True when `password` is the user's current password. */
export async function checkCurrentPassword(userId: number, password: string): Promise<boolean> {
  const row = await db('app_users').where({ id: userId, is_active: true }).first('password_hash');
  if (!row) return false;
  return bcrypt.compare(password, row.password_hash as string);
}

/**
 * Verify and, on mismatch, write the 401 the routes all share. Returns true
 * when the caller may continue.
 */
export async function assertCurrentPassword(userId: number, password: string, res: Response): Promise<boolean> {
  if (await checkCurrentPassword(userId, password)) return true;
  res.status(401).json({ data: null, error: { code: 'INVALID_CREDENTIALS', message: 'Current password is incorrect.' } });
  return false;
}
