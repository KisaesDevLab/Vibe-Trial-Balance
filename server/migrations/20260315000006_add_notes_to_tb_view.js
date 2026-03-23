/**
 * Migration: Add preparer_notes and reviewer_notes to v_adjusted_trial_balance view
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
      coa.sort_order,
      coa.is_active,
      coa.preparer_notes,
      coa.reviewer_notes,
      tb.unadjusted_debit,
      tb.unadjusted_credit,
      COALESCE(ba.td, 0) AS book_adj_debit,
      COALESCE(ba.tc, 0) AS book_adj_credit,
      COALESCE(ta.td, 0) AS tax_adj_debit,
      COALESCE(ta.tc, 0) AS tax_adj_credit,
      (tb.unadjusted_debit + COALESCE(ba.td, 0)) AS book_adjusted_debit,
      (tb.unadjusted_credit + COALESCE(ba.tc, 0)) AS book_adjusted_credit,
      (tb.unadjusted_debit + COALESCE(ba.td, 0) + COALESCE(ta.td, 0)) AS tax_adjusted_debit,
      (tb.unadjusted_credit + COALESCE(ba.tc, 0) + COALESCE(ta.tc, 0)) AS tax_adjusted_credit
    FROM trial_balance tb
    JOIN chart_of_accounts coa ON coa.id = tb.account_id
    LEFT JOIN (
      SELECT jel.account_id, je.period_id, SUM(jel.debit) AS td, SUM(jel.credit) AS tc
      FROM journal_entry_lines jel
      JOIN journal_entries je ON je.id = jel.journal_entry_id
      WHERE je.entry_type IN ('book', 'trans')
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
      coa.sort_order,
      coa.is_active,
      tb.unadjusted_debit,
      tb.unadjusted_credit,
      COALESCE(ba.td, 0) AS book_adj_debit,
      COALESCE(ba.tc, 0) AS book_adj_credit,
      COALESCE(ta.td, 0) AS tax_adj_debit,
      COALESCE(ta.tc, 0) AS tax_adj_credit,
      (tb.unadjusted_debit + COALESCE(ba.td, 0)) AS book_adjusted_debit,
      (tb.unadjusted_credit + COALESCE(ba.tc, 0)) AS book_adjusted_credit,
      (tb.unadjusted_debit + COALESCE(ba.td, 0) + COALESCE(ta.td, 0)) AS tax_adjusted_debit,
      (tb.unadjusted_credit + COALESCE(ba.tc, 0) + COALESCE(ta.tc, 0)) AS tax_adjusted_credit
    FROM trial_balance tb
    JOIN chart_of_accounts coa ON coa.id = tb.account_id
    LEFT JOIN (
      SELECT jel.account_id, je.period_id, SUM(jel.debit) AS td, SUM(jel.credit) AS tc
      FROM journal_entry_lines jel
      JOIN journal_entries je ON je.id = jel.journal_entry_id
      WHERE je.entry_type IN ('book', 'trans')
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
