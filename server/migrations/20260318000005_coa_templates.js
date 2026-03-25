exports.up = async function(knex) {
  await knex.schema.createTable('coa_templates', function(table) {
    table.increments('id').primary();
    table.string('name', 255).notNullable();
    table.text('description');
    // business_type: general/retail/restaurant/professional/real_estate/construction/farm/custom
    table.string('business_type', 50).notNullable().defaultTo('custom');
    table.boolean('is_system').defaultTo(false);   // system templates can't be deleted
    table.boolean('is_active').defaultTo(true);
    table.integer('account_count').defaultTo(0);
    table.integer('created_by').references('id').inTable('app_users');
    table.integer('created_from_client_id').references('id').inTable('clients');
    table.timestamps(true, true);
  });

  await knex.schema.createTable('coa_template_accounts', function(table) {
    table.increments('id').primary();
    table.integer('template_id').notNullable().references('id').inTable('coa_templates').onDelete('CASCADE');
    table.string('account_number', 20).notNullable();
    table.string('account_name', 255).notNullable();
    table.string('category', 20).notNullable(); // assets/liabilities/equity/revenue/expenses
    table.string('subcategory', 50);
    table.string('normal_balance', 10).notNullable(); // debit/credit
    table.string('workpaper_ref', 50);
    table.integer('sort_order').defaultTo(0);
    table.boolean('is_active').defaultTo(true);
    table.unique(['template_id', 'account_number']);
  });

  await knex.schema.createTable('coa_template_tax_codes', function(table) {
    table.increments('id').primary();
    table.integer('template_account_id').notNullable().references('id').inTable('coa_template_accounts').onDelete('CASCADE');
    table.string('return_form', 20).notNullable();
    table.string('activity_type', 30).notNullable();
    table.integer('tax_code_id').references('id').inTable('tax_codes');
    table.unique(['template_account_id', 'return_form', 'activity_type']);
  });
};

exports.down = async function(knex) {
  await knex.schema.dropTableIfExists('coa_template_tax_codes');
  await knex.schema.dropTableIfExists('coa_template_accounts');
  await knex.schema.dropTableIfExists('coa_templates');
};
