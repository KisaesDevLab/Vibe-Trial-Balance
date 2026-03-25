exports.up = async function(knex) {
  if (await knex.schema.hasTable('client_documents')) return;
  await knex.schema.createTable('client_documents', function(table) {
    table.increments('id').primary();
    table.integer('client_id').notNullable().references('id').inTable('clients').onDelete('CASCADE');
    table.string('filename', 500).notNullable();
    table.string('file_path', 1000).notNullable();
    table.integer('file_size').notNullable();
    table.string('file_type', 200).notNullable();
    table.integer('linked_account_id').nullable().references('id').inTable('chart_of_accounts').onDelete('SET NULL');
    table.integer('linked_journal_entry_id').nullable().references('id').inTable('journal_entries').onDelete('SET NULL');
    table.integer('uploaded_by').nullable().references('id').inTable('app_users').onDelete('SET NULL');
    table.timestamp('uploaded_at').defaultTo(knex.fn.now());
  });
};

exports.down = async function(knex) {
  await knex.schema.dropTableIfExists('client_documents');
};
