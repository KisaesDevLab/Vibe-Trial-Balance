// Copyright 2025-2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Use is limited to qualifying small businesses. See LICENSE for terms.

/**
 * Journal entry types.
 *
 *   book     adjusting entry proposed to the client (AJE), in book adjusted
 *   tax      tax-only adjustment, in tax adjusted
 *   reclass  reclassifying entry (RJE): moves amounts between accounts for
 *            presentation. In book adjusted (and so tax adjusted), statements
 *            and tax exports, but NOT an adjustment proposed to the client:
 *            never on the bookkeeper letter, never counted as the client's AJEs.
 *            Own layer in v_adjusted_trial_balance (`reclass_adj_*`).
 *   trans    made by a classified bank transaction, never typed by hand
 *
 * Each type numbers on its own (`uje_period_type_number`), so an entry cannot
 * change between `reclass` and another type: its number would collide or mean
 * something else. Roll forward copies recurring book/tax entries only.
 */
export const ENTRY_TYPES = ['book', 'tax', 'reclass', 'trans'] as const;
export type EntryType = (typeof ENTRY_TYPES)[number];

/** Types a person enters (create, PATCH, MCP). */
export const MANUAL_ENTRY_TYPES = ['book', 'tax', 'reclass'] as const;
export type ManualEntryType = (typeof MANUAL_ENTRY_TYPES)[number];

/** Short reference prefix, as the GL always printed it, plus RJE for a reclass. */
const PREFIX: Record<string, string> = { book: 'BOOK', tax: 'TAX', reclass: 'RJE', trans: 'TRANS' };

/** `BOOK-3`, `TAX-1`, `RJE-2`, `TRANS-14`: the label the GL and the JE PDF print. */
export function entryRef(type: string, number: number | string): string {
  return `${PREFIX[type] ?? type.toUpperCase()}-${number}`;
}

/** Words for a type, as listings and audit lines use them. */
export const ENTRY_TYPE_LABEL: Record<string, string> = {
  book: 'Book AJE',
  tax: 'Tax AJE',
  reclass: 'Reclassifying entry (RJE)',
  trans: 'Transaction entry',
};

/**
 * Why a type change is refused, or null when it is allowed. book ↔ tax is
 * allowed as before; anything to or from reclass is not (Q-RJE, owner
 * 2026-11-22: refuse, don't renumber).
 */
export function typeChangeRefusal(from: string, to: string | undefined): string | null {
  if (to === undefined || to === from) return null;
  if (from === 'reclass' || to === 'reclass') {
    return from === 'reclass'
      ? 'A reclassifying entry cannot become an adjusting entry: RJEs are numbered on their own. Delete it and enter it again as the other type.'
      : 'An adjusting entry cannot become a reclassifying entry: RJEs are numbered on their own. Delete it and enter it again as a reclass.';
  }
  return null;
}

/** True when a v_adjusted_trial_balance row carries a reclassifying entry. */
export function hasReclass(row: Record<string, unknown>): boolean {
  return Number(row.reclass_adj_debit ?? 0) !== 0 || Number(row.reclass_adj_credit ?? 0) !== 0;
}

/** Heading of the book AJE column: it names reclasses when the period has any. */
export function bookAjeHeading(withReclass: boolean): string {
  return withReclass ? 'Book AJEs & reclasses' : 'Book AJEs';
}

/** Listing order: book, tax, reclass, trans (alphabetical would put RJEs between the AJEs). */
export const ENTRY_TYPE_ORDER_SQL = "CASE entry_type WHEN 'book' THEN 0 WHEN 'tax' THEN 1 WHEN 'reclass' THEN 2 ELSE 3 END";
