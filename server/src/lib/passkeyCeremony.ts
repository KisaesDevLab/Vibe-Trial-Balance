// Copyright 2025-2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Use is limited to qualifying small businesses. See LICENSE for terms.

/**
 * The two WebAuthn ceremonies on top of @simplewebauthn/server, shared by the
 * passkey routes (registration, usernameless login) and the MFA route (a
 * passkey answering a password sign-in). Each half stores / consumes a
 * challenge row (lib/webauthn.ts) because there is no session.
 *
 * userVerification is 'preferred' and the verifies pass requireUserVerification:
 * false — the passkey is one factor of a flow that already took a password (or
 * is a discoverable credential a platform authenticator already unlocked), and
 * 'required' fails on some roaming keys without a PIN. Tightening is one line.
 */

import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
  type AuthenticationResponseJSON,
  type PublicKeyCredentialCreationOptionsJSON,
  type PublicKeyCredentialRequestOptionsJSON,
  type RegistrationResponseJSON,
} from '@simplewebauthn/server';
import { db } from '../db';
import { getRelyingParty, type RelyingParty } from './publicUrl';
import {
  consumeChallenge,
  counterCheck,
  fromBase64url,
  parseTransports,
  serializeTransports,
  storeChallenge,
  toBase64url,
  userIdHandle,
  type ChallengeKind,
} from './webauthn';
import { firmDisplayName } from './sessionTokens';

const CEREMONY_TIMEOUT_MS = 120_000;

export interface PasskeyRow {
  id: number;
  user_id: number;
  credential_id: string;
  public_key: string;
  counter: string | number;
  transports: string | null;
  device_type: string | null;
  backed_up: boolean;
  name: string;
  created_at: string;
  last_used_at: string | null;
}

export function passkeyToJson(r: PasskeyRow) {
  return {
    id: r.id,
    name: r.name,
    createdAt: r.created_at,
    lastUsedAt: r.last_used_at,
    transports: parseTransports(r.transports),
    deviceType: r.device_type,
    backedUp: !!r.backed_up,
  };
}

export function relyingPartyOrNull(): RelyingParty & { ok: true } | null {
  const rp = getRelyingParty();
  return rp.ok ? rp : null;
}

// ── Registration ─────────────────────────────────────────────────────────────

export async function beginRegistration(user: { id: number; username: string; display_name: string | null }): Promise<{
  challengeId: string;
  options: PublicKeyCredentialCreationOptionsJSON;
}> {
  const rp = getRelyingParty();
  if (!rp.ok) throw new Error(rp.reason);
  const existing = await db('user_passkeys').where({ user_id: user.id }).select('credential_id', 'transports');
  const options = await generateRegistrationOptions({
    rpName: await firmDisplayName(),
    rpID: rp.rpID,
    userID: userIdHandle(user.id),
    userName: user.username,
    userDisplayName: user.display_name ?? user.username,
    attestationType: 'none',
    excludeCredentials: existing.map((r) => ({
      id: r.credential_id as string,
      transports: parseTransports(r.transports as string | null) as never,
    })),
    authenticatorSelection: { residentKey: 'required', requireResidentKey: true, userVerification: 'preferred' },
    timeout: CEREMONY_TIMEOUT_MS,
  });
  const challengeId = await storeChallenge({ kind: 'register', userId: user.id, challenge: options.challenge });
  return { challengeId, options };
}

export type RegistrationOutcome =
  | { ok: true; passkey: PasskeyRow }
  | { ok: false; code: 'INVALID_CHALLENGE' | 'VERIFICATION_FAILED' | 'PASSKEY_EXISTS' | 'PASSKEYS_UNAVAILABLE'; message: string };

export async function finishRegistration(input: {
  userId: number;
  challengeId: string;
  response: RegistrationResponseJSON;
  name: string;
}): Promise<RegistrationOutcome> {
  const rp = getRelyingParty();
  if (!rp.ok) return { ok: false, code: 'PASSKEYS_UNAVAILABLE', message: rp.reason };
  const expectedChallenge = await consumeChallenge(input.challengeId, 'register', input.userId);
  if (!expectedChallenge) {
    return { ok: false, code: 'INVALID_CHALLENGE', message: 'This passkey request has expired or was already used. Start again.' };
  }
  let verification;
  try {
    verification = await verifyRegistrationResponse({
      response: input.response,
      expectedChallenge,
      expectedOrigin: rp.origin,
      expectedRPID: rp.rpID,
      requireUserVerification: false,
    });
  } catch (err) {
    return { ok: false, code: 'VERIFICATION_FAILED', message: err instanceof Error ? err.message : 'Passkey verification failed.' };
  }
  if (!verification.verified) {
    return { ok: false, code: 'VERIFICATION_FAILED', message: 'The browser\'s response could not be verified.' };
  }
  const info = verification.registrationInfo;
  const dup = await db('user_passkeys').where({ credential_id: info.credential.id }).first('id');
  if (dup) return { ok: false, code: 'PASSKEY_EXISTS', message: 'This passkey is already registered.' };
  const [row] = await db('user_passkeys')
    .insert({
      user_id: input.userId,
      credential_id: info.credential.id,
      public_key: toBase64url(info.credential.publicKey),
      counter: info.credential.counter,
      transports: serializeTransports(info.credential.transports ?? input.response.response.transports),
      device_type: info.credentialDeviceType,
      backed_up: info.credentialBackedUp,
      name: input.name,
    })
    .returning('*');
  return { ok: true, passkey: row as PasskeyRow };
}

// ── Authentication ───────────────────────────────────────────────────────────

/**
 * Options for an assertion. `userId` null = usernameless (empty allowCredentials,
 * the browser shows its discoverable credentials); set = only that user's keys.
 */
export async function beginAuthentication(kind: Exclude<ChallengeKind, 'register'>, userId: number | null): Promise<{
  challengeId: string;
  options: PublicKeyCredentialRequestOptionsJSON;
}> {
  const rp = getRelyingParty();
  if (!rp.ok) throw new Error(rp.reason);
  const allow = userId == null
    ? []
    : (await db('user_passkeys').where({ user_id: userId }).select('credential_id', 'transports')).map((r) => ({
        id: r.credential_id as string,
        transports: parseTransports(r.transports as string | null) as never,
      }));
  const options = await generateAuthenticationOptions({
    rpID: rp.rpID,
    allowCredentials: allow,
    userVerification: 'preferred',
    timeout: CEREMONY_TIMEOUT_MS,
  });
  const challengeId = await storeChallenge({ kind, userId, challenge: options.challenge });
  return { challengeId, options };
}

export type AssertionOutcome =
  | { ok: true; passkey: PasskeyRow; userId: number }
  | { ok: false; code: 'INVALID_CHALLENGE' | 'INVALID_CREDENTIALS' | 'VERIFICATION_FAILED' | 'PASSKEYS_UNAVAILABLE'; message: string; counterRegression?: boolean };

/**
 * Verify an assertion against the stored credential. For `kind:'mfa'` the
 * credential must belong to `userId`; for `kind:'login'` the credential names
 * the user. Updates counter + last_used_at on success.
 */
export async function finishAuthentication(input: {
  kind: Exclude<ChallengeKind, 'register'>;
  userId: number | null;
  challengeId: string;
  response: AuthenticationResponseJSON;
}): Promise<AssertionOutcome> {
  const rp = getRelyingParty();
  if (!rp.ok) return { ok: false, code: 'PASSKEYS_UNAVAILABLE', message: rp.reason };
  const expectedChallenge = await consumeChallenge(input.challengeId, input.kind, input.userId);
  if (!expectedChallenge) {
    return { ok: false, code: 'INVALID_CHALLENGE', message: 'This sign-in request has expired or was already used. Try again.' };
  }
  const row = (await db('user_passkeys').where({ credential_id: input.response.id }).first()) as PasskeyRow | undefined;
  if (!row || (input.userId != null && row.user_id !== input.userId)) {
    return { ok: false, code: 'INVALID_CREDENTIALS', message: 'That passkey is not registered here.' };
  }
  const active = await db('app_users').where({ id: row.user_id, is_active: true }).first('id');
  if (!active) return { ok: false, code: 'INVALID_CREDENTIALS', message: 'That passkey is not registered here.' };

  let verification;
  try {
    verification = await verifyAuthenticationResponse({
      response: input.response,
      expectedChallenge,
      expectedOrigin: rp.origin,
      expectedRPID: rp.rpID,
      credential: {
        id: row.credential_id,
        publicKey: fromBase64url(row.public_key),
        counter: Number(row.counter),
        transports: parseTransports(row.transports) as never,
      },
      requireUserVerification: false,
    });
  } catch (err) {
    return { ok: false, code: 'VERIFICATION_FAILED', message: err instanceof Error ? err.message : 'Passkey verification failed.' };
  }
  if (!verification.verified) {
    return { ok: false, code: 'VERIFICATION_FAILED', message: 'The passkey signature could not be verified.' };
  }
  const newCounter = verification.authenticationInfo.newCounter;
  if (counterCheck(Number(row.counter), newCounter) === 'regression') {
    console.warn(`[passkeys] signature counter regression on credential ${row.id} (stored ${row.counter}, got ${newCounter})`);
    return { ok: false, code: 'VERIFICATION_FAILED', message: 'This passkey failed a security check and was refused.', counterRegression: true };
  }
  await db('user_passkeys').where({ id: row.id }).update({ counter: newCounter, last_used_at: db.fn.now() });
  return { ok: true, passkey: row, userId: row.user_id };
}
