// Copyright 2025-2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Use is limited to qualifying small businesses. See LICENSE for terms.

import { apiFetch, type ApiResult } from './client';

/** Everything GET /api/v1/features reports — the one shape for the one endpoint. */
export interface FeatureFlags {
  ai: boolean;
  /** A mail transport is configured — gates invites and self-service reset. */
  mailEnabled: boolean;
  /** Same fact as mailEnabled under the name the login page used first. */
  passwordResetEnabled: boolean;
  /** Intuit app credentials are present — gates the QuickBooks page and import button. */
  quickbooks: boolean;
  /** The server can derive a WebAuthn relying party (https public URL, or localhost). */
  passkeys: boolean;
  /** Authenticator-app 2FA is always available. */
  totp: boolean;
  /** Admin policy: every user must have a second factor. */
  requireTwoFactor: boolean;
}

export const DEFAULT_FLAGS: FeatureFlags = {
  ai: false,
  mailEnabled: false,
  passwordResetEnabled: false,
  quickbooks: false,
  passkeys: false,
  totp: true,
  requireTwoFactor: false,
};

export function getFeatures(): Promise<ApiResult<FeatureFlags>> {
  // apiFetch already prepends API_BASE_URL (/api/v1) — do not repeat it here.
  return apiFetch<FeatureFlags>('/features');
}
