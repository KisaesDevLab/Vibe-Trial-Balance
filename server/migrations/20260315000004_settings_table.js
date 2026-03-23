exports.up = async function (knex) {
  await knex.schema.createTable('settings', (t) => {
    t.string('key', 100).primary();
    t.text('value').nullable();
    t.timestamp('updated_at').defaultTo(knex.fn.now());
  });
};

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('settings');
};
