/**
 * Client ↔ storage-folder binding, plus the configurable folder template.
 *
 * Linking is EXPLICIT: a client has no folder until someone links or creates
 * one, and an upload for an unlinked client is refused. A binding is what every
 * later object key depends on, so it gets reviewed once by a human rather than
 * appearing as a side effect.
 *
 * Identity lives in a sentinel file inside the folder, not in the path — that
 * is what lets a folder be renamed in the B2 console or a mounted drive without
 * orphaning every stored key. `clients.name` also has no unique index, so two
 * clients can share a name and the sentinel is what tells them apart.
 *
 * Existing installs are backfilled below so nobody loses the ability to upload
 * the moment this ships.
 */
exports.up = async function (knex) {
  const hasTemplate = await knex.schema.hasTable('storage_folder_template');
  if (!hasTemplate) {
    await knex.schema.createTable('storage_folder_template', (t) => {
      t.increments('id').primary();
      t.string('name', 100).notNullable();
      t.integer('sort_order').notNullable().defaultTo(0);
      // Exactly one row each — enforced by the partial unique indexes below.
      t.boolean('is_workpaper_target').notNullable().defaultTo(false);
      t.boolean('is_default_upload').notNullable().defaultTo(false);
      t.timestamps(true, true);
      t.unique(['name'], 'storage_folder_template_name_unique');
    });

    await knex.raw(`
      CREATE UNIQUE INDEX storage_folder_template_one_workpaper
        ON storage_folder_template ((is_workpaper_target)) WHERE is_workpaper_target
    `);
    await knex.raw(`
      CREATE UNIQUE INDEX storage_folder_template_one_default
        ON storage_folder_template ((is_default_upload)) WHERE is_default_upload
    `);

    await knex('storage_folder_template').insert([
      { name: 'Workpapers', sort_order: 0, is_workpaper_target: true, is_default_upload: false },
      { name: 'Support', sort_order: 10, is_workpaper_target: false, is_default_upload: true },
    ]);
  }

  const hasLinks = await knex.schema.hasTable('client_folder_links');
  if (!hasLinks) {
    await knex.schema.createTable('client_folder_links', (t) => {
      t.increments('id').primary();
      t.integer('client_id').unsigned().notNullable().unique()
        .references('id').inTable('clients').onDelete('CASCADE');
      t.string('storage_backend', 20).notNullable().defaultTo('local');
      // Always carries a trailing slash.
      t.string('storage_path', 1024).notNullable();
      // The stable identifier written into the folder's sentinel file.
      t.string('sentinel_id', 64).nullable();
      // Rows created by the backfill point at the pre-existing
      // uploads/{clientId}/ layout and have no sentinel.
      t.boolean('is_legacy_layout').notNullable().defaultTo(false);
      // active | missing | conflict. Three, not the reference's five: `renaming`
      // is a mutex for a background job we don't run, and `orphan` collapses
      // into the wrong_install read result.
      t.string('status', 20).notNullable().defaultTo('active');
      t.timestamp('last_verified_at', { useTz: true }).nullable();
      t.integer('created_by').unsigned().nullable()
        .references('id').inTable('app_users').onDelete('SET NULL');
      t.timestamps(true, true);

      t.unique(['storage_backend', 'storage_path'], 'client_folder_links_path_unique');
    });

    await knex.raw(`
      ALTER TABLE client_folder_links
        ADD CONSTRAINT client_folder_links_status_chk
        CHECK (status IN ('active', 'missing', 'conflict'))
    `);
  }

  // Backfill: without this, requiring a link would make every existing client
  // un-uploadable the moment this migration runs. Their documents already live
  // under uploads/{clientId}/, so point the link there and flag it legacy; the
  // admin Storage page offers a migrate action per client.
  const backfilled = await knex('client_folder_links').first('id');
  if (!backfilled) {
    const clients = await knex('clients').select('id');
    if (clients.length > 0) {
      await knex('client_folder_links').insert(clients.map((c) => ({
        client_id: c.id,
        storage_backend: 'local',
        storage_path: `${c.id}/`,
        is_legacy_layout: true,
        status: 'active',
      })));
    }
  }
};

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('client_folder_links');
  await knex.raw('DROP INDEX IF EXISTS storage_folder_template_one_default');
  await knex.raw('DROP INDEX IF EXISTS storage_folder_template_one_workpaper');
  await knex.schema.dropTableIfExists('storage_folder_template');
};
