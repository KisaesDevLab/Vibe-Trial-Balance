/**
 * Migration: system_tickmarks table
 *
 * Stores firm-wide default tickmarks that admins can apply to any client's
 * tickmark library in one click (missing symbols are copied; existing ones
 * are left untouched).
 */
exports.up = async function (knex) {
  await knex.schema.createTable('system_tickmarks', (t) => {
    t.increments('id').primary();
    t.string('symbol', 10).notNullable();
    t.string('description', 500).notNullable();
    t.enum('color', ['gray', 'blue', 'green', 'red', 'purple', 'amber']).notNullable().defaultTo('gray');
    t.integer('sort_order').notNullable().defaultTo(0);
    t.integer('created_by').references('id').inTable('app_users').onDelete('SET NULL');
    t.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    t.unique(['symbol']);
  });
};

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('system_tickmarks');
};
