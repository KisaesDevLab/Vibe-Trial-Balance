/**
 * Migration: expose the lead sheet on v_adjusted_trial_balance.
 *
 * This file is now the authoritative definition of the view (it supersedes
 * 20260408000001_tb_view_expose_updated_at.js). Any later migration that adds
 * a column must copy the SQL below, not an older revision.
 *
 * Kept separate from 20260828000001_lead_sheets.js so a batch rollback restores
 * the lead-sheet-free view BEFORE dropping the lead_sheets table it joins to.
 *
 * The join is a LEFT JOIN on purpose: an INNER JOIN would silently drop every
 * account that has no lead sheet from the entire trial balance.
 */

const VIEW_WITH_LEAD_SHEET = `CREATE VIEW v_adjusted_trial_balance AS
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
      coa.lead_sheet_id,
      ls.code AS lead_sheet_code,
      ls.name AS lead_sheet_name,
      ls.sort_order AS lead_sheet_sort,
      tb.unadjusted_debit,
      tb.unadjusted_credit,
      tb.prior_year_debit,
      tb.prior_year_credit,
      tb.updated_at AS row_updated_at,
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
    LEFT JOIN lead_sheets ls ON ls.id = coa.lead_sheet_id
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
    ) ta ON ta.account_id = tb.account_id AND ta.period_id = tb.period_id`;

// Verbatim copy of 20260408000001's up() body — must not reference lead_sheets,
// because that table is dropped immediately after this down() runs.
const VIEW_WITHOUT_LEAD_SHEET = `CREATE VIEW v_adjusted_trial_balance AS
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
      tb.updated_at AS row_updated_at,
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
    ) ta ON ta.account_id = tb.account_id AND ta.period_id = tb.period_id`;

exports.up = async function (knex) {
  await knex.raw('DROP VIEW IF EXISTS v_adjusted_trial_balance');
  await knex.raw(VIEW_WITH_LEAD_SHEET);
};

exports.down = async function (knex) {
  await knex.raw('DROP VIEW IF EXISTS v_adjusted_trial_balance');
  await knex.raw(VIEW_WITHOUT_LEAD_SHEET);
};
