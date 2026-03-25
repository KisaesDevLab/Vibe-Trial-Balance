exports.up = async function(knex) {
  await knex('settings')
    .insert([
      { key: 'ai_model_fast',    value: 'claude-haiku-4-5-20251001', updated_at: knex.fn.now() },
      { key: 'ai_model_primary', value: 'claude-sonnet-4-6',         updated_at: knex.fn.now() },
    ])
    .onConflict('key')
    .ignore();
};

exports.down = async function(knex) {
  await knex('settings').whereIn('key', ['ai_model_fast', 'ai_model_primary']).delete();
};
