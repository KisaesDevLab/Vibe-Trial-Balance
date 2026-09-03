/**
 * `journal_entries.source_tag` — what produced an entry, when it was not typed
 * by hand. Today the only value is `py_tieout`, set by
 * POST /periods/:id/py-comparison/create-aje.
 *
 * A PY true-up is posted in the CURRENT year (it has to be — the prior year is
 * closed), so once created it is indistinguishable from any other AJE. The tag
 * is what lets the PY Tie-Out screen answer the question a preparer actually
 * asks: "if my adjustments were applied to the prior-year numbers, would they
 * tie?" The comparison endpoint sums the tagged entries' lines per account and
 * reports uploaded + true-ups against the rolled prior year.
 *
 * Nullable and free of any default: every entry that already exists, and every
 * hand-keyed entry from here on, simply has no tag.
 */
exports.up = async function (knex) {
  await knex.schema.alterTable('journal_entries', (t) => {
    t.string('source_tag', 20).nullable();
  });
  // The tie-out summary asks for one period's tagged entries on every load.
  await knex.raw(
    'CREATE INDEX IF NOT EXISTS journal_entries_period_source_tag_idx ON journal_entries (period_id, source_tag) WHERE source_tag IS NOT NULL',
  );
};

exports.down = async function (knex) {
  await knex.raw('DROP INDEX IF EXISTS journal_entries_period_source_tag_idx');
  await knex.schema.alterTable('journal_entries', (t) => {
    t.dropColumn('source_tag');
  });
};
