exports.up = async function(knex) {
  await knex.schema.createTable('ai_usage_log', (t) => {
    t.increments('id').primary();
    t.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());
    t.integer('user_id').unsigned().references('id').inTable('app_users').onDelete('SET NULL');
    t.integer('client_id').unsigned().references('id').inTable('clients').onDelete('SET NULL');
    t.string('endpoint', 100).notNullable();
    t.string('model', 100).notNullable();
    t.integer('input_tokens').notNullable().defaultTo(0);
    t.integer('output_tokens').notNullable().defaultTo(0);
    t.decimal('estimated_cost_usd', 10, 6);
  });

  // Seed default model pricing
  const defaultPricing = JSON.stringify({
    'claude-haiku-4-5-20251001': { input: 0.80, output: 4.00 },
    'claude-sonnet-4-6':         { input: 3.00, output: 15.00 },
  });
  await knex('settings')
    .insert({ key: 'ai_model_pricing', value: defaultPricing, updated_at: knex.fn.now() })
    .onConflict('key')
    .ignore();
};

exports.down = async function(knex) {
  await knex.schema.dropTableIfExists('ai_usage_log');
  await knex('settings').where({ key: 'ai_model_pricing' }).delete();
};
