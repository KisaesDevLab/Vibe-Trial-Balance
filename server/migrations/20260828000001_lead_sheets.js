/**
 * Lead sheets — the letter-coded groupings (A = Cash, B = Receivables, …) a
 * preparer works a file by.
 *
 * Membership is a plain FK column on chart_of_accounts rather than a join
 * table: the chart is already strictly per-client, so the column gives the
 * one-lead-sheet-per-account invariant for free, keeps the TB view to a single
 * extra LEFT JOIN, and makes roll-forward carry membership with no code (COA
 * rows are period-independent).
 *
 * Sign-offs are per period and append-only. Unsigning is soft (invalidated_at)
 * so the history survives; a partial unique index keeps exactly one live
 * signature per (lead sheet, period, role).
 */
exports.up = async function (knex) {
  const hasLeadSheets = await knex.schema.hasTable('lead_sheets');
  if (!hasLeadSheets) {
    await knex.schema.createTable('lead_sheets', (t) => {
      t.increments('id').primary();
      t.integer('client_id').unsigned().notNullable()
        .references('id').inTable('clients').onDelete('CASCADE');
      // Nullable so a user can keep an uncoded grouping. Postgres treats NULLs
      // as distinct in a unique index, so many uncoded sheets are allowed.
      t.string('code', 10).nullable();
      t.string('name', 120).notNullable();
      t.integer('sort_order').notNullable().defaultTo(0);
      t.integer('created_by').unsigned().nullable()
        .references('id').inTable('app_users').onDelete('SET NULL');
      t.timestamps(true, true);

      t.unique(['client_id', 'code'], 'lead_sheets_client_code_unique');
      t.index(['client_id', 'sort_order'], 'lead_sheets_client_sort_idx');
    });
  }

  const hasLeadSheetId = await knex.schema.hasColumn('chart_of_accounts', 'lead_sheet_id');
  if (!hasLeadSheetId) {
    await knex.schema.alterTable('chart_of_accounts', (t) => {
      // SET NULL, not CASCADE: deleting a lead sheet must return its accounts
      // to "ungrouped", never delete them.
      t.integer('lead_sheet_id').unsigned().nullable()
        .references('id').inTable('lead_sheets').onDelete('SET NULL');
      // 'manual' | 'auto' — records whether the rule engine chose this.
      t.string('lead_sheet_source', 20).nullable();
      t.index(['lead_sheet_id'], 'coa_lead_sheet_idx');
    });
  }

  const hasSignoffs = await knex.schema.hasTable('lead_sheet_signoffs');
  if (!hasSignoffs) {
    await knex.schema.createTable('lead_sheet_signoffs', (t) => {
      t.increments('id').primary();
      t.integer('period_id').unsigned().notNullable()
        .references('id').inTable('periods').onDelete('CASCADE');
      t.integer('lead_sheet_id').unsigned().notNullable()
        .references('id').inTable('lead_sheets').onDelete('CASCADE');
      t.string('role', 10).notNullable(); // 'preparer' | 'reviewer'
      t.integer('user_id').unsigned().nullable()
        .references('id').inTable('app_users').onDelete('SET NULL');
      // Snapshot of the signer's name: a deleted user must still print on an
      // archived workpaper PDF, which a SET NULL FK alone would blank.
      t.string('user_name', 255).nullable();
      t.timestamp('signed_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
      // SHA-256 over the member accounts' raw TB amounts at signing time.
      // A timestamp can't work here: deleting a JE lowers max(updated_at), so
      // a "stored < current" test would never fire, and roll-forward/restore
      // rewrite timestamps wholesale, producing false staleness.
      t.string('balance_stamp', 64).notNullable();
      t.timestamp('invalidated_at', { useTz: true }).nullable();
      t.integer('invalidated_by').unsigned().nullable()
        .references('id').inTable('app_users').onDelete('SET NULL');

      t.index(['period_id'], 'lead_sheet_signoffs_period_idx');
      t.index(['lead_sheet_id'], 'lead_sheet_signoffs_sheet_idx');
    });

    // One live signature per slot. Knex has no fluent partial unique index.
    await knex.raw(`
      CREATE UNIQUE INDEX lead_sheet_signoffs_active_unique
        ON lead_sheet_signoffs (lead_sheet_id, period_id, role)
        WHERE invalidated_at IS NULL
    `);
  }
};

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('lead_sheet_signoffs');

  const hasLeadSheetId = await knex.schema.hasColumn('chart_of_accounts', 'lead_sheet_id');
  if (hasLeadSheetId) {
    // The COA column must go before the table it references.
    await knex.schema.alterTable('chart_of_accounts', (t) => {
      t.dropColumn('lead_sheet_source');
      t.dropColumn('lead_sheet_id');
    });
  }

  await knex.schema.dropTableIfExists('lead_sheets');
};
