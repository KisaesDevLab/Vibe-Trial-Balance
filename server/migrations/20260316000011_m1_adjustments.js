/**
 * Phase 10: Tax Workpapers – M-1 adjustments table
 */
exports.up = async function (knex) {
  await knex.schema.createTable('m1_adjustments', (t) => {
    t.increments('id').primary();
    t.integer('period_id').notNullable().references('id').inTable('periods').onDelete('CASCADE');
    t.string('description', 500).notNullable();
    t.string('category', 100).nullable();
    t.bigInteger('book_amount').notNullable().defaultTo(0);  // cents
    t.bigInteger('tax_amount').notNullable().defaultTo(0);   // cents
    t.integer('sort_order').notNullable().defaultTo(0);
    t.text('notes').nullable();
    t.integer('created_by').references('id').inTable('app_users');
    t.timestamp('created_at').defaultTo(knex.fn.now());
    t.timestamp('updated_at').defaultTo(knex.fn.now());
  });
};

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('m1_adjustments');
};
