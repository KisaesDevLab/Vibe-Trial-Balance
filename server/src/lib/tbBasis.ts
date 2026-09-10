// Copyright 2025-2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Use is limited to qualifying small businesses. See LICENSE for terms.

/**
 * Which set of balance columns a report reads.
 *
 * One definition, because a report that offers the choice must offer the same
 * three everywhere: the financial statements had this inline, and the period
 * comparison was hard-wired to book-adjusted with no way to ask for anything
 * else. Anything unrecognised falls back to 'book', which is what every report
 * printed before the knob existed — so an absent or junk parameter cannot
 * change what an existing caller gets.
 */

export type TbBasis = 'unadjusted' | 'book' | 'tax';

/** Column prefix in `v_adjusted_trial_balance`: `<prefix>_debit` / `_credit`. */
export const TB_BASIS_COLUMN: Record<TbBasis, string> = {
  unadjusted: 'unadjusted',
  book:       'book_adjusted',
  tax:        'tax_adjusted',
};

/** What the report prints so a reader knows which balances they are looking at. */
export const TB_BASIS_LABEL: Record<TbBasis, string> = {
  unadjusted: 'Unadjusted',
  book:       'Book Adjusted',
  tax:        'Tax Adjusted',
};

export function parseTbBasis(v: unknown): TbBasis {
  return v === 'unadjusted' || v === 'tax' ? v : 'book';
}

/** The debit and credit column names for a basis, e.g. for a knex select. */
export function tbBasisColumns(basis: TbBasis): { debit: string; credit: string } {
  const col = TB_BASIS_COLUMN[basis];
  return { debit: `${col}_debit`, credit: `${col}_credit` };
}
