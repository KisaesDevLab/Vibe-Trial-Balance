// Copyright 2025-2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Use is limited to qualifying small businesses. See LICENSE for terms.

/**
 * Journal entry types. Mirror of server/src/lib/journalEntryTypes.ts.
 * `reclass` is a reclassifying entry (RJE): in book and tax adjusted balances,
 * statements and tax exports, but not an adjustment proposed to the client.
 * It numbers on its own, so an entry never changes to or from it.
 */
export type EntryType = 'book' | 'tax' | 'reclass' | 'trans';
export type ManualEntryType = 'book' | 'tax' | 'reclass';

export const ENTRY_TYPE_LABEL: Record<EntryType, string> = {
  book: 'Book AJE',
  tax: 'Tax AJE',
  reclass: 'Reclass (RJE)',
  trans: 'Transaction',
};

const PREFIX: Record<EntryType, string> = { book: 'BOOK', tax: 'TAX', reclass: 'RJE', trans: 'TRANS' };

/** `BOOK-3`, `TAX-1`, `RJE-2`, `TRANS-14`. */
export function entryRef(type: string, number: number | string): string {
  return `${PREFIX[type as EntryType] ?? type.toUpperCase()}-${number}`;
}

/** True when a trial balance row carries a reclassifying entry. */
export function hasReclass(row: { reclass_adj_debit?: number | string | null; reclass_adj_credit?: number | string | null }): boolean {
  return Number(row.reclass_adj_debit ?? 0) !== 0 || Number(row.reclass_adj_credit ?? 0) !== 0;
}

/** Heading of the book AJE column: it names reclasses when the period has any. */
export function bookAjeHeading(withReclass: boolean): string {
  return withReclass ? 'Book AJEs & reclasses' : 'Book AJEs';
}
