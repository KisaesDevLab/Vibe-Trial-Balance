// Copyright 2025-2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Use is limited to qualifying small businesses. See LICENSE for terms.

/**
 * Ref codes for lead sheet attachments: `A001`, `A002`, `B001`.
 *
 * Pure — takes the existing codes rather than querying — so it is unit-testable
 * with no DB and no network.
 *
 * This also fixes a latent bug in the MyBooks original, which reads only the
 * single most recent row by `created_at` and parses its suffix: delete `A003`
 * after `A002` was created later and the next code is `A003` again, colliding
 * with a code that already appeared in a printed binder. Taking max+1 over all
 * known codes avoids reissuing a retired number.
 */

/** Uppercase letters from the lead sheet code; 'LS' when it has none. */
export function refPrefix(code: string | null | undefined): string {
  const letters = (code ?? '').trim().toUpperCase().replace(/[^A-Z]/g, '');
  return letters.slice(0, 2) || 'LS';
}

export interface ParsedRef {
  prefix: string;
  seq: number;
}

export function parseRefCode(ref: string): ParsedRef | null {
  const m = /^([A-Z]{1,4})(\d{1,6})$/.exec((ref ?? '').trim().toUpperCase());
  if (!m) return null;
  return { prefix: m[1], seq: Number(m[2]) };
}

/**
 * Next code for a prefix, zero-padded to three digits.
 *
 * Numbers are never reused: the sequence continues past the highest code ever
 * issued for this prefix, even if that attachment has since been deleted.
 */
export function nextRefCode(prefix: string, existing: readonly string[]): string {
  const p = refPrefix(prefix);
  let max = 0;
  for (const ref of existing) {
    const parsed = parseRefCode(ref);
    if (parsed && parsed.prefix === p && parsed.seq > max) max = parsed.seq;
  }
  const next = max + 1;
  // Past 999 the code simply grows rather than wrapping into a collision.
  return `${p}${String(next).padStart(3, '0')}`;
}
