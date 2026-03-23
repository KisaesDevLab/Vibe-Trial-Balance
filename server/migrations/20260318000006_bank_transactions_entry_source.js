/**
 * Phase 25: Add entry_source column to bank_transactions
 * Distinguishes manually entered transactions from imported ones.
 */
exports.up = async function (knex) {
  await knex.schema.alterTable('bank_transactions', (table) => {
    table.string('entry_source', 20).notNullable().defaultTo('import');
  });

  // Backfill existing rows
  await knex('bank_transactions').update({ entry_source: 'import' });
};

exports.down = async function (knex) {
  await knex.schema.alterTable('bank_transactions', (table) => {
    table.dropColumn('entry_source');
  });
};
