exports.up = async function (knex) {
  await knex.schema.alterTable('bank_transactions', (t) => {
    t.integer('journal_entry_id').unsigned().references('id').inTable('journal_entries').onDelete('SET NULL').after('source_account_id');
  });
};

exports.down = async function (knex) {
  await knex.schema.alterTable('bank_transactions', (t) => {
    t.dropColumn('journal_entry_id');
  });
};
