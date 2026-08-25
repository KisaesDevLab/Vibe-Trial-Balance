// Copyright 2025-2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Use is limited to qualifying small businesses. See LICENSE for terms.

import { Knex } from 'knex';

/**
 * Dormant-account suppression for reports.
 *
 * An account is dormant for a period when it has no beginning balance, no
 * activity of any kind, and therefore no ending balance — every amount on the
 * trial balance row is zero. Dormant accounts are noise on a report, so report
 * PDFs and exports hide them. GET /periods/:id/trial-balance still returns
 * them unfiltered: it feeds the editable TB grid and the Tax Mapping page,
 * which have to show a row before you can type a balance into it.
 *
 * Note that "no activity" is stricter than "beginning equals ending": an
 * account that was debited and credited back to zero during the year has
 * activity and stays on the report.
 *
 * Client-side mirror: client/src/utils/tbActivity.ts — keep the two in sync.
 */

/** Every amount column that can make a trial balance row non-dormant. */
const ACTIVITY_FIELDS = [
  'prior_year_debit', 'prior_year_credit',     // beginning balance
  'unadjusted_debit', 'unadjusted_credit',     // ending balance per books
  'trans_adj_debit', 'trans_adj_credit',       // transaction JEs
  'book_adj_debit', 'book_adj_credit',         // book AJEs
  'tax_adj_debit', 'tax_adj_credit',           // tax AJEs
] as const;

/**
 * Knex WHERE modifier restricting v_adjusted_trial_balance to non-dormant rows.
 * Works regardless of the query's select list — the columns live on the view.
 * Pass the table alias when the query aliases the view (e.g. 'vtb').
 */
export function whereHasActivity<T extends Knex.QueryBuilder>(qb: T, alias?: string): T {
  const p = alias ? `"${alias}".` : '';
  const clause = ACTIVITY_FIELDS.map((f) => `COALESCE(${p}${f}, 0) <> 0`).join(' OR ');
  return qb.whereRaw(`(${clause})`) as T;
}

/** True when the row has a beginning balance, activity, or an ending balance. */
export function hasReportableActivity(row: Record<string, unknown>): boolean {
  return ACTIVITY_FIELDS.some((f) => Number(row[f] ?? 0) !== 0);
}
