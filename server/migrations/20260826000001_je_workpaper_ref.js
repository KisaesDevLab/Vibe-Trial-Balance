/**
 * Workpaper reference on journal entries.
 *
 * An AJE is supported by a workpaper, and the binder needs the tie between
 * them printed on the AJE listing — the same role workpaper_ref already plays
 * on chart_of_accounts, so it carries the same name and the same 20-char cap.
 * Nullable: an entry without a supporting workpaper is normal.
 */
exports.up = (knex) => knex.schema.alterTable('journal_entries', (t) => {
  t.string('workpaper_ref', 20).nullable();
});

exports.down = (knex) => knex.schema.alterTable('journal_entries', (t) => {
  t.dropColumn('workpaper_ref');
});
