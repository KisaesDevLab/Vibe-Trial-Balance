/**
 * Add UNIQUE(client_id, symbol) to tickmark_library.
 *
 * Removes any duplicate (client_id, symbol) rows first (keeping the lowest id)
 * so the constraint creation is safe on existing data.
 */
exports.up = async (knex) => {
  // Remove duplicates — keep the row with the smallest id for each (client_id, symbol) pair
  await knex.raw(`
    DELETE FROM tickmark_library
    WHERE id NOT IN (
      SELECT MIN(id)
      FROM tickmark_library
      GROUP BY client_id, symbol
    )
  `);

  await knex.schema.table('tickmark_library', (t) => {
    t.unique(['client_id', 'symbol']);
  });
};

exports.down = async (knex) => {
  await knex.schema.table('tickmark_library', (t) => {
    t.dropUnique(['client_id', 'symbol']);
  });
};
