/**
 * Migration: Restore preparer_notes and reviewer_notes to v_adjusted_trial_balance.
 *
 * Migration 20260322000003 (split_trans_from_book_adj) recreated the view but
 * accidentally dropped coa.preparer_notes and coa.reviewer_notes, breaking the
 * notes feature on the Trial Balance screen.
 */
exports.up = async function (knex) {
  await knex.raw('DROP VIEW IF EXISTS v_adjusted_trial_balance');
  await knex.raw(`CREATE VIEW v_adjusted_trial_balance AS
    SELECT
      tb.period_id,
      tb.account_id,
      coa.account_number,
      coa.account_name,
      coa.category,
      coa.normal_balance,
      coa.tax_line,
      coa.workpaper_ref,
      coa.unit,
      coa.is_active,
      coa.preparer_notes,
      coa.reviewer_notes,
      tb.unadjusted_debit,
      tb.unadjusted_credit,
      tb.prior_year_debit,
      tb.prior_year_credit,
      COALESCE(tr.td, 0) AS trans_adj_debit,
      COALESCE(tr.tc, 0) AS trans_adj_credit,
      (tb.unadjusted_debit + COALESCE(tr.td, 0)) AS post_trans_debit,
      (tb.unadjusted_credit + COALESCE(tr.tc, 0)) AS post_trans_credit,
      COALESCE(ba.td, 0) AS book_adj_debit,
      COALESCE(ba.tc, 0) AS book_adj_credit,
      COALESCE(ta.td, 0) AS tax_adj_debit,
      COALESCE(ta.tc, 0) AS tax_adj_credit,
      (tb.unadjusted_debit + COALESCE(tr.td, 0) + COALESCE(ba.td, 0)) AS book_adjusted_debit,
      (tb.unadjusted_credit + COALESCE(tr.tc, 0) + COALESCE(ba.tc, 0)) AS book_adjusted_credit,
      (tb.unadjusted_debit + COALESCE(tr.td, 0) + COALESCE(ba.td, 0) + COALESCE(ta.td, 0)) AS tax_adjusted_debit,
      (tb.unadjusted_credit + COALESCE(tr.tc, 0) + COALESCE(ba.tc, 0) + COALESCE(ta.tc, 0)) AS tax_adjusted_credit
    FROM trial_balance tb
    JOIN chart_of_accounts coa ON coa.id = tb.account_id
    LEFT JOIN (
      SELECT jel.account_id, je.period_id, SUM(jel.debit) AS td, SUM(jel.credit) AS tc
      FROM journal_entry_lines jel
      JOIN journal_entries je ON je.id = jel.journal_entry_id
      WHERE je.entry_type = 'trans'
      GROUP BY jel.account_id, je.period_id
    ) tr ON tr.account_id = tb.account_id AND tr.period_id = tb.period_id
    LEFT JOIN (
      SELECT jel.account_id, je.period_id, SUM(jel.debit) AS td, SUM(jel.credit) AS tc
      FROM journal_entry_lines jel
      JOIN journal_entries je ON je.id = jel.journal_entry_id
      WHERE je.entry_type = 'book'
      GROUP BY jel.account_id, je.period_id
    ) ba ON ba.account_id = tb.account_id AND ba.period_id = tb.period_id
    LEFT JOIN (
      SELECT jel.account_id, je.period_id, SUM(jel.debit) AS td, SUM(jel.credit) AS tc
      FROM journal_entry_lines jel
      JOIN journal_entries je ON je.id = jel.journal_entry_id
      WHERE je.entry_type = 'tax'
      GROUP BY jel.account_id, je.period_id
    ) ta ON ta.account_id = tb.account_id AND ta.period_id = tb.period_id`);
};

exports.down = async function (knex) {
  // Revert to the view without preparer_notes/reviewer_notes (state after migration 20260322000003)
  await knex.raw('DROP VIEW IF EXISTS v_adjusted_trial_balance');
  await knex.raw(`CREATE VIEW v_adjusted_trial_balance AS
    SELECT
      tb.period_id,
      tb.account_id,
      coa.account_number,
      coa.account_name,
      coa.category,
      coa.normal_balance,
      coa.tax_line,
      coa.workpaper_ref,
      coa.unit,
      coa.is_active,
      tb.unadjusted_debit,
      tb.unadjusted_credit,
      tb.prior_year_debit,
      tb.prior_year_credit,
      COALESCE(tr.td, 0) AS trans_adj_debit,
      COALESCE(tr.tc, 0) AS trans_adj_credit,
      (tb.unadjusted_debit + COALESCE(tr.td, 0)) AS post_trans_debit,
      (tb.unadjusted_credit + COALESCE(tr.tc, 0)) AS post_trans_credit,
      COALESCE(ba.td, 0) AS book_adj_debit,
      COALESCE(ba.tc, 0) AS book_adj_credit,
      COALESCE(ta.td, 0) AS tax_adj_debit,
      COALESCE(ta.tc, 0) AS tax_adj_credit,
      (tb.unadjusted_debit + COALESCE(tr.td, 0) + COALESCE(ba.td, 0)) AS book_adjusted_debit,
      (tb.unadjusted_credit + COALESCE(tr.tc, 0) + COALESCE(ba.tc, 0)) AS book_adjusted_credit,
      (tb.unadjusted_debit + COALESCE(tr.td, 0) + COALESCE(ba.td, 0) + COALESCE(ta.td, 0)) AS tax_adjusted_debit,
      (tb.unadjusted_credit + COALESCE(tr.tc, 0) + COALESCE(ba.tc, 0) + COALESCE(ta.tc, 0)) AS tax_adjusted_credit
    FROM trial_balance tb
    JOIN chart_of_accounts coa ON coa.id = tb.account_id
    LEFT JOIN (
      SELECT jel.account_id, je.period_id, SUM(jel.debit) AS td, SUM(jel.credit) AS tc
      FROM journal_entry_lines jel
      JOIN journal_entries je ON je.id = jel.journal_entry_id
      WHERE je.entry_type = 'trans'
      GROUP BY jel.account_id, je.period_id
    ) tr ON tr.account_id = tb.account_id AND tr.period_id = tb.period_id
    LEFT JOIN (
      SELECT jel.account_id, je.period_id, SUM(jel.debit) AS td, SUM(jel.credit) AS tc
      FROM journal_entry_lines jel
      JOIN journal_entries je ON je.id = jel.journal_entry_id
      WHERE je.entry_type = 'book'
      GROUP BY jel.account_id, je.period_id
    ) ba ON ba.account_id = tb.account_id AND ba.period_id = tb.period_id
    LEFT JOIN (
      SELECT jel.account_id, je.period_id, SUM(jel.debit) AS td, SUM(jel.credit) AS tc
      FROM journal_entry_lines jel
      JOIN journal_entries je ON je.id = jel.journal_entry_id
      WHERE je.entry_type = 'tax'
      GROUP BY jel.account_id, je.period_id
    ) ta ON ta.account_id = tb.account_id AND ta.period_id = tb.period_id`);
};
