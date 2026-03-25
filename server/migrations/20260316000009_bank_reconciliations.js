/**
 * Migration: Bank reconciliation tables
 */
exports.up = async function (knex) {
  await knex.schema.createTable('bank_reconciliations', (t) => {
    t.increments('id').primary();
    t.integer('client_id').unsigned().notNullable().references('id').inTable('clients').onDelete('CASCADE');
    t.integer('source_account_id').unsigned().notNullable().references('id').inTable('chart_of_accounts');
    t.integer('period_id').unsigned().references('id').inTable('periods');
    t.date('statement_date').notNullable();
    t.bigInteger('statement_ending_balance').notNullable().defaultTo(0); // cents
    t.bigInteger('beginning_book_balance').notNullable().defaultTo(0);   // cents, snapshot at creation
    t.string('status', 20).notNullable().defaultTo('open'); // 'open' | 'completed'
    t.text('notes');
    t.integer('created_by').unsigned().references('id').inTable('app_users');
    t.integer('completed_by').unsigned().references('id').inTable('app_users');
    t.timestamp('completed_at', { useTz: true });
    t.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());
  });

  await knex.schema.createTable('reconciliation_items', (t) => {
    t.increments('id').primary();
    t.integer('reconciliation_id').unsigned().notNullable()
      .references('id').inTable('bank_reconciliations').onDelete('CASCADE');
    t.integer('transaction_id').unsigned().notNullable()
      .references('id').inTable('bank_transactions').onDelete('CASCADE');
    t.timestamp('cleared_at', { useTz: true }).defaultTo(knex.fn.now());
    t.unique(['reconciliation_id', 'transaction_id']);
  });
};

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('reconciliation_items');
  await knex.schema.dropTableIfExists('bank_reconciliations');
};
