/**
 * Transaction Entry: per-client default source (bank) account.
 *
 * clients.default_source_account_id → chart_of_accounts.id. New register rows
 * on the Transaction Entry page pre-fill their Account column with it. SET NULL
 * on delete so removing the account never blocks and simply clears the default.
 */
exports.up = (knex) => knex.schema.alterTable('clients', (t) => {
  t.integer('default_source_account_id')
    .nullable()
    .references('id')
    .inTable('chart_of_accounts')
    .onDelete('SET NULL');
});

exports.down = (knex) => knex.schema.alterTable('clients', (t) => {
  t.dropColumn('default_source_account_id');
});
