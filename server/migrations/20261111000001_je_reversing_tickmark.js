/**
 * Two per-entry annotations on adjusting journal entries:
 *
 * - `is_reversing`: the entry reverses at the start of the next year. Roll
 *   forward posts the reversal (lines swapped, dated the new period's start,
 *   `source_tag = 'reversal'`) in the new period. Typical use: a year-end
 *   accrual the client will record when paid.
 * - `tickmark_id`: one mark from the client's tickmark library, shown beside
 *   the entry on screen and on the AJE listing. ON DELETE SET NULL: removing a
 *   mark from the library leaves the entry in place with no mark (unlike
 *   `tb_tickmarks`, whose rows are only the assignment and cascade).
 *
 * Every existing entry is not reversing and has no mark.
 */
exports.up = async function (knex) {
  await knex.schema.alterTable('journal_entries', (t) => {
    t.boolean('is_reversing').notNullable().defaultTo(false);
    t.integer('tickmark_id').nullable().references('id').inTable('tickmark_library').onDelete('SET NULL');
  });
};

exports.down = async function (knex) {
  await knex.schema.alterTable('journal_entries', (t) => {
    t.dropForeign(['tickmark_id']);
    t.dropColumn('tickmark_id');
    t.dropColumn('is_reversing');
  });
};
