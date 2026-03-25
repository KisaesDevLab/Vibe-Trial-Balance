/**
 * Phase 11: Engagement Management – engagement_tasks table
 */
exports.up = async function (knex) {
  await knex.schema.createTable('engagement_tasks', (t) => {
    t.increments('id').primary();
    t.integer('period_id').notNullable().references('id').inTable('periods').onDelete('CASCADE');
    t.string('title', 500).notNullable();
    t.text('description').nullable();
    t.string('category', 100).nullable();
    t.string('status', 20).notNullable().defaultTo('open'); // open | in_progress | review | completed | n_a
    t.integer('assignee_id').nullable().references('id').inTable('app_users');
    t.integer('sort_order').notNullable().defaultTo(0);
    t.text('notes').nullable();
    t.integer('completed_by').nullable().references('id').inTable('app_users');
    t.timestamp('completed_at').nullable();
    t.integer('created_by').nullable().references('id').inTable('app_users');
    t.timestamp('created_at').defaultTo(knex.fn.now());
    t.timestamp('updated_at').defaultTo(knex.fn.now());
  });
};

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('engagement_tasks');
};
