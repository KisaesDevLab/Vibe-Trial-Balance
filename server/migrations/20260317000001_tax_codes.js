/**
 * Phase 4: Tax Code Management System
 * Creates tax_codes and tax_code_software_maps tables
 */
exports.up = async (knex) => {
  await knex.schema.createTable('tax_codes', (t) => {
    t.increments('id').primary();
    t.string('return_form', 10).notNullable(); // 1040, 1065, 1120, 1120S, common
    t.string('activity_type', 20).notNullable(); // business, rental, farm, farm_rental, common
    t.string('tax_code', 50).notNullable(); // canonical ID e.g. GROSS_RECEIPTS
    t.text('description').notNullable();
    t.integer('sort_order').defaultTo(0);
    t.boolean('is_system').defaultTo(true);
    t.boolean('is_active').defaultTo(true);
    t.text('notes');
    t.timestamps(true, true);
    t.unique(['return_form', 'activity_type', 'tax_code']);
  });

  await knex.schema.createTable('tax_code_software_maps', (t) => {
    t.increments('id').primary();
    t.integer('tax_code_id').notNullable().references('id').inTable('tax_codes').onDelete('CASCADE');
    t.string('tax_software', 20).notNullable(); // ultratax, cch, lacerte, gosystem, generic
    t.string('software_code', 100);
    t.string('software_description', 255);
    t.text('notes');
    t.boolean('is_active').defaultTo(true);
    t.timestamp('created_at').defaultTo(knex.fn.now());
    t.unique(['tax_code_id', 'tax_software']);
  });

  await knex.schema.table('tax_code_software_maps', (t) => {
    t.index(['tax_code_id']);
    t.index(['tax_software']);
  });
};

exports.down = async (knex) => {
  await knex.schema.dropTableIfExists('tax_code_software_maps');
  await knex.schema.dropTableIfExists('tax_codes');
};
