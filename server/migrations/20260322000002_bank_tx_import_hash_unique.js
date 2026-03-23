/**
 * Add unique constraint on (client_id, import_hash) for bank_transactions
 * so concurrent imports can't insert duplicate rows; allows ON CONFLICT DO NOTHING.
 */
exports.up = async function(knex) {
  // Remove duplicate (client_id, import_hash) rows, keeping the smallest id
  await knex.raw(`
    DELETE FROM bank_transactions
    WHERE id NOT IN (
      SELECT MIN(id)
      FROM bank_transactions
      WHERE import_hash IS NOT NULL
      GROUP BY client_id, import_hash
    )
    AND import_hash IS NOT NULL
  `);

  await knex.schema.alterTable('bank_transactions', (t) => {
    t.unique(['client_id', 'import_hash'], { indexName: 'ubt_client_import_hash' });
  });
};

exports.down = async function(knex) {
  await knex.schema.alterTable('bank_transactions', (t) => {
    t.dropUnique(['client_id', 'import_hash'], 'ubt_client_import_hash');
  });
};
