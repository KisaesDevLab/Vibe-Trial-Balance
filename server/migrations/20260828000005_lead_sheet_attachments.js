/**
 * Lead sheet attachments — supporting PDFs, auto-named by ref code (A001,
 * A002, B001).
 *
 * PERIOD-scoped from day one. MyBooks had to retrofit this in a follow-up
 * migration because a file attached while working the 12/31 workpaper was
 * surfacing in a 7/31 interim package.
 *
 * `UNIQUE (period_id, ref_code)` is the source of truth for allocation, not the
 * SELECT that picks the next number — two concurrent uploads race, and the
 * loser retries on the 23505.
 *
 * Deleting an attachment SOFT-deletes this row so its ref code stays reserved
 * forever. A reissued code would collide with one already printed in a binder.
 *
 * The lead_sheet_id FK is added conditionally so this migration is independent
 * of the lead sheet feature's presence; `lead_sheet_code` is what the allocator
 * actually reads.
 */
exports.up = async function (knex) {
  const exists = await knex.schema.hasTable('lead_sheet_attachments');
  if (exists) return;

  await knex.schema.createTable('lead_sheet_attachments', (t) => {
    t.increments('id').primary();
    t.integer('client_id').unsigned().notNullable()
      .references('id').inTable('clients').onDelete('CASCADE');
    t.integer('period_id').unsigned().notNullable()
      .references('id').inTable('periods').onDelete('CASCADE');
    t.integer('lead_sheet_id').unsigned().nullable();
    // Denormalised on purpose: this is the allocator's only real input, and it
    // keeps the ref code stable if the lead sheet is later renamed.
    t.string('lead_sheet_code', 4).notNullable();
    t.integer('account_id').unsigned().nullable()
      .references('id').inTable('chart_of_accounts').onDelete('SET NULL');
    t.string('ref_code', 12).notNullable();
    // SET NULL, not CASCADE, and nullable: removing an attachment must leave a
    // TOMBSTONE behind. The row is what reserves the ref code, so cascading it
    // away would let the next upload reissue a number that may already appear
    // in a printed binder.
    t.integer('document_id').unsigned().nullable()
      .references('id').inTable('client_documents').onDelete('SET NULL');
    t.timestamp('deleted_at', { useTz: true }).nullable();
    t.integer('deleted_by').unsigned().nullable()
      .references('id').inTable('app_users').onDelete('SET NULL');
    // What the user actually uploaded. The stored object is named by ref code.
    t.string('source_file_name', 500).notNullable().defaultTo('');
    // Tickmark stamps, recorded for the audit trail and the viewer overlay.
    // They are burned into the stored PDF, so this cannot drive removal.
    t.jsonb('annotations').notNullable().defaultTo('[]');
    t.integer('created_by').unsigned().nullable()
      .references('id').inTable('app_users').onDelete('SET NULL');
    t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());

    t.unique(['period_id', 'ref_code'], 'lead_sheet_attachments_ref_unique');
    t.index(['period_id', 'lead_sheet_id'], 'lead_sheet_attachments_sheet_idx');
    t.index(['period_id', 'account_id'], 'lead_sheet_attachments_account_idx');
    t.index(['document_id'], 'lead_sheet_attachments_document_idx');
  });

  if (await knex.schema.hasTable('lead_sheets')) {
    await knex.schema.alterTable('lead_sheet_attachments', (t) => {
      t.foreign('lead_sheet_id').references('id').inTable('lead_sheets').onDelete('SET NULL');
    });
  }
};

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('lead_sheet_attachments');
};
