/**
 * Migration: Backfill missing trial_balance rows for accounts referenced by
 * journal_entry_lines but not present in trial_balance.
 *
 * The v_adjusted_trial_balance view starts FROM trial_balance, so any JE line
 * referencing an account without a TB row is invisible — causing the AJE columns
 * on the TB grid to not balance while the AJE Listing shows them balanced.
 */
exports.up = async function (knex) {
  // Find all (period_id, account_id) pairs in journal_entry_lines that have
  // no corresponding trial_balance row
  const missing = await knex.raw(`
    SELECT DISTINCT je.period_id, jel.account_id
    FROM journal_entry_lines jel
    JOIN journal_entries je ON je.id = jel.journal_entry_id
    LEFT JOIN trial_balance tb ON tb.period_id = je.period_id AND tb.account_id = jel.account_id
    WHERE tb.id IS NULL
  `);

  const rows = missing.rows || missing;
  if (rows.length === 0) return;

  await knex('trial_balance').insert(
    rows.map((r) => ({
      period_id: r.period_id,
      account_id: r.account_id,
      unadjusted_debit: 0,
      unadjusted_credit: 0,
      prior_year_debit: 0,
      prior_year_credit: 0,
    })),
  );
};

exports.down = async function () {
  // Cannot reliably remove only the backfilled rows without tracking them.
  // This is a data-repair migration; rolling back is a no-op.
};
