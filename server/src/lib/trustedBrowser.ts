// Copyright 2025-2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Use is limited to qualifying small businesses. See LICENSE for terms.

/**
 * "Remember this browser for 30 days": after a successful second factor the
 * browser gets an httpOnly cookie holding a random token; the DB keeps only
 * its SHA-256 (the password_reset_tokens posture), so a DB read alone never
 * yields a usable cookie.
 *
 * Path=/ rather than /api/v1/auth: in multi-app mode the browser sees
 * /tb/api/v1/auth/login and the server does not know its own base path.
 * SameSite=Lax is enough because the SPA and the API are same-origin (Vite
 * proxy in dev, nginx in prod); if the API is ever served cross-origin the
 * cookie is simply never sent and the user is prompted every time.
 */

import { createHash, randomBytes } from 'crypto';
import { buildCookie, clearCookie } from './cookies';

export const TRUSTED_BROWSER_COOKIE = 'vtb_trusted';
export const TRUSTED_BROWSER_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export function hashTrustedBrowserToken(raw: string): string {
  return createHash('sha256').update(raw).digest('hex');
}

export function generateTrustedBrowserToken(): { raw: string; hash: string } {
  const raw = randomBytes(32).toString('base64url');
  return { raw, hash: hashTrustedBrowserToken(raw) };
}

export function buildTrustedBrowserCookie(raw: string, opts: { secure: boolean }): string {
  return buildCookie(TRUSTED_BROWSER_COOKIE, raw, {
    maxAgeSec: TRUSTED_BROWSER_TTL_MS / 1000,
    secure: opts.secure,
    path: '/',
    sameSite: 'Lax',
  });
}

export function clearTrustedBrowserCookie(opts: { secure: boolean }): string {
  return clearCookie(TRUSTED_BROWSER_COOKIE, { secure: opts.secure, path: '/' });
}

export interface TrustedBrowserRowLike {
  expires_at: Date | string;
  revoked_at: Date | string | null;
}

/** Pure validity check on a DB row (the query also filters, this is the belt). */
export function isTrustedBrowserRowValid(row: TrustedBrowserRowLike, now: number = Date.now()): boolean {
  if (row.revoked_at) return false;
  const exp = row.expires_at instanceof Date ? row.expires_at.getTime() : new Date(row.expires_at).getTime();
  return Number.isFinite(exp) && exp > now;
}
