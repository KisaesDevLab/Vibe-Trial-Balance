// Copyright 2025-2026 Kisaes LLC
// Licensed under the PolyForm Internal Use License 1.0.0.
// You may not distribute this software. See LICENSE for terms.

import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { JWT_SECRET } from '../lib/jwtConfig';
import { db } from '../db';

export interface AuthRequest extends Request {
  user?: { userId: number; username: string; role: string };
}

// Tiny in-process cache so every API request doesn't become a DB round-trip
// just to re-check is_active. Entries expire quickly, so deactivation takes
// effect within CACHE_TTL_MS of the admin's action.
const CACHE_TTL_MS = 30 * 1000;
interface CachedUser { role: string; expiresAt: number }
const activeUserCache = new Map<number, CachedUser>();

/** Invalidate a cached auth lookup. Call after updating a user's role or is_active. */
export function invalidateAuthCache(userId: number): void {
  activeUserCache.delete(userId);
}

export async function authMiddleware(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith('Bearer ')) {
    res
      .status(401)
      .json({ data: null, error: { code: 'UNAUTHORIZED', message: 'Missing or invalid token' } });
    return;
  }

  const token = authHeader.slice(7);

  let payload: { userId: number; username: string; role: string };
  try {
    payload = jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] }) as {
      userId: number;
      username: string;
      role: string;
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`[auth] JWT verification failed: ${msg}`);
    res
      .status(401)
      .json({ data: null, error: { code: 'UNAUTHORIZED', message: 'Invalid or expired token' } });
    return;
  }

  // Re-check is_active and current role from the DB so that deactivation or
  // role changes take effect without waiting for the JWT to expire.
  try {
    const now = Date.now();
    const cached = activeUserCache.get(payload.userId);
    let currentRole: string;

    if (cached && cached.expiresAt > now) {
      currentRole = cached.role;
    } else {
      const row = await db('app_users')
        .where({ id: payload.userId, is_active: true })
        .first('role');
      if (!row) {
        activeUserCache.delete(payload.userId);
        res
          .status(401)
          .json({ data: null, error: { code: 'UNAUTHORIZED', message: 'Account is inactive.' } });
        return;
      }
      currentRole = row.role as string;
      activeUserCache.set(payload.userId, { role: currentRole, expiresAt: now + CACHE_TTL_MS });
    }

    req.user = {
      userId: payload.userId,
      username: payload.username,
      role: currentRole,
    };
    next();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[auth] DB lookup failed: ${msg}`);
    res
      .status(500)
      .json({ data: null, error: { code: 'SERVER_ERROR', message: 'Auth check failed.' } });
  }
}

/**
 * Blocks mutating HTTP methods (POST/PUT/PATCH/DELETE) from reviewer accounts.
 * GET/HEAD/OPTIONS pass through, so a single `router.use(blockReviewerWrites)`
 * guards the whole router without splitting read vs write routes. Admin and
 * staff always pass. Mount AFTER authMiddleware.
 */
export function blockReviewerWrites(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): void {
  const method = req.method.toUpperCase();
  const isMutation = method !== 'GET' && method !== 'HEAD' && method !== 'OPTIONS';
  if (isMutation && req.user?.role === 'reviewer') {
    res.status(403).json({
      data: null,
      error: { code: 'READ_ONLY', message: 'Reviewer accounts cannot modify data.' },
    });
    return;
  }
  next();
}
