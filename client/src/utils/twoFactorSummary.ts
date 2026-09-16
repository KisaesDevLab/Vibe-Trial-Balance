// Copyright 2025-2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Use is limited to qualifying small businesses. See LICENSE for terms.

/** The 2FA pill on the Users page. */
export function twoFactorSummary(u: { totp_enabled?: boolean | null; passkey_count?: number | null }): { label: string; enrolled: boolean } {
  const totp = !!u.totp_enabled;
  const n = Number(u.passkey_count ?? 0);
  const pk = n === 1 ? 'Passkey' : n > 1 ? `Passkey ×${n}` : '';
  if (totp && pk) return { label: `TOTP + ${pk}`, enrolled: true };
  if (totp) return { label: 'TOTP', enrolled: true };
  if (pk) return { label: pk, enrolled: true };
  return { label: 'None', enrolled: false };
}
