// Copyright 2025-2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Use is limited to qualifying small businesses. See LICENSE for terms.

/**
 * Account security: authenticator app (TOTP), passkeys, remembered browsers.
 * All of these run on the normal session token. The "remember this browser"
 * cookie is httpOnly and same-origin (Vite proxy in dev, nginx in prod), so
 * nothing here needs to touch it.
 */

import type { PublicKeyCredentialCreationOptionsJSON, RegistrationResponseJSON } from '@simplewebauthn/browser';
import { apiFetch } from './client';
import type { AuthUser } from '../store/uiStore';

export interface PasskeyInfo {
  id: number;
  name: string;
  createdAt: string;
  lastUsedAt: string | null;
  transports: string[];
  deviceType: string | null;
  backedUp: boolean;
}

export interface TrustedBrowserInfo {
  id: number;
  userAgent: string | null;
  createdAt: string;
  lastUsedAt: string | null;
  expiresAt: string;
  /** The browser making this request. */
  current: boolean;
}

export interface TwoFactorStatus {
  totpEnabled: boolean;
  totpEnabledAt: string | null;
  totpPendingEnrolment: boolean;
  passkeys: PasskeyInfo[];
  trustedBrowsers: TrustedBrowserInfo[];
  requireTwoFactor: boolean;
  passkeysAvailable: boolean;
  passkeyBlockReason: string | null;
}

export const SECURITY_QUERY_KEY = ['auth-security'] as const;

export const getTwoFactorStatus = () => apiFetch<TwoFactorStatus>('/auth/two-factor');

// ── TOTP ─────────────────────────────────────────────────────────────────────

export const startTotpEnrol = (currentPassword: string) =>
  apiFetch<{ secretBase32: string; otpauthUrl: string; qrDataUrl: string }>('/auth/totp/enrol/start', {
    method: 'POST',
    body: JSON.stringify({ currentPassword }),
  });

/** During forced enrolment the reply carries a fresh full session token. */
export const confirmTotpEnrol = (code: string) =>
  apiFetch<{ ok: true; token: string | null; user: AuthUser }>('/auth/totp/enrol/confirm', {
    method: 'POST',
    body: JSON.stringify({ code }),
  });

export const disableTotp = (currentPassword: string, code: string) =>
  apiFetch<{ ok: true }>('/auth/totp', { method: 'DELETE', body: JSON.stringify({ currentPassword, code }) });

// ── Passkeys ─────────────────────────────────────────────────────────────────

export const getPasskeyRegisterOptions = (currentPassword: string) =>
  apiFetch<{ challengeId: string; options: PublicKeyCredentialCreationOptionsJSON }>('/auth/passkeys/register/options', {
    method: 'POST',
    body: JSON.stringify({ currentPassword }),
  });

export const verifyPasskeyRegister = (challengeId: string, response: RegistrationResponseJSON, name: string) =>
  apiFetch<{ passkey: PasskeyInfo; token: string | null; user: AuthUser }>('/auth/passkeys/register/verify', {
    method: 'POST',
    body: JSON.stringify({ challengeId, response, name }),
  });

export const renamePasskey = (id: number, name: string) =>
  apiFetch<PasskeyInfo>(`/auth/passkeys/${id}`, { method: 'PATCH', body: JSON.stringify({ name }) });

export const deletePasskey = (id: number, currentPassword: string) =>
  apiFetch<{ ok: true }>(`/auth/passkeys/${id}`, { method: 'DELETE', body: JSON.stringify({ currentPassword }) });

// ── Remembered browsers ──────────────────────────────────────────────────────

export const revokeTrustedBrowser = (id: number, currentPassword: string) =>
  apiFetch<{ ok: true }>(`/auth/trusted-browsers/${id}`, { method: 'DELETE', body: JSON.stringify({ currentPassword }) });

export const revokeAllTrustedBrowsers = (currentPassword: string) =>
  apiFetch<{ revoked: number }>('/auth/trusted-browsers', { method: 'DELETE', body: JSON.stringify({ currentPassword }) });
