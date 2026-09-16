// Copyright 2025-2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Use is limited to qualifying small businesses. See LICENSE for terms.

import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { JWT_SECRET } from '../lib/jwtConfig';
import { db } from '../db';
import { isStageClaim, type MfaMethod } from '../lib/loginStage';
import { securitySettings } from '../lib/securitySettings';

export interface AuthRequest extends Request {
  user?: {
    userId: number;
    username: string;
    role: string;
    /** `null` for a full session; `'mfa'` / `'enrol'` for the scoped tokens login mints. */
    stage: 'mfa' | 'enrol' | null;
    /** On an `mfa` token: what the user can answer the challenge with. */
    methods: MfaMethod[];
  };
}

// Tiny in-process cache so every API request doesn't become a DB round-trip
// just to re-check is_active. Entries expire quickly, so deactivation takes
// effect within CACHE_TTL_MS of the admin's action.
const CACHE_TTL_MS = 30 * 1000;
interface CachedUser { role: string; mustChangePassword: boolean; expiresAt: number }
const activeUserCache = new Map<number, CachedUser>();

/** Invalidate a cached auth lookup. Call after updating a user's role or is_active. */
export function invalidateAuthCache(userId: number): void {
  activeUserCache.delete(userId);
}

// While `must_change_password` is true, the JWT is only good for these paths:
// reading the current user profile and rotating the password. Every other
// request is refused — this enforces the forced-rotation flow at the API layer
// so the fixed `admin / admin1234` bootstrap credential can't be used to reach
// any data by bypassing the login UI.
export const ROTATION_ALLOWLIST = new Set([
  'GET /api/v1/auth/me',
  'POST /api/v1/auth/change-password',
]);

// A token whose `stage` claim is 'mfa' was minted by a correct password on an
// account with a second factor. It is good for nothing but answering the
// challenge — five minutes, three endpoints.
export const MFA_ALLOWLIST = new Set([
  'POST /api/v1/auth/mfa/totp',
  'POST /api/v1/auth/mfa/passkey/options',
  'POST /api/v1/auth/mfa/passkey/verify',
]);

// A token whose `stage` claim is 'enrol' belongs to a user the firm requires
// to have a second factor who has none yet. It can read the profile, rotate
// the password (the rotation gate still applies — the public bootstrap
// password must never enrol a factor) and enrol. Nothing else.
export const ENROL_ALLOWLIST = new Set([
  ...ROTATION_ALLOWLIST,
  'GET /api/v1/auth/two-factor',
  'POST /api/v1/auth/totp/enrol/start',
  'POST /api/v1/auth/totp/enrol/confirm',
  'POST /api/v1/auth/passkeys/register/options',
  'POST /api/v1/auth/passkeys/register/verify',
  'GET /api/v1/auth/passkeys',
]);

/** `METHOD /path` with the query string dropped — the allowlists' key. */
export function routeKey(method: string, originalUrl: string): string {
  return `${method.toUpperCase()} ${originalUrl.split('?')[0]}`;
}

export interface GateInput {
  stage: 'mfa' | 'enrol' | null | string;
  route: string;
  mustChangePassword: boolean;
  requireTwoFactor: boolean;
}

export interface GateRefusal {
  status: number;
  code: string;
  message: string;
}

/**
 * Pure decision: may this token reach this route? `null` means yes.
 *
 * Only tokens minted by POST /login carry a `stage` claim, so every existing
 * token — including the 5-minute agent token the MCP server mints for
 * `mcp_agent` — reaches the same rules it always did. That is deliberate: the
 * MCP agent has no password and can never enrol; gating it would break every
 * tool call the moment an admin required 2FA.
 */
export function gateForRequest(input: GateInput): GateRefusal | null {
  const { stage, route } = input;

  if (stage === 'mfa') {
    if (!MFA_ALLOWLIST.has(route)) {
      // 401, not 403: a stale MFA token in the browser should fall back to
      // the login page, which is what the SPA does on a 401.
      return { status: 401, code: 'MFA_REQUIRED', message: 'Finish two-factor sign-in first.' };
    }
    return null;
  }

  if (stage === 'enrol') {
    // The policy may have been switched off since the token was minted; an
    // enrol token then behaves as a full session.
    if (input.requireTwoFactor && !ENROL_ALLOWLIST.has(route)) {
      return {
        status: 403,
        code: 'TWO_FACTOR_ENROLMENT_REQUIRED',
        message: 'Your firm requires two-factor authentication. Set up an authenticator app or a passkey to continue.',
      };
    }
  } else if (stage !== null && stage !== undefined) {
    return { status: 401, code: 'UNAUTHORIZED', message: 'Invalid or expired token' };
  }

  if (input.mustChangePassword && !ROTATION_ALLOWLIST.has(route)) {
    return {
      status: 403,
      code: 'PASSWORD_CHANGE_REQUIRED',
      message: 'You must change your password before using the app.',
    };
  }
  return null;
}

interface TokenPayload {
  userId: number;
  username: string;
  role: string;
  stage?: unknown;
  methods?: unknown;
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

  let payload: TokenPayload;
  try {
    payload = jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] }) as TokenPayload;
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
    let mustChangePassword: boolean;

    if (cached && cached.expiresAt > now) {
      currentRole = cached.role;
      mustChangePassword = cached.mustChangePassword;
    } else {
      const row = await db('app_users')
        .where({ id: payload.userId, is_active: true })
        .first('role', 'must_change_password');
      if (!row) {
        activeUserCache.delete(payload.userId);
        res
          .status(401)
          .json({ data: null, error: { code: 'UNAUTHORIZED', message: 'Account is inactive.' } });
        return;
      }
      currentRole = row.role as string;
      mustChangePassword = !!row.must_change_password;
      activeUserCache.set(payload.userId, {
        role: currentRole,
        mustChangePassword,
        expiresAt: now + CACHE_TTL_MS,
      });
    }

    const stage = isStageClaim(payload.stage) ? payload.stage : payload.stage == null ? null : String(payload.stage);
    const refusal = gateForRequest({
      stage,
      route: routeKey(req.method, req.originalUrl),
      mustChangePassword,
      requireTwoFactor: securitySettings().requireTwoFactor,
    });
    if (refusal) {
      res.status(refusal.status).json({ data: null, error: { code: refusal.code, message: refusal.message } });
      return;
    }

    const methods = Array.isArray(payload.methods)
      ? payload.methods.filter((m): m is MfaMethod => m === 'totp' || m === 'passkey')
      : [];

    req.user = {
      userId: payload.userId,
      username: payload.username,
      role: currentRole,
      stage: isStageClaim(payload.stage) ? payload.stage : null,
      methods,
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
 * Refuse a request whose token is not at the expected stage. The MFA
 * endpoints must not accept a full session (it would let an open session mint
 * fresh tokens), and the enrol endpoints accept a full session OR an enrol
 * token but never an MFA one.
 */
export function assertStage(req: AuthRequest, res: Response, expected: 'mfa' | 'full-or-enrol' | 'full'): boolean {
  const stage = req.user?.stage ?? null;
  const ok =
    expected === 'mfa' ? stage === 'mfa'
    : expected === 'full-or-enrol' ? stage === null || stage === 'enrol'
    : stage === null;
  if (ok) return true;
  res.status(401).json({
    data: null,
    error: {
      code: expected === 'mfa' ? 'MFA_STAGE_REQUIRED' : 'UNAUTHORIZED',
      message: expected === 'mfa' ? 'This endpoint answers a pending two-factor sign-in.' : 'Sign in again to continue.',
    },
  });
  return false;
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
