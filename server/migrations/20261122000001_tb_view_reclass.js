/**
 * Migration: reclassifying journal entries (entry_type 'reclass', RJE-n).
 *
 * This file is now the authoritative definition of v_adjusted_trial_balance
 * (it supersedes 20260828000002_tb_view_lead_sheet.js). Any later migration
 * that adds a column must copy THIS SQL, and keep the LEFT JOINs.
 *
 * An RJE moves amounts between accounts for presentation: it is part of the
 * book-adjusted (and so the tax-adjusted) balance, but it is not an adjusting
 * entry proposed to the client, so it gets its own layer, reclass_adj_*, and
 * book_adj_* stays book entries only. The new columns go LAST so every
 * existing column keeps its position.
 *
 * entry_type is varchar(10) with no CHECK constraint; numbering is already
 * per (period, type) through uje_period_type_number.
 */

const VIEW_WITH_RECLASS = `CREATE VIEW v_adjusted_trial_balance AS
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
      (tb.unadjusted_debit + COALESCE(tr.td, 0) + COALESCE(ba.td, 0) + COALESCE(ra.td, 0)) AS book_adjusted_debit,
      (tb.unadjusted_credit + COALESCE(tr.tc, 0) + COALESCE(ba.tc, 0) + COALESCE(ra.tc, 0)) AS book_adjusted_credit,
      (tb.unadjusted_debit + COALESCE(tr.td, 0) + COALESCE(ba.td, 0) + COALESCE(ra.td, 0) + COALESCE(ta.td, 0)) AS tax_adjusted_debit,
      (tb.unadjusted_credit + COALESCE(tr.tc, 0) + COALESCE(ba.tc, 0) + COALESCE(ra.tc, 0) + COALESCE(ta.tc, 0)) AS tax_adjusted_credit,
      COALESCE(ra.td, 0) AS reclass_adj_debit,
      COALESCE(ra.tc, 0) AS reclass_adj_credit
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
    ) ta ON ta.account_id = tb.account_id AND ta.period_id = tb.period_id
    LEFT JOIN (
      SELECT jel.account_id, je.period_id, SUM(jel.debit) AS td, SUM(jel.credit) AS tc
      FROM journal_entry_lines jel
      JOIN journal_entries je ON je.id = jel.journal_entry_id
      WHERE je.entry_type = 'reclass'
      GROUP BY jel.account_id, je.period_id
    ) ra ON ra.account_id = tb.account_id AND ra.period_id = tb.period_id`;

// Verbatim copy of 20260828000002's view.
const VIEW_BEFORE_RECLASS = `CREATE VIEW v_adjusted_trial_balance AS
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

exports.up = async function (knex) {
  await knex.raw('DROP VIEW IF EXISTS v_adjusted_trial_balance');
  await knex.raw(VIEW_WITH_RECLASS);
};

exports.down = async function (knex) {
  // The old view would silently drop reclass entries from book adjusted, and
  // turning them into book entries is not a rollback's call: refuse while any exist.
  const { rows } = await knex.raw("SELECT count(*)::int AS n FROM journal_entries WHERE entry_type = 'reclass'");
  if (rows[0].n > 0) throw new Error(`${rows[0].n} reclassifying entries exist; delete or retype them before rolling back`);
  await knex.raw('DROP VIEW IF EXISTS v_adjusted_trial_balance');
  await knex.raw(VIEW_BEFORE_RECLASS);
};
