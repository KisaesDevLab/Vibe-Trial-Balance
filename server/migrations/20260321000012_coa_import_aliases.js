exports.up = async function(knex) {
  await knex.schema.alterTable('chart_of_accounts', (t) => {
    t.jsonb('import_aliases').notNullable().defaultTo('[]');
  });
};

exports.down = async function(knex) {
  await knex.schema.alterTable('chart_of_accounts', (t) => {
    t.dropColumn('import_aliases');
  });
};
