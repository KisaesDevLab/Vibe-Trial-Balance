// Copyright 2025-2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Use is limited to qualifying small businesses. See LICENSE for terms.

import type { Account } from '../api/chartOfAccounts';

/**
 * Resolve an account "as printed" on a journal report — `1010 · Checking`,
 * `6120 Office Supplies`, `Office Supplies` — to one of the client's accounts.
 *
 * Number first, because a printed number is exact where a name is prose; then
 * an exact name; then a containment match, but only when it is unambiguous —
 * "Insurance" against both "Insurance Expense" and "Prepaid Insurance" is a
 * guess, and a wrong account on an imported row is worse than an empty one the
 * user has to fill.
 */
export function matchAccountRef(ref: string | null | undefined, accounts: Account[]): Account | null {
  const raw = (ref ?? '').trim();
  if (!raw) return null;
  const active = accounts.filter((a) => a.is_active !== false);

  const numberMatch = /^([0-9][0-9.\-]*)\b/.exec(raw);
  if (numberMatch) {
    const num = numberMatch[1].replace(/[.\-]+$/, '');
    const byNumber = active.find((a) => a.account_number.trim() === num);
    if (byNumber) return byNumber;
  }

  const name = raw
    .replace(/^[0-9][0-9.\-]*\s*[-–—·:]?\s*/, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
  if (!name) return null;

  const exact = active.filter((a) => a.account_name.toLowerCase().replace(/\s+/g, ' ').trim() === name);
  if (exact.length === 1) return exact[0];
  if (exact.length > 1) return null;

  const partial = active.filter((a) => {
    const an = a.account_name.toLowerCase().replace(/\s+/g, ' ').trim();
    return an.includes(name) || name.includes(an);
  });
  return partial.length === 1 ? partial[0] : null;
}
