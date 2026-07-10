// Copyright 2025-2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Use is limited to qualifying small businesses. See LICENSE for terms.

// Canonical sign conventions for aggregating trial-balance amounts.
// Mirrors server/src/lib/accounting.ts — keep the two in sync.
//
// Category-based signing is the ONLY correct basis for subtotals, net income,
// and balance checks: contra accounts (e.g. Accumulated Depreciation is
// category 'assets' with normal_balance 'credit') must come out negative
// within their category so totals net correctly. Per-account normal_balance
// flipping is a per-row display convention and must never feed an aggregate.

export const DEBIT_NORMAL_CATEGORIES: ReadonlySet<string> = new Set(['assets', 'expenses']);

/**
 * Signed net balance under the category convention:
 * assets/expenses positive when debit-heavy, liabilities/equity/revenue
 * positive when credit-heavy. Contra accounts come out negative.
 */
export function categoryNet(category: string, debit: number, credit: number): number {
  return DEBIT_NORMAL_CATEGORIES.has(category) ? debit - credit : credit - debit;
}

/**
 * Contribution of an income-statement account to net income:
 * revenue adds (credit - debit), expenses subtract (debit - credit) —
 * algebraically credit - debit for both. Non-IS categories contribute 0.
 */
export function netIncomeContribution(category: string, debit: number, credit: number): number {
  if (category !== 'revenue' && category !== 'expenses') return 0;
  return credit - debit;
}
