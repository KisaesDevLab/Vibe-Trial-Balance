// Copyright 2025-2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Use is limited to qualifying small businesses. See LICENSE for terms.

/**
 * Authenticator-app codes (RFC 6238 TOTP) with one fixed policy — 30-second
 * steps, six digits, SHA-1 — which is what every authenticator app expects
 * by default. otplib is wrapped here so its option names live in exactly one
 * place.
 *
 * Replay: a code is good for one use. The step it was minted for is stored on
 * the user's row and a later code must come from a later step, so the same
 * six digits cannot be replayed inside the ±1-step window.
 *
 * Seeds are stored encrypted (lib/encryption.ts); see the migration note.
 */

import { generateSecret, generateURI, verify } from 'otplib';
import { decrypt, encrypt, isEncrypted } from './encryption';

export const TOTP_PERIOD_SEC = 30;
export const TOTP_DIGITS = 6;
/** ±1 step, expressed in seconds as otplib wants it. */
const EPOCH_TOLERANCE_SEC = TOTP_PERIOD_SEC;

export function generateTotpSecret(): string {
  return generateSecret();
}

export function buildOtpauthUrl(input: { issuer: string; label: string; secret: string }): string {
  return generateURI({
    strategy: 'totp',
    issuer: input.issuer,
    label: input.label,
    secret: input.secret,
    digits: TOTP_DIGITS,
    period: TOTP_PERIOD_SEC,
  });
}

/** Digits only, exactly six. Anything else is not a code. */
export function normalizeTotpCode(raw: string): string | null {
  const digits = String(raw ?? '').replace(/\D/g, '');
  return digits.length === TOTP_DIGITS ? digits : null;
}

export interface TotpVerifyResult {
  valid: boolean;
  /** The 30-second step the accepted code was minted for; undefined when invalid. */
  step?: number;
}

export async function verifyTotpCode(input: { secret: string; code: string; nowMs?: number }): Promise<TotpVerifyResult> {
  const code = normalizeTotpCode(input.code);
  if (!code) return { valid: false };
  const epoch = Math.floor((input.nowMs ?? Date.now()) / 1000);
  const result = await verify({
    strategy: 'totp',
    secret: input.secret,
    token: code,
    digits: TOTP_DIGITS,
    period: TOTP_PERIOD_SEC,
    epoch,
    epochTolerance: EPOCH_TOLERANCE_SEC,
  });
  if (!result.valid) return { valid: false };
  const step = Math.floor(epoch / TOTP_PERIOD_SEC) + result.delta;
  return { valid: true, step };
}

/** True when `step` has already been used (or is older than the last used step). */
export function isReplay(lastUsedStep: number | null | undefined, step: number): boolean {
  return lastUsedStep != null && step <= lastUsedStep;
}

export function encryptTotpSecret(secret: string): string {
  return encrypt(secret);
}

export function decryptTotpSecret(stored: string): string {
  return isEncrypted(stored) ? decrypt(stored) : stored;
}
