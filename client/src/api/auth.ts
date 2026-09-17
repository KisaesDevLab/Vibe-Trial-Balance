// Copyright 2025-2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Use is limited to qualifying small businesses. See LICENSE for terms.

import type { AuthenticationResponseJSON, PublicKeyCredentialRequestOptionsJSON } from '@simplewebauthn/browser';
import { apiFetch } from './client';
import { useAuthStore, type AuthUser } from '../store/uiStore';
import { withBase } from '../lib/baseConfig';
import type { MfaMethod, ServerStage } from '../utils/loginFlow';

export interface LoginResponse {
  /** 'ok' = full session; 'mfa' = answer a challenge first; 'enrol' = set up a factor first. */
  stage: ServerStage;
  token: string;
  methods: MfaMethod[];
  user: AuthUser;
}

// Login-page calls never redirect on 401: the page IS the login page, and an
// expired MFA token must read as "sign in again", not bounce the user around.
const onLoginPage = { noAuthRedirect: true } as const;

export function login(username: string, password: string) {
  return apiFetch<LoginResponse>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
    ...onLoginPage,
  });
}

export function getMe() {
  return apiFetch<AuthUser & { stage: 'mfa' | 'enrol' | null }>('/auth/me');
}

/**
 * Profile lookup with a token that is not (yet) the stored session: the login
 * page uses it to turn the bearer a single-sign-on redirect hands over into a
 * session, without letting a bad token bounce the page it is already on.
 */
export function getMeWithToken(token: string) {
  return apiFetch<AuthUser & { stage: 'mfa' | 'enrol' | null }>('/auth/me', { authToken: token, ...onLoginPage });
}

/**
 * Sign out. The session is a bearer the browser holds, so forgetting it is
 * the logout; a session that came from single sign-on also tells the SSO
 * layer (audit entry, identity row) — `local=1` keeps the identity provider's
 * own session alive, which is what a shared IdP login expects.
 */
export async function signOut(): Promise<void> {
  const { sso, token, clearAuth } = useAuthStore.getState();
  if (sso && token) {
    try {
      await fetch(withBase('auth/oidc/logout?local=1'), {
        headers: { Authorization: `Bearer ${token}` },
        redirect: 'manual',
      });
    } catch {
      // Best effort: the local sign-out below is what ends the session.
    }
  }
  clearAuth();
}

export function changePassword(currentPassword: string, newPassword: string) {
  return apiFetch<{ ok: true }>('/auth/change-password', {
    method: 'POST',
    body: JSON.stringify({ currentPassword, newPassword }),
  });
}

// ── Second factor (the 5-minute mfa token is passed explicitly, never stored) ──

export function verifyMfaTotp(mfaToken: string, code: string, rememberBrowser: boolean) {
  return apiFetch<{ stage: 'ok'; token: string; user: AuthUser }>('/auth/mfa/totp', {
    method: 'POST',
    body: JSON.stringify({ code, rememberBrowser }),
    authToken: mfaToken,
    ...onLoginPage,
  });
}

export function getMfaPasskeyOptions(mfaToken: string) {
  return apiFetch<{ challengeId: string; options: PublicKeyCredentialRequestOptionsJSON }>('/auth/mfa/passkey/options', {
    method: 'POST',
    body: '{}',
    authToken: mfaToken,
    ...onLoginPage,
  });
}

export function verifyMfaPasskey(mfaToken: string, challengeId: string, response: AuthenticationResponseJSON, rememberBrowser: boolean) {
  return apiFetch<{ stage: 'ok'; token: string; user: AuthUser }>('/auth/mfa/passkey/verify', {
    method: 'POST',
    body: JSON.stringify({ challengeId, response, rememberBrowser }),
    authToken: mfaToken,
    ...onLoginPage,
  });
}

// ── Usernameless passkey sign-in (public) ────────────────────────────────────

export function getPasskeyLoginOptions() {
  return apiFetch<{ challengeId: string; options: PublicKeyCredentialRequestOptionsJSON }>('/auth/passkeys/login/options', {
    method: 'POST',
    body: '{}',
    ...onLoginPage,
  });
}

export function verifyPasskeyLogin(challengeId: string, response: AuthenticationResponseJSON) {
  return apiFetch<LoginResponse>('/auth/passkeys/login/verify', {
    method: 'POST',
    body: JSON.stringify({ challengeId, response }),
    ...onLoginPage,
  });
}

// ── Password reset ───────────────────────────────────────────────────────────

export function requestPasswordReset(identifier: string) {
  return apiFetch<{ ok: true; message: string }>('/auth/password-reset/request', {
    method: 'POST',
    body: JSON.stringify({ identifier }),
  });
}

/** `purpose` distinguishes an invite link from a reset link so the confirm
 *  page can show the right copy — both use this endpoint. */
export function verifyPasswordResetToken(token: string) {
  return apiFetch<{
    valid: boolean;
    reason?: 'expired' | 'consumed' | 'unknown';
    purpose?: 'reset' | 'invite';
  }>('/auth/password-reset/verify', { method: 'POST', body: JSON.stringify({ token }) });
}

export function confirmPasswordReset(token: string, newPassword: string) {
  return apiFetch<{ ok: true; purpose: 'reset' | 'invite' }>('/auth/password-reset/confirm', {
    method: 'POST',
    body: JSON.stringify({ token, newPassword }),
  });
}
