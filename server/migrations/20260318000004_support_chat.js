exports.up = async function(knex) {
  await knex.schema.createTable('support_conversations', function(table) {
    table.increments('id').primary();
    table.integer('user_id').notNullable().references('id').inTable('app_users');
    table.string('title', 255);
    table.boolean('is_bookmarked').defaultTo(false);
    table.timestamps(true, true);
  });
  await knex.schema.createTable('support_messages', function(table) {
    table.increments('id').primary();
    table.integer('conversation_id').notNullable().references('id').inTable('support_conversations').onDelete('CASCADE');
    table.string('role', 10).notNullable(); // 'user' or 'assistant'
    table.text('content').notNullable();
    table.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());
  });
};
exports.down = async function(knex) {
  await knex.schema.dropTableIfExists('support_messages');
  await knex.schema.dropTableIfExists('support_conversations');
};
