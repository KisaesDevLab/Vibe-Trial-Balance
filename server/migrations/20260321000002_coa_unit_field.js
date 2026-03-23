/**
 * Migration: Replace sort_order with unit on chart_of_accounts.
 * - Drops sort_order column (ordering by account_number is the natural sort)
 * - Adds unit VARCHAR(100) NULL for multi-property / multi-entity grouping
 * - Recreates v_adjusted_trial_balance view without sort_order, with unit
 */

const NEW_VIEW_SQL = `
  CREATE VIEW v_adjusted_trial_balance AS
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
    COALESCE(ba.td, 0) AS book_adj_debit,
    COALESCE(ba.tc, 0) AS book_adj_credit,
    COALESCE(ta.td, 0) AS tax_adj_debit,
    COALESCE(ta.tc, 0) AS tax_adj_credit,
    (tb.unadjusted_debit + COALESCE(ba.td, 0))                        AS book_adjusted_debit,
    (tb.unadjusted_credit + COALESCE(ba.tc, 0))                       AS book_adjusted_credit,
    (tb.unadjusted_debit + COALESCE(ba.td, 0) + COALESCE(ta.td, 0))  AS tax_adjusted_debit,
    (tb.unadjusted_credit + COALESCE(ba.tc, 0) + COALESCE(ta.tc, 0)) AS tax_adjusted_credit
  FROM trial_balance tb
  JOIN chart_of_accounts coa ON coa.id = tb.account_id
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
`;

const OLD_VIEW_SQL = `
  CREATE VIEW v_adjusted_trial_balance AS
  SELECT tb.period_id, tb.account_id, coa.account_number, coa.account_name, coa.category, coa.normal_balance, coa.tax_line, coa.workpaper_ref, coa.sort_order, coa.is_active, tb.unadjusted_debit, tb.unadjusted_credit, COALESCE(ba.td, 0) AS book_adj_debit, COALESCE(ba.tc, 0) AS book_adj_credit, COALESCE(ta.td, 0) AS tax_adj_debit, COALESCE(ta.tc, 0) AS tax_adj_credit, (tb.unadjusted_debit + COALESCE(ba.td, 0)) AS book_adjusted_debit, (tb.unadjusted_credit + COALESCE(ba.tc, 0)) AS book_adjusted_credit, (tb.unadjusted_debit + COALESCE(ba.td, 0) + COALESCE(ta.td, 0)) AS tax_adjusted_debit, (tb.unadjusted_credit + COALESCE(ba.tc, 0) + COALESCE(ta.tc, 0)) AS tax_adjusted_credit FROM trial_balance tb JOIN chart_of_accounts coa ON coa.id = tb.account_id LEFT JOIN (SELECT jel.account_id, je.period_id, SUM(jel.debit) AS td, SUM(jel.credit) AS tc FROM journal_entry_lines jel JOIN journal_entries je ON je.id = jel.journal_entry_id WHERE je.entry_type = 'book' GROUP BY jel.account_id, je.period_id) ba ON ba.account_id = tb.account_id AND ba.period_id = tb.period_id LEFT JOIN (SELECT jel.account_id, je.period_id, SUM(jel.debit) AS td, SUM(jel.credit) AS tc FROM journal_entry_lines jel JOIN journal_entries je ON je.id = jel.journal_entry_id WHERE je.entry_type = 'tax' GROUP BY jel.account_id, je.period_id) ta ON ta.account_id = tb.account_id AND ta.period_id = tb.period_id
`;

exports.up = async function (knex) {
  await knex.raw('DROP VIEW IF EXISTS v_adjusted_trial_balance');

  await knex.schema.alterTable('chart_of_accounts', (t) => {
    t.dropColumn('sort_order');
    t.string('unit', 100).nullable();
  });

  await knex.raw(NEW_VIEW_SQL);
};

exports.down = async function (knex) {
  await knex.raw('DROP VIEW IF EXISTS v_adjusted_trial_balance');

  await knex.schema.alterTable('chart_of_accounts', (t) => {
    t.dropColumn('unit');
    t.integer('sort_order').defaultTo(0);
  });

  await knex.raw(OLD_VIEW_SQL);
};
