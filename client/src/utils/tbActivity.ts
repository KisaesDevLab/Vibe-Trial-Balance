// Copyright 2025-2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Use is limited to qualifying small businesses. See LICENSE for terms.

/**
 * Dormant-account suppression for reports.
 *
 * An account is dormant for a period when it has no beginning balance, no
 * activity of any kind, and therefore no ending balance — every amount on the
 * trial balance row is zero. Dormant accounts are noise on a report, so every
 * report view/PDF/export hides them. The editable Trial Balance grid, the Tax
 * Mapping page and the Chart of Accounts still show them: you can't type a
 * balance into a row that isn't rendered.
 *
 * Note that "no activity" is stricter than "beginning equals ending": an
 * account that was debited and credited back to zero during the year has
 * activity and stays on the report.
 *
 * Server-side mirror: server/src/lib/tbActivity.ts — keep the two in sync.
 */

/** Every amount column that can make a trial balance row non-dormant. */
const ACTIVITY_FIELDS = [
  'prior_year_debit', 'prior_year_credit',     // beginning balance
  'unadjusted_debit', 'unadjusted_credit',     // ending balance per books
  'trans_adj_debit', 'trans_adj_credit',       // transaction JEs
  'book_adj_debit', 'book_adj_credit',         // book AJEs
  'tax_adj_debit', 'tax_adj_credit',           // tax AJEs
] as const;

/** True when the row has a beginning balance, activity, or an ending balance. */
export function hasReportableActivity(row: Partial<Record<(typeof ACTIVITY_FIELDS)[number], number | string | null>>): boolean {
  return ACTIVITY_FIELDS.some((f) => Number(row[f] ?? 0) !== 0);
}

/** Drops dormant (all-zero) rows from a report population. */
export function filterReportableRows<T extends Parameters<typeof hasReportableActivity>[0]>(rows: T[]): T[] {
  return rows.filter(hasReportableActivity);
}
