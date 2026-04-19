exports.up = async function(knex) {
  await knex.schema.alterTable('ai_usage_log', (t) => {
    t.string('status', 20).notNullable().defaultTo('success');
    t.string('finish_reason', 50);
    t.text('error_message');
    t.integer('duration_ms');
    t.integer('max_tokens');
    t.integer('http_status');
    t.index('status', 'ai_usage_log_status_idx');
  });
};

exports.down = async function(knex) {
  await knex.schema.alterTable('ai_usage_log', (t) => {
    t.dropIndex('status', 'ai_usage_log_status_idx');
    t.dropColumn('status');
    t.dropColumn('finish_reason');
    t.dropColumn('error_message');
    t.dropColumn('duration_ms');
    t.dropColumn('max_tokens');
    t.dropColumn('http_status');
  });
};
