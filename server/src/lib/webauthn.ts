// Copyright 2025-2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Use is limited to qualifying small businesses. See LICENSE for terms.

/**
 * Passkey (WebAuthn) plumbing that is NOT the ceremony itself: encoding for
 * storage, the signature-counter rule, the stable user handle, and the
 * server-side challenge store. The ceremony calls live in routes/passkeys.ts
 * and routes/auth.ts on top of @simplewebauthn/server.
 *
 * Challenges are rows, not session state, because this app has no session:
 * the options call stores one with a 5-minute TTL and returns its id, and the
 * verify call consumes it under a row lock so it can be used exactly once.
 */

import { randomBytes } from 'crypto';
import type { Knex } from 'knex';
import { db } from '../db';

export const CHALLENGE_TTL_MS = 5 * 60 * 1000;
export type ChallengeKind = 'register' | 'login' | 'mfa';

export function newChallengeId(): string {
  return randomBytes(32).toString('base64url');
}

export function toBase64url(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString('base64url');
}

/**
 * Returns a Uint8Array over a plain ArrayBuffer (not a Buffer pool slice):
 * @simplewebauthn/server's types demand `Uint8Array<ArrayBuffer>`.
 */
export function fromBase64url(s: string): Uint8Array<ArrayBuffer> {
  const buf = Buffer.from(s, 'base64url');
  const out = new Uint8Array(new ArrayBuffer(buf.length));
  out.set(buf);
  return out;
}

export function serializeTransports(transports: readonly string[] | undefined | null): string | null {
  if (!transports || transports.length === 0) return null;
  return JSON.stringify(transports);
}

export function parseTransports(text: string | null | undefined): string[] {
  if (!text) return [];
  try {
    const v = JSON.parse(text);
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

/**
 * Signature counter rule. Authenticators that implement a counter must
 * increase it on every assertion, so a value at or below the stored one means
 * a cloned credential. Many platform authenticators (passkeys synced by
 * Apple/Google) never increment and always report 0; a 0→0 assertion is
 * therefore normal, not a clone.
 */
export function counterCheck(stored: number, received: number): 'ok' | 'regression' {
  if (stored === 0 && received === 0) return 'ok';
  return received > stored ? 'ok' : 'regression';
}

/** Stable, opaque WebAuthn user handle for a user id (never the username). */
export function userIdHandle(userId: number): Uint8Array<ArrayBuffer> {
  const enc = new TextEncoder().encode(`vtb-user-${userId}`);
  const out = new Uint8Array(new ArrayBuffer(enc.length));
  out.set(enc);
  return out;
}

/** Store a fresh challenge and prune expired rows while we are here. */
export async function storeChallenge(input: {
  kind: ChallengeKind;
  userId: number | null;
  challenge: string;
}): Promise<string> {
  const id = newChallengeId();
  await db('webauthn_challenges').where('expires_at', '<', new Date()).delete();
  await db('webauthn_challenges').insert({
    id,
    user_id: input.userId,
    kind: input.kind,
    challenge: input.challenge,
    expires_at: new Date(Date.now() + CHALLENGE_TTL_MS),
  });
  return id;
}

/**
 * Consume a challenge exactly once. Returns the challenge string, or null when
 * the id is unknown, of the wrong kind, for another user, expired or already
 * used — the caller answers 400 INVALID_CHALLENGE for all of those alike.
 */
export async function consumeChallenge(
  id: string,
  kind: ChallengeKind,
  userId: number | null,
): Promise<string | null> {
  return db.transaction(async (trx: Knex.Transaction) => {
    const row = await trx('webauthn_challenges').where({ id }).forUpdate().first();
    if (!row) return null;
    if (row.kind !== kind) return null;
    if ((row.user_id ?? null) !== userId) return null;
    if (row.consumed_at) return null;
    if (new Date(row.expires_at as string).getTime() <= Date.now()) return null;
    await trx('webauthn_challenges').where({ id }).update({ consumed_at: trx.fn.now() });
    return row.challenge as string;
  });
}
