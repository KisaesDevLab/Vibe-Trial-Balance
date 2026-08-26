// Copyright 2025-2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Use is limited to qualifying small businesses. See LICENSE for terms.

/**
 * Rows an import preview starts with the include box unticked, shared by the
 * CSV and PDF trial-balance imports so both previews behave the same way.
 */

const TOTAL_ROW = /^totals?\b/i;

/**
 * A line whose account name opens with "Total" is a total or subtotal carried
 * down from the source report, not an account — importing it double-counts the
 * accounts above it. This is only the default: the row is still drawn in the
 * preview, so an account genuinely named "Total…" is one tick away from coming
 * back in.
 */
export function looksLikeTotalRow(accountName: string | null | undefined): boolean {
  return TOTAL_ROW.test((accountName ?? '').trim());
}
