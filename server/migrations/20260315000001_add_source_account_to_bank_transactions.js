exports.up = async function (knex) {
  await knex.schema.alterTable('bank_transactions', (t) => {
    t.integer('source_account_id').unsigned().references('id').inTable('chart_of_accounts').after('period_id');
  });
};

exports.down = async function (knex) {
  await knex.schema.alterTable('bank_transactions', (t) => {
    t.dropColumn('source_account_id');
  });
};
