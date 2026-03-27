/**
 * Migration: Create py_comparison_data table for Prior Year Tie-Out feature.
 *
 * Stores uploaded/entered prior year balances for comparison against
 * rolled-forward PY balances in the current period.
 */
exports.up = async function (knex) {
  await knex.schema.createTable('py_comparison_data', (t) => {
    t.increments('id').primary();
    t.integer('period_id').unsigned().notNullable()
      .references('id').inTable('periods').onDelete('CASCADE');
    t.integer('account_id').unsigned().notNullable()
      .references('id').inTable('chart_of_accounts');
    t.bigInteger('py_debit').notNullable().defaultTo(0);
    t.bigInteger('py_credit').notNullable().defaultTo(0);
    t.string('source', 10).notNullable(); // 'csv', 'excel', 'pdf', 'manual'
    t.string('source_filename', 255);
    t.timestamp('uploaded_at').defaultTo(knex.fn.now());
    t.integer('uploaded_by').unsigned().references('id').inTable('app_users');
    t.unique(['period_id', 'account_id']);
  });

  await knex.schema.raw('CREATE INDEX idx_pycd_period ON py_comparison_data(period_id)');
};

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('py_comparison_data');
};
