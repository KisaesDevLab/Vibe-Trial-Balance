// Copyright 2025-2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Use is limited to qualifying small businesses. See LICENSE for terms.

/**
 * Reversing entries. An adjusting entry marked `is_reversing` is reversed at
 * the start of the next year: roll forward posts an entry in the new period
 * with every line's debit and credit swapped, tagged `source_tag = 'reversal'`.
 * Pure helpers here so the swap and the wording are tested without a database.
 */

/** `journal_entries.source_tag` for a reversal posted by roll forward. */
export const REVERSAL_TAG = 'reversal';

export interface ReversibleLine {
  account_id: number;
  debit: number | string;
  credit: number | string;
}

/** The reversal's lines: the same accounts with debit and credit swapped. */
export function reversalLines(lines: ReversibleLine[]): { account_id: number; debit: number; credit: number }[] {
  return lines.map((l) => ({
    account_id: l.account_id,
    debit: Number(l.credit),
    credit: Number(l.debit),
  }));
}

/** "Reversal of book AJE #3: Accrue December utilities". */
export function reversalDescription(entryType: string, entryNumber: number, description: string | null | undefined): string {
  const head = `Reversal of ${entryType} AJE #${entryNumber}`;
  return description ? `${head}: ${description}` : head;
}
