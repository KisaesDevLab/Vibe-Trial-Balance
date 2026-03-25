exports.up = async function(knex) {
  await knex.schema.alterTable('coa_template_accounts', function(table) {
    table.string('tax_line', 50).nullable();
    table.string('unit', 100).nullable();
  });
};

exports.down = async function(knex) {
  await knex.schema.alterTable('coa_template_accounts', function(table) {
    table.dropColumn('tax_line');
    table.dropColumn('unit');
  });
};
