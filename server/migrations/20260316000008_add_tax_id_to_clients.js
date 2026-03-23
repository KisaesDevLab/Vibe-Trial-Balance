/**
 * Migration: Add tax_id (EIN/SSN) to clients
 */
exports.up = async function (knex) {
  await knex.schema.table('clients', (t) => {
    t.string('tax_id', 20).nullable();
  });
};

exports.down = async function (knex) {
  await knex.schema.table('clients', (t) => {
    t.dropColumn('tax_id');
  });
};
