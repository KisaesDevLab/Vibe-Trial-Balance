/**
 * Add import_hash to bank_transactions for duplicate detection
 */
exports.up = async function (knex) {
  await knex.schema.table('bank_transactions', (t) => {
    t.string('import_hash', 64).nullable().index();
  });
};

exports.down = async function (knex) {
  await knex.schema.table('bank_transactions', (t) => {
    t.dropIndex('import_hash');
    t.dropColumn('import_hash');
  });
};
