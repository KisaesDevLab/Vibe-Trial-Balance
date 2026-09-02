/**
 * chart_of_accounts.qbo_account_name — the QuickBooks display name the
 * account was last linked under ("60400 Bank Service Charges:60450 Overdraft
 * Fees"). Written by the QBO import alongside qbo_account_id and by the TB
 * CSV import when the file carries a quickbooks_account_description column,
 * so a connector import can place an account by the name the bookkeeper's
 * export recorded even when QBO's own account numbers are switched off.
 */
exports.up = async function (knex) {
  if (!(await knex.schema.hasColumn('chart_of_accounts', 'qbo_account_name'))) {
    await knex.schema.alterTable('chart_of_accounts', (t) => {
      t.string('qbo_account_name', 255).nullable();
    });
  }
};

exports.down = async function (knex) {
  if (await knex.schema.hasColumn('chart_of_accounts', 'qbo_account_name')) {
    await knex.schema.alterTable('chart_of_accounts', (t) => {
      t.dropColumn('qbo_account_name');
    });
  }
};
