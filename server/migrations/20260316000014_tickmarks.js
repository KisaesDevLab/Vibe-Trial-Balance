/**
 * Phase 13: Workpaper Package & Tickmarks
 */
exports.up = async function (knex) {
  await knex.schema.createTable('tickmark_library', (t) => {
    t.increments('id').primary();
    t.integer('client_id').notNullable().references('id').inTable('clients').onDelete('CASCADE');
    t.string('symbol', 10).notNullable();          // e.g. "A", "B", "✓", "†"
    t.string('description', 500).notNullable();    // e.g. "Agreed to bank statement"
    t.string('color', 20).notNullable().defaultTo('gray'); // gray|blue|green|red|purple|amber
    t.integer('sort_order').notNullable().defaultTo(0);
    t.integer('created_by').nullable().references('id').inTable('app_users');
    t.timestamp('created_at').defaultTo(knex.fn.now());
  });

  await knex.schema.createTable('tb_tickmarks', (t) => {
    t.increments('id').primary();
    t.integer('period_id').notNullable().references('id').inTable('periods').onDelete('CASCADE');
    t.integer('account_id').notNullable().references('id').inTable('chart_of_accounts').onDelete('CASCADE');
    t.integer('tickmark_id').notNullable().references('id').inTable('tickmark_library').onDelete('CASCADE');
    t.integer('created_by').nullable().references('id').inTable('app_users');
    t.timestamp('created_at').defaultTo(knex.fn.now());
    t.unique(['period_id', 'account_id', 'tickmark_id']);
  });
};

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('tb_tickmarks');
  await knex.schema.dropTableIfExists('tickmark_library');
};
