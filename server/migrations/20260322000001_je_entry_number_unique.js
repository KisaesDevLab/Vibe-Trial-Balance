/**
 * Add unique constraint on journal_entries(period_id, entry_type, entry_number)
 * to prevent duplicate entry numbers when two users create JEs concurrently.
 *
 * First deduplicates any existing violations by re-numbering them in order of id.
 */
exports.up = async function(knex) {
  // Deduplicate any existing duplicate (period_id, entry_type, entry_number) rows
  // by re-assigning entry_number in ascending id order within each group
  await knex.raw(`
    WITH ranked AS (
      SELECT
        id,
        period_id,
        entry_type,
        ROW_NUMBER() OVER (PARTITION BY period_id, entry_type ORDER BY id) AS new_number
      FROM journal_entries
    )
    UPDATE journal_entries
    SET entry_number = ranked.new_number
    FROM ranked
    WHERE journal_entries.id = ranked.id
      AND journal_entries.entry_number != ranked.new_number
  `);

  await knex.schema.alterTable('journal_entries', (t) => {
    t.unique(['period_id', 'entry_type', 'entry_number'], { indexName: 'uje_period_type_number' });
  });
};

exports.down = async function(knex) {
  await knex.schema.alterTable('journal_entries', (t) => {
    t.dropUnique(['period_id', 'entry_type', 'entry_number'], 'uje_period_type_number');
  });
};
