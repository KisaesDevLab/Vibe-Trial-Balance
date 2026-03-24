// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2024–2026 [Project Author]

import type { Knex } from 'knex';

/**
 * Ensure trial_balance rows exist for a set of account IDs in a given period.
 * Creates zero-balance rows for any missing accounts so that the
 * v_adjusted_trial_balance view can pick up journal entry aggregates.
 */
export async function ensureTrialBalanceRows(
  trx: Knex.Transaction,
  periodId: number,
  accountIds: number[],
): Promise<void> {
  if (accountIds.length === 0) return;
  const unique = [...new Set(accountIds)];
  const existing = await trx('trial_balance')
    .where({ period_id: periodId })
    .whereIn('account_id', unique)
    .pluck('account_id');
  const existingSet = new Set(existing.map(Number));
  const missing = unique.filter((id) => !existingSet.has(id));
  if (missing.length === 0) return;
  await trx('trial_balance').insert(
    missing.map((accountId) => ({
      period_id: periodId,
      account_id: accountId,
      unadjusted_debit: 0,
      unadjusted_credit: 0,
      prior_year_debit: 0,
      prior_year_credit: 0,
    })),
  );
}
