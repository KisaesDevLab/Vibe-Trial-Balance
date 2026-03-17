/**
 * Phase 12: Reporting Enhancements
 * - cash_flow_category on chart_of_accounts
 * - saved_reports table for custom report builder
 */
exports.up = async function (knex) {
  // Add cash flow category to COA
  await knex.schema.alterTable('chart_of_accounts', (t) => {
    t.string('cash_flow_category', 20).nullable().defaultTo(null);
    // Values: 'operating' | 'investing' | 'financing' | 'non_cash' | 'cash'
  });

  // Saved reports
  await knex.schema.createTable('saved_reports', (t) => {
    t.increments('id').primary();
    t.integer('client_id').notNullable().references('id').inTable('clients').onDelete('CASCADE');
    t.string('name', 255).notNullable();
    t.jsonb('config').notNullable().defaultTo('{}');
    t.integer('created_by').nullable().references('id').inTable('app_users');
    t.timestamp('created_at').defaultTo(knex.fn.now());
    t.timestamp('updated_at').defaultTo(knex.fn.now());
  });
};

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('saved_reports');
  await knex.schema.alterTable('chart_of_accounts', (t) => {
    t.dropColumn('cash_flow_category');
  });
};
