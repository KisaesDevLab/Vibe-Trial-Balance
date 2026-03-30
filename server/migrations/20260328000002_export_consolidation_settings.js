/**
 * Stores per-client tax export consolidation settings.
 * Each row defines a tax code that should be consolidated when exporting
 * for a specific client + software, with optional account number/name overrides.
 */
exports.up = async function (knex) {
  await knex.schema.createTable('export_consolidation_settings', (t) => {
    t.increments('id').primary();
    t.integer('client_id').unsigned().notNullable()
      .references('id').inTable('clients').onDelete('CASCADE');
    t.integer('tax_code_id').unsigned().notNullable()
      .references('id').inTable('tax_codes');
    t.string('tax_software', 20).notNullable();
    t.string('override_account_number', 100);
    t.string('override_description', 255);
    t.timestamp('updated_at').defaultTo(knex.fn.now());
    t.unique(['client_id', 'tax_code_id', 'tax_software']);
  });

  await knex.schema.raw('CREATE INDEX idx_ecs_client_sw ON export_consolidation_settings(client_id, tax_software)');
};

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('export_consolidation_settings');
};
