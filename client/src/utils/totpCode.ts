// Copyright 2025-2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Use is limited to qualifying small businesses. See LICENSE for terms.

export const TOTP_CODE_LENGTH = 6;

/** Digits only, capped at six — what the one-time-code input keeps as you type or paste. */
export function normalizeTotpCode(raw: string): string {
  return String(raw ?? '').replace(/\D/g, '').slice(0, TOTP_CODE_LENGTH);
}

export function isCompleteTotpCode(code: string): boolean {
  return /^\d{6}$/.test(code);
}

/** Base32 secret in groups of four, upper-case, for typing into an app by hand. */
export function formatSecretForDisplay(base32: string): string {
  const clean = String(base32 ?? '').replace(/[\s=]/g, '').toUpperCase();
  return clean.replace(/(.{4})(?=.)/g, '$1 ');
}
