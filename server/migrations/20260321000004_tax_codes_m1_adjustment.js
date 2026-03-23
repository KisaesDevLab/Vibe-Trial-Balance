exports.up = async function(knex) {
  await knex.schema.alterTable('tax_codes', function(table) {
    table.boolean('is_m1_adjustment').notNullable().defaultTo(false);
  });
};

exports.down = async function(knex) {
  await knex.schema.alterTable('tax_codes', function(table) {
    table.dropColumn('is_m1_adjustment');
  });
};
