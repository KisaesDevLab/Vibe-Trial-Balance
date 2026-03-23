exports.up = async function(knex) {
  await knex.schema.createTable('backup_history', function(table) {
    table.increments('id').primary();
    table.string('backup_type', 20).notNullable();   // 'full', 'settings', 'client', 'period'
    table.string('backup_level', 20).notNullable();  // same as backup_type
    table.integer('client_id').references('id').inTable('clients');
    table.string('client_name', 255);
    table.integer('period_id').references('id').inTable('periods');
    table.string('period_name', 100);
    table.string('filename', 255).notNullable();
    table.bigInteger('file_size');
    table.string('checksum', 100);
    table.string('storage_local', 500);
    table.string('trigger_type', 20).notNullable(); // 'manual', 'scheduled', 'pre_restore'
    table.string('status', 20).defaultTo('completed'); // 'in_progress', 'completed', 'failed'
    table.text('error_message');
    table.jsonb('record_counts');
    table.integer('created_by').references('id').inTable('app_users');
    table.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());
  });

  await knex.schema.createTable('restore_history', function(table) {
    table.increments('id').primary();
    table.integer('backup_id').references('id').inTable('backup_history');
    table.string('restore_mode', 20).notNullable(); // 'as_new', 'replace', 'merge_period', 'settings'
    table.integer('target_client_id');
    table.string('target_client_name', 255);
    table.integer('new_client_id');
    table.jsonb('id_mappings');
    table.string('status', 20).defaultTo('completed'); // 'completed', 'failed', 'rolled_back'
    table.text('error_message');
    table.integer('restored_by').references('id').inTable('app_users');
    table.timestamp('restored_at', { useTz: true }).defaultTo(knex.fn.now());
  });

  // app_settings if not exists
  const hasSettings = await knex.schema.hasTable('app_settings');
  if (!hasSettings) {
    await knex.schema.createTable('app_settings', function(table) {
      table.string('key', 100).primary();
      table.jsonb('value').notNullable();
      table.timestamp('updated_at', { useTz: true }).defaultTo(knex.fn.now());
      table.integer('updated_by').references('id').inTable('app_users');
    });
  }
};

exports.down = async function(knex) {
  await knex.schema.dropTableIfExists('restore_history');
  await knex.schema.dropTableIfExists('backup_history');
};
