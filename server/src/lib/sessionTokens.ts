// Copyright 2025-2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Use is limited to qualifying small businesses. See LICENSE for terms.

/**
 * Minting the three kinds of sign-in token and the `user` object every auth
 * response carries. One place, so the login route, the MFA exchange, the
 * enrolment exchange and the passkey login all hand the SPA the same shape.
 */

import jwt from 'jsonwebtoken';
import { db } from '../db';
import { JWT_SECRET, JWT_EXPIRY } from './jwtConfig';
import { stageTokenTtl, type LoginStage, type MfaMethod } from './loginStage';
import { securitySettings } from './securitySettings';
import { getPublicBaseUrl } from './publicUrl';

export interface UserRow {
  id: number;
  username: string;
  display_name: string | null;
  email: string | null;
  role: string;
  must_change_password: boolean | null;
}

export interface UserFactors {
  hasTotp: boolean;
  passkeyCount: number;
  hasPasskey: boolean;
}

export interface PublicUser {
  id: number;
  username: string;
  displayName: string | null;
  email: string | null;
  role: string;
  mustChangePassword: boolean;
  /** Firm policy requires a factor and this user has none. */
  mustEnrolTwoFactor: boolean;
  twoFactor: { totpEnabled: boolean; passkeyCount: number };
}

/** Confirmed TOTP + passkey count for a user, in two cheap queries. */
export async function loadUserFactors(userId: number): Promise<UserFactors> {
  const [totp, pk] = await Promise.all([
    db('user_totp').where({ user_id: userId }).whereNotNull('confirmed_at').first('user_id'),
    db('user_passkeys').where({ user_id: userId }).count<{ count: string }[]>('id as count').first(),
  ]);
  const passkeyCount = Number(pk?.count ?? 0);
  return { hasTotp: !!totp, passkeyCount, hasPasskey: passkeyCount > 0 };
}

export function mustEnrol(f: UserFactors): boolean {
  return securitySettings().requireTwoFactor && !f.hasTotp && !f.hasPasskey;
}

export function publicUser(row: UserRow, f: UserFactors): PublicUser {
  return {
    id: row.id,
    username: row.username,
    displayName: row.display_name,
    email: row.email ?? null,
    role: row.role,
    mustChangePassword: !!row.must_change_password,
    mustEnrolTwoFactor: mustEnrol(f),
    twoFactor: { totpEnabled: f.hasTotp, passkeyCount: f.passkeyCount },
  };
}

/** The unchanged full-session token: `{userId, username, role}`, JWT_EXPIRY. */
export function signFullToken(row: Pick<UserRow, 'id' | 'username' | 'role'>): string {
  return jwt.sign(
    { userId: row.id, username: row.username, role: row.role },
    JWT_SECRET,
    { algorithm: 'HS256', expiresIn: JWT_EXPIRY } as jwt.SignOptions,
  );
}

/** A scoped token: same identity claims plus `stage` (and `methods` for mfa). */
export function signStageToken(
  row: Pick<UserRow, 'id' | 'username' | 'role'>,
  stage: Exclude<LoginStage, 'ok'>,
  methods: MfaMethod[] = [],
): string {
  return jwt.sign(
    { userId: row.id, username: row.username, role: row.role, stage, ...(stage === 'mfa' ? { methods } : {}) },
    JWT_SECRET,
    { algorithm: 'HS256', expiresIn: stageTokenTtl(stage) } as jwt.SignOptions,
  );
}

/** Whether cookies this server sets should carry `Secure`. */
export function cookiesAreSecure(): boolean {
  return getPublicBaseUrl().toLowerCase().startsWith('https:');
}

/** Issuer / relying-party name shown in authenticator apps and passkey prompts. */
export async function firmDisplayName(): Promise<string> {
  try {
    const row = await db('settings').where({ key: 'firm_name' }).first('value');
    const v = (row?.value as string | null)?.trim();
    return v || 'Vibe TB';
  } catch {
    return 'Vibe TB';
  }
}

export const USER_ROW_COLUMNS = ['id', 'username', 'display_name', 'email', 'role', 'must_change_password'] as const;
