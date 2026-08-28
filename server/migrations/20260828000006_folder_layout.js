/**
 * Folder layout, corrected to the firm's actual filing convention:
 *
 *   Clients/Jack Black LLC/Workpapers & Support/2025/
 *
 * Three changes from the first cut:
 *   - the client folder is the plain client name, with no id suffix;
 *   - the year folder is a bare year, and its format is a setting;
 *   - a newly linked client gets one combined "Workpapers & Support" section.
 *
 * Two new fields support it:
 *
 * clients.client_code — the firm's own identifier for this client, the same
 *   idea as Vibe Time & Billing's `tax_software_id`: the number the tax
 *   software uses, which firms often encode in the folder name ("0042 - Smith,
 *   John"). Optional, and only appears in a folder name if the client-folder
 *   format asks for it.
 *
 * periods.folder_year — an explicit label for the year folder, overriding the
 *   value derived from end_date and the client's year end. Derivation is right
 *   for ordinary periods but cannot know about a short year, a stub period or a
 *   firm's own naming, so the field wins whenever it is set.
 *
 * Existing keys are unaffected: object_key is stored, never re-derived, so only
 * new writes and newly created folders use the new layout.
 */
exports.up = async function (knex) {
  const hasCode = await knex.schema.hasColumn('clients', 'client_code');
  if (!hasCode) {
    await knex.schema.alterTable('clients', (t) => {
      t.string('client_code', 50).nullable();
    });
    await knex.raw(`
      CREATE INDEX IF NOT EXISTS clients_client_code_idx
        ON clients (client_code) WHERE client_code IS NOT NULL
    `);
  }

  const hasFolderYear = await knex.schema.hasColumn('periods', 'folder_year');
  if (!hasFolderYear) {
    await knex.schema.alterTable('periods', (t) => {
      t.string('folder_year', 20).nullable();
    });
  }

  // Re-seed the folder template, but ONLY if it is still the untouched
  // two-row default. A firm that has already edited it has made a deliberate
  // choice, and a migration must not overwrite that.
  if (await knex.schema.hasTable('storage_folder_template')) {
    const rows = await knex('storage_folder_template').select('name').orderBy('sort_order', 'asc');
    const names = rows.map((r) => r.name);
    const untouched = names.length === 2 && names[0] === 'Workpapers' && names[1] === 'Support';
    if (untouched) {
      await knex.transaction(async (trx) => {
        await trx('storage_folder_template').delete();
        await trx('storage_folder_template').insert({
          name: 'Workpapers & Support',
          sort_order: 0,
          is_workpaper_target: true,
          is_default_upload: true,
        });
      });
    }
  }

  // Same restraint for the key prefix: only move it off the old default.
  const prefix = await knex('settings').where({ key: 'storage.prefix' }).first('value');
  if (prefix && prefix.value === 'vibe-tb') {
    await knex('settings').where({ key: 'storage.prefix' }).update({ value: 'Clients', updated_at: knex.fn.now() });
  }
};

exports.down = async function (knex) {
  const hasFolderYear = await knex.schema.hasColumn('periods', 'folder_year');
  if (hasFolderYear) {
    await knex.schema.alterTable('periods', (t) => t.dropColumn('folder_year'));
  }
  await knex.raw('DROP INDEX IF EXISTS clients_client_code_idx');
  const hasCode = await knex.schema.hasColumn('clients', 'client_code');
  if (hasCode) {
    await knex.schema.alterTable('clients', (t) => t.dropColumn('client_code'));
  }
  // The template and prefix are user-editable data; leave them as they are.
};
