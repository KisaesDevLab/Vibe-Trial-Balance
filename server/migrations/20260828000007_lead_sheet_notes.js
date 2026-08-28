/**
 * Lead sheet notes — the review conversation that hangs off a lead sheet.
 *
 * Ported from MyBooks' `tb_notes`, which this port had omitted. Notes are
 * PER PERIOD, unlike lead sheet membership: a query about the 2024 cash
 * reconciliation has nothing to say about 2025.
 *
 * A note can hang off the lead sheet as a whole (account_id NULL) or off one
 * account on it, so "why is this account here?" and "the whole schedule needs
 * re-footing" are both expressible.
 *
 * Resolvable rather than deletable: a resolved query is evidence of review
 * having happened, which is exactly what a workpaper is for.
 */
exports.up = async function (knex) {
  const exists = await knex.schema.hasTable('lead_sheet_notes');
  if (exists) return;

  await knex.schema.createTable('lead_sheet_notes', (t) => {
    t.increments('id').primary();
    t.integer('client_id').unsigned().notNullable()
      .references('id').inTable('clients').onDelete('CASCADE');
    t.integer('period_id').unsigned().notNullable()
      .references('id').inTable('periods').onDelete('CASCADE');
    t.integer('lead_sheet_id').unsigned().nullable()
      .references('id').inTable('lead_sheets').onDelete('CASCADE');
    // NULL = the note is about the lead sheet as a whole.
    t.integer('account_id').unsigned().nullable()
      .references('id').inTable('chart_of_accounts').onDelete('SET NULL');
    t.text('body').notNullable();
    t.integer('author_id').unsigned().nullable()
      .references('id').inTable('app_users').onDelete('SET NULL');
    // Snapshot, so a deleted user still reads correctly on an archived PDF.
    t.string('author_name', 255).nullable();
    t.timestamp('resolved_at', { useTz: true }).nullable();
    t.integer('resolved_by').unsigned().nullable()
      .references('id').inTable('app_users').onDelete('SET NULL');
    t.string('resolved_by_name', 255).nullable();
    t.timestamps(true, true);

    t.index(['period_id', 'lead_sheet_id'], 'lead_sheet_notes_sheet_idx');
    t.index(['period_id', 'account_id'], 'lead_sheet_notes_account_idx');
  });

  // Open notes are what the page and the PDF lead with.
  await knex.raw(`
    CREATE INDEX IF NOT EXISTS lead_sheet_notes_open_idx
      ON lead_sheet_notes (period_id) WHERE resolved_at IS NULL
  `);
};

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('lead_sheet_notes');
};
