// Copyright 2025-2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Use is limited to qualifying small businesses. See LICENSE for terms.

/**
 * The DB half of lead sheet sign-off staleness. Kept out of lib/leadSheets.ts
 * so that file stays pure and testable without a database.
 *
 * EVERY producer of a balance stamp — the sign-off route, the period detail
 * route and the PDF generator — must go through `loadStampRows` here. If one
 * of them filtered rows differently the PDF would read STALE while the screen
 * read SIGNED, which is the worst possible failure for a sign-off feature.
 *
 * The row set is deliberately `is_active` only, with NO dormancy filter: the
 * PDF applies `whereHasActivity` for *display*, but a dormant account joining
 * or leaving a lead sheet still changes what was signed off on.
 */

import type { Knex } from 'knex';
import { leadSheetBalanceStamp, type StampRow } from './leadSheets';

/** Raw TB rows for the given accounts in one period. */
export async function loadStampRows(
  q: Knex | Knex.Transaction,
  periodId: number,
  accountIds: number[],
): Promise<StampRow[]> {
  if (accountIds.length === 0) return [];
  return q('v_adjusted_trial_balance as vtb')
    .where('vtb.period_id', periodId)
    .where('vtb.is_active', true)
    .whereIn('vtb.account_id', accountIds)
    .select(
      'vtb.account_id',
      'vtb.unadjusted_debit', 'vtb.unadjusted_credit',
      'vtb.prior_year_debit', 'vtb.prior_year_credit',
      'vtb.trans_adj_debit', 'vtb.trans_adj_credit',
      'vtb.book_adj_debit', 'vtb.book_adj_credit',
      'vtb.tax_adj_debit', 'vtb.tax_adj_credit',
    ) as Promise<StampRow[]>;
}

/** The current stamp for one lead sheet. */
export async function currentStampFor(
  q: Knex | Knex.Transaction,
  periodId: number,
  leadSheetId: number,
): Promise<string> {
  const accounts = await q('chart_of_accounts')
    .where({ lead_sheet_id: leadSheetId, is_active: true })
    .pluck('id');
  const rows = await loadStampRows(q, periodId, accounts as number[]);
  return leadSheetBalanceStamp(rows);
}

/**
 * Current stamps for every lead sheet of a client, in one pass — the left rail
 * needs all of them and N round trips would be silly.
 */
export async function currentStampsForClient(
  q: Knex | Knex.Transaction,
  periodId: number,
  clientId: number,
): Promise<Map<number, string>> {
  const accounts = await q('chart_of_accounts')
    .where({ client_id: clientId, is_active: true })
    .whereNotNull('lead_sheet_id')
    .select('id', 'lead_sheet_id') as Array<{ id: number; lead_sheet_id: number }>;

  const byLeadSheet = new Map<number, number[]>();
  for (const a of accounts) {
    if (!byLeadSheet.has(a.lead_sheet_id)) byLeadSheet.set(a.lead_sheet_id, []);
    byLeadSheet.get(a.lead_sheet_id)!.push(a.id);
  }

  const rows = await loadStampRows(q, periodId, accounts.map((a) => a.id));
  const rowByAccount = new Map<number, StampRow>(rows.map((r) => [r.account_id, r]));

  const out = new Map<number, string>();
  for (const [leadSheetId, ids] of byLeadSheet) {
    const subset = ids
      .map((id) => rowByAccount.get(id))
      .filter((r): r is StampRow => !!r);
    out.set(leadSheetId, leadSheetBalanceStamp(subset));
  }
  return out;
}

/** A lead sheet with no accounts still has a well-defined (empty) stamp. */
export function emptyStamp(): string {
  return leadSheetBalanceStamp([]);
}
