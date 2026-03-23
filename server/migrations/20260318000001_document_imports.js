exports.up = async function(knex) {
  await knex.schema.createTable('document_imports', function(table) {
    table.increments('id').primary();
    table.integer('client_id').notNullable().references('id').inTable('clients').onDelete('CASCADE');
    table.integer('period_id').notNullable().references('id').inTable('periods');
    table.string('import_type', 10).notNullable(); // 'csv' or 'pdf'
    table.string('document_type', 50); // 'trial_balance', 'pl', 'balance_sheet'
    table.string('status', 20).defaultTo('pending'); // pending/confirmed/verified/discrepancies
    table.jsonb('ai_extraction'); // full AI response stored for audit
    table.jsonb('verification_result');
    table.integer('imported_by').references('id').inTable('app_users');
    table.integer('verified_by').references('id').inTable('app_users');
    table.timestamp('imported_at').defaultTo(knex.fn.now());
    table.timestamp('verified_at');
  });
};

exports.down = async function(knex) {
  await knex.schema.dropTableIfExists('document_imports');
};
