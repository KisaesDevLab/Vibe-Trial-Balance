/**
 * Statement Writer — report-ready financial statements, ported from Vibe
 * MyBooks (its migrations 0189–0191).
 *
 * Three layers:
 *   FIRM library  fs_firm_profile (letterhead, one row), fs_letters,
 *                 fs_style_presets, fs_layout_templates
 *   CLIENT        fs_client_layouts (the outline + style, reused every year),
 *                 fs_cash_flow_overrides, fs_equity_roles
 *   PERIOD        fs_reports (one statement set), fs_report_versions (immutable
 *                 finalized snapshots), fs_report_version_files (the PDF bytes)
 *
 * This app is single-tenant, so MyBooks' firm/tenant owner pair is gone: there
 * is one firm library.
 *
 * FK rules:
 *   - fs_reports.period_id CASCADES. A statement set is period-scoped data,
 *     like a lead sheet sign-off; deleting the period takes it along. (Every
 *     FK into periods must say what happens on delete — see CLAUDE.md.)
 *   - fs_reports.client_layout_id has NO delete action on purpose: a layout
 *     that a statement set still uses must not vanish, but RESTRICT is checked
 *     immediately and would abort the client-delete cascade that removes both
 *     rows in one statement. NO ACTION is checked at the end of the statement.
 *   - every user column is SET NULL: the record outlives the user.
 *
 * The PDF bytes sit in their own table so a backup — which dumps rows as
 * JSON — never carries them. A version whose file row is missing (after a
 * restore) is re-rendered on demand from its frozen JSON.
 */
exports.up = async function (knex) {
  if (await knex.schema.hasTable('fs_reports')) return;

  const user = (t, col) => t.integer(col).unsigned().nullable()
    .references('id').inTable('app_users').onDelete('SET NULL');

  await knex.schema.createTable('fs_firm_profile', (t) => {
    t.increments('id').primary();
    t.string('display_name', 200).nullable();
    t.string('address_line1', 200).nullable();
    t.string('address_line2', 200).nullable();
    t.string('city', 100).nullable();
    t.string('state', 50).nullable();
    t.string('postal_code', 20).nullable();
    t.string('phone', 50).nullable();
    t.string('email', 200).nullable();
    t.string('website', 200).nullable();
    // PNG/JPEG data URI, ≤ ~700 KB (validated at the route).
    t.text('logo_data_uri').nullable();
    t.string('accountant_signature', 300).nullable();
    t.string('letterhead_align', 10).notNullable().defaultTo('left');
    t.string('letterhead_content', 10).notNullable().defaultTo('both');
    t.string('logo_size', 20).notNullable().defaultTo('small');
    user(t, 'updated_by');
    t.timestamps(true, true);
  });
  // One firm, one letterhead.
  await knex.raw('CREATE UNIQUE INDEX fs_firm_profile_singleton ON fs_firm_profile ((true))');

  await knex.schema.createTable('fs_letters', (t) => {
    t.increments('id').primary();
    t.string('name', 200).notNullable();
    t.string('letter_type', 20).notNullable();
    t.string('title', 200).nullable();
    t.text('body_html').notNullable();
    t.boolean('is_active').notNullable().defaultTo(true);
    t.boolean('is_default').notNullable().defaultTo(false);
    // Set on the seeded letters so seeding is idempotent.
    t.string('builtin_key', 40).nullable();
    t.integer('sort_order').notNullable().defaultTo(0);
    user(t, 'created_by');
    t.timestamps(true, true);
  });
  await knex.raw('CREATE UNIQUE INDEX fs_letters_builtin ON fs_letters (builtin_key) WHERE builtin_key IS NOT NULL');
  await knex.raw('CREATE UNIQUE INDEX fs_letters_one_default ON fs_letters ((true)) WHERE is_default');

  await knex.schema.createTable('fs_style_presets', (t) => {
    t.increments('id').primary();
    t.string('name', 200).notNullable();
    t.jsonb('style_json').notNullable();
    t.string('builtin_key', 40).nullable();
    t.boolean('is_default').notNullable().defaultTo(false);
    t.integer('sort_order').notNullable().defaultTo(0);
    user(t, 'created_by');
    t.timestamps(true, true);
  });
  await knex.raw('CREATE UNIQUE INDEX fs_style_presets_builtin ON fs_style_presets (builtin_key) WHERE builtin_key IS NOT NULL');
  await knex.raw('CREATE UNIQUE INDEX fs_style_presets_one_default ON fs_style_presets ((true)) WHERE is_default');

  await knex.schema.createTable('fs_layout_templates', (t) => {
    t.increments('id').primary();
    t.string('name', 200).notNullable();
    t.text('description').nullable();
    t.string('entity_kind', 20).notNullable().defaultTo('any');
    t.jsonb('layout_json').notNullable();
    t.boolean('is_default').notNullable().defaultTo(false);
    t.integer('sort_order').notNullable().defaultTo(0);
    user(t, 'created_by');
    t.timestamps(true, true);
  });
  await knex.raw('CREATE UNIQUE INDEX fs_layout_templates_one_default ON fs_layout_templates ((true)) WHERE is_default');

  await knex.schema.createTable('fs_client_layouts', (t) => {
    t.increments('id').primary();
    t.integer('client_id').unsigned().notNullable()
      .references('id').inTable('clients').onDelete('CASCADE');
    t.string('name', 200).notNullable();
    t.jsonb('layout_json').notNullable();
    t.jsonb('style_json').notNullable();
    t.integer('source_template_id').unsigned().nullable()
      .references('id').inTable('fs_layout_templates').onDelete('SET NULL');
    t.integer('source_style_preset_id').unsigned().nullable()
      .references('id').inTable('fs_style_presets').onDelete('SET NULL');
    user(t, 'created_by');
    user(t, 'updated_by');
    t.timestamps(true, true);
    t.timestamp('archived_at', { useTz: true }).nullable();
    t.index(['client_id'], 'fs_client_layouts_client_idx');
  });

  await knex.schema.createTable('fs_reports', (t) => {
    t.increments('id').primary();
    t.integer('client_id').unsigned().notNullable()
      .references('id').inTable('clients').onDelete('CASCADE');
    t.integer('period_id').unsigned().notNullable()
      .references('id').inTable('periods').onDelete('CASCADE');
    t.integer('client_layout_id').unsigned().notNullable()
      .references('id').inTable('fs_client_layouts');
    t.string('name', 200).notNullable();
    t.string('framework', 10).notNullable().defaultTo('gaap');
    t.jsonb('columns_json').notNullable();
    // NULL = the kind implied by clients.entity_type.
    t.string('entity_kind', 20).nullable();
    t.jsonb('front_matter_json').notNullable();
    t.string('status', 10).notNullable().defaultTo('draft');
    // Plain integer: an FK here and fs_report_versions.report_id would be a cycle.
    t.integer('current_version_id').unsigned().nullable();
    user(t, 'created_by');
    user(t, 'updated_by');
    t.timestamps(true, true);
    t.timestamp('archived_at', { useTz: true }).nullable();
    t.index(['period_id'], 'fs_reports_period_idx');
    t.index(['client_id'], 'fs_reports_client_idx');
  });
  await knex.raw(`ALTER TABLE fs_reports ADD CONSTRAINT fs_reports_framework_chk CHECK (framework IN ('gaap','cash','tax'))`);
  await knex.raw(`ALTER TABLE fs_reports ADD CONSTRAINT fs_reports_status_chk CHECK (status IN ('draft','final'))`);

  await knex.schema.createTable('fs_report_versions', (t) => {
    t.increments('id').primary();
    t.integer('report_id').unsigned().notNullable()
      .references('id').inTable('fs_reports').onDelete('CASCADE');
    t.integer('version_no').notNullable();
    t.string('status', 12).notNullable().defaultTo('final');
    // The frozen snapshot. model_json is what was issued; the rest is what
    // it takes to compute it again (the stale check) or render it again.
    t.jsonb('model_json').notNullable();
    t.jsonb('layout_json').notNullable();
    t.jsonb('style_json').notNullable();
    t.jsonb('settings_json').notNullable();
    t.jsonb('front_matter_json').notNullable();
    t.jsonb('letter_json').nullable();
    t.jsonb('letterhead_json').nullable();
    t.string('source_stamp', 64).notNullable();
    t.string('numbers_hash', 64).notNullable();
    t.string('pdf_sha256', 64).nullable();
    t.integer('pdf_size').nullable();
    t.integer('page_count').nullable();
    t.boolean('validation_override').notNullable().defaultTo(false);
    t.text('override_reason').nullable();
    user(t, 'finalized_by');
    // Snapshot, so a deleted user still reads correctly in the history.
    t.string('finalized_by_name', 255).nullable();
    t.timestamp('finalized_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    t.timestamp('superseded_at', { useTz: true }).nullable();
    user(t, 'reopened_by');
    t.timestamp('reopened_at', { useTz: true }).nullable();
    t.unique(['report_id', 'version_no'], { indexName: 'fs_report_versions_no_uq' });
  });
  await knex.raw(`ALTER TABLE fs_report_versions ADD CONSTRAINT fs_report_versions_status_chk CHECK (status IN ('final','superseded'))`);

  await knex.schema.createTable('fs_report_version_files', (t) => {
    t.integer('version_id').unsigned().primary()
      .references('id').inTable('fs_report_versions').onDelete('CASCADE');
    t.binary('pdf').notNullable();
    // True when these bytes were rendered again after the original was lost
    // (a restored backup): same numbers, but not the file that was issued.
    t.boolean('regenerated').notNullable().defaultTo(false);
    t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
  });

  await knex.schema.createTable('fs_cash_flow_overrides', (t) => {
    t.increments('id').primary();
    t.integer('client_id').unsigned().notNullable()
      .references('id').inTable('clients').onDelete('CASCADE');
    t.integer('account_id').unsigned().nullable()
      .references('id').inTable('chart_of_accounts').onDelete('CASCADE');
    t.integer('lead_sheet_id').unsigned().nullable()
      .references('id').inTable('lead_sheets').onDelete('CASCADE');
    t.string('classification', 20).notNullable();
    t.timestamps(true, true);
  });
  await knex.raw(`ALTER TABLE fs_cash_flow_overrides ADD CONSTRAINT fs_cash_flow_overrides_one_target_chk CHECK (num_nonnulls(account_id, lead_sheet_id) = 1)`);
  await knex.raw(`ALTER TABLE fs_cash_flow_overrides ADD CONSTRAINT fs_cash_flow_overrides_class_chk CHECK (classification IN ('cash','operating','noncash_adjustment','investing','financing','excluded'))`);
  await knex.raw('CREATE UNIQUE INDEX fs_cash_flow_overrides_account_uq ON fs_cash_flow_overrides (account_id) WHERE account_id IS NOT NULL');
  await knex.raw('CREATE UNIQUE INDEX fs_cash_flow_overrides_lead_sheet_uq ON fs_cash_flow_overrides (lead_sheet_id) WHERE lead_sheet_id IS NOT NULL');
  await knex.raw('CREATE INDEX fs_cash_flow_overrides_client_idx ON fs_cash_flow_overrides (client_id)');

  await knex.schema.createTable('fs_equity_roles', (t) => {
    t.increments('id').primary();
    t.integer('client_id').unsigned().notNullable()
      .references('id').inTable('clients').onDelete('CASCADE');
    t.integer('account_id').unsigned().notNullable()
      .references('id').inTable('chart_of_accounts').onDelete('CASCADE');
    t.string('role', 20).notNullable();
    // The account net income is closed into. At most one per client.
    t.boolean('is_fold').notNullable().defaultTo(false);
    t.timestamps(true, true);
    t.unique(['account_id'], { indexName: 'fs_equity_roles_account_uq' });
  });
  await knex.raw(`ALTER TABLE fs_equity_roles ADD CONSTRAINT fs_equity_roles_role_chk CHECK (role IN ('retained','distributions','contributions','other'))`);
  await knex.raw('CREATE UNIQUE INDEX fs_equity_roles_one_fold ON fs_equity_roles (client_id) WHERE is_fold');
};

exports.down = async function (knex) {
  for (const t of [
    'fs_equity_roles', 'fs_cash_flow_overrides', 'fs_report_version_files', 'fs_report_versions',
    'fs_reports', 'fs_client_layouts', 'fs_layout_templates', 'fs_style_presets', 'fs_letters', 'fs_firm_profile',
  ]) {
    await knex.schema.dropTableIfExists(t);
  }
};
