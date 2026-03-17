exports.up = async function (knex) {
  await knex.schema.table('classification_rules', (t) => {
    t.integer('sort_order').notNullable().defaultTo(0);
  });
};
exports.down = async function (knex) {
  await knex.schema.table('classification_rules', (t) => {
    t.dropColumn('sort_order');
  });
};
