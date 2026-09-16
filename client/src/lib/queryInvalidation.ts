// Copyright 2025-2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Use is limited to qualifying small businesses. See LICENSE for terms.

import type { QueryClient } from '@tanstack/react-query';

/**
 * Every cached query a posted, edited or deleted journal entry moves.
 *
 * This list exists because it was previously kept four times over — the New JE
 * dialog, the Edit JE dialog, the Journal Entries page and the PY tie-out panel
 * each invalidated a different subset, so which screens went stale depended on
 * which screen you posted from. Posting on the Trial Balance left the lead
 * schedules showing the old balances, because no site listed the lead sheet
 * keys at all.
 *
 * Keys are matched by PREFIX: `['trial-balance']` invalidates
 * `['trial-balance', 17]` and every other period's entry too. That is
 * deliberate — an entry can be back-dated into a period other than the one on
 * screen, so narrowing to the current period would reintroduce the same class
 * of bug.
 *
 * Add a key here when a new screen reads posted balances. Over-listing costs a
 * refetch; under-listing shows a stale number to someone signing a workpaper.
 */
/**
 * Every cached query that reads period balances, however they got there — a
 * typed cell on the TB grid, a TB/CSV/PDF/QBO import, a row sync, or a posted
 * journal entry. A typed balance used to refresh only `['trial-balance']`, so
 * the Dashboard, General Ledger, Cash Flow, Comparison and Lead Sheets kept
 * showing the old figure until the cache expired.
 */
const BALANCE_DEPENDENTS: string[] = [
  'trial-balance',
  'tb',
  'general-ledger',
  // Lead schedules: member balances AND the sign-off staleness stamp, which is
  // computed from those balances.
  'lead-sheets',
  'lead-sheets-period',
  'lead-sheets-unassigned',
  // Derived statements and checks
  'cash-flow',
  'm1',
  'comparison',
  'dashboard',
  'engagement-summary',
  'export-validation',
  'py-comparison',
  'py-comparison-prefill',
];

const JOURNAL_ENTRY_DEPENDENTS: string[] = [
  // The entries themselves
  'journal-entries',
  'journal-entry',
  'journal-entries-zoom',
  ...BALANCE_DEPENDENTS,
  // A JE and its bank transaction are kept in step server-side.
  'bank-transactions',
  'reconciliations',
];

function invalidatePrefixes(qc: QueryClient, keys: string[]): void {
  for (const key of keys) {
    void qc.invalidateQueries({ queryKey: [key] });
  }
}

/**
 * Refresh everything that depends on posted balances. Call from every journal
 * entry create, update and delete — never hand-pick a subset at the call site.
 */
export function invalidateAfterJournalEntry(qc: QueryClient): void {
  invalidatePrefixes(qc, JOURNAL_ENTRY_DEPENDENTS);
}

/**
 * Refresh everything that reads balances after a change that is NOT a journal
 * entry: a TB grid cell edit, a balances import, a row sync. Only the queries
 * mounted on the current page actually refetch; the rest are marked stale.
 */
export function invalidateAfterBalanceChange(qc: QueryClient): void {
  invalidatePrefixes(qc, BALANCE_DEPENDENTS);
}

/**
 * Assigning or removing a tickmark moves two caches, because two screens show
 * the same `tb_tickmarks` rows: the Trial Balance grid reads them keyed by
 * account (`tb-tickmarks`), while the lead schedules get them embedded in each
 * member row (`lead-sheets-period`). Toggling from one screen used to leave the
 * other showing the old marks.
 *
 * Not a sign-off concern: the staleness stamp hashes raw TB amounts, so a mark
 * does not make a signed schedule stale.
 */
export function invalidateAfterTickmarkToggle(qc: QueryClient): void {
  void qc.invalidateQueries({ queryKey: ['tb-tickmarks'] });
  void qc.invalidateQueries({ queryKey: ['lead-sheets-period'] });
}
