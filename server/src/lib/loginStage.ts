// Copyright 2025-2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Use is limited to qualifying small businesses. See LICENSE for terms.

/**
 * What happens after a correct password. Pure so the whole decision table is
 * pinned by a test.
 *
 *   ok    — full session token
 *   mfa   — a 5-minute token good only for the /auth/mfa/* endpoints
 *   enrol — a 15-minute token good only for reading the profile, rotating the
 *           password and enrolling a factor (firm policy requires one)
 *
 * A user who owns only a passkey but signs in by password is still asked for
 * a second factor (answered with the passkey): the firm-wide requirement must
 * not be satisfiable by typing a password.
 */

export type LoginStage = 'ok' | 'mfa' | 'enrol';
export type MfaMethod = 'totp' | 'passkey';

export interface LoginStageInput {
  hasTotp: boolean;
  hasPasskey: boolean;
  /** A valid, unrevoked trusted-browser cookie belonging to THIS user. */
  trustedBrowser: boolean;
  requireTwoFactor: boolean;
}

export interface LoginStageResult {
  stage: LoginStage;
  methods: MfaMethod[];
}

export function resolveLoginStage(input: LoginStageInput): LoginStageResult {
  const methods: MfaMethod[] = [];
  if (input.hasTotp) methods.push('totp');
  if (input.hasPasskey) methods.push('passkey');

  if (methods.length > 0) {
    return input.trustedBrowser ? { stage: 'ok', methods } : { stage: 'mfa', methods };
  }
  return { stage: input.requireTwoFactor ? 'enrol' : 'ok', methods };
}

/** JWT lifetime for a scoped token. Full tokens use JWT_EXPIRY. */
export function stageTokenTtl(stage: Exclude<LoginStage, 'ok'>): string {
  return stage === 'mfa' ? '5m' : '15m';
}

export function isStageClaim(v: unknown): v is Exclude<LoginStage, 'ok'> {
  return v === 'mfa' || v === 'enrol';
}
