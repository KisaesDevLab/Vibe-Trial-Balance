/**
 * QuickBooks Online connector.
 *
 *  - qbo_connections: one bound QuickBooks company per client. Never holds a
 *    "pending" row; that lives on the OAuth state until the user confirms the
 *    binding, so re-authorising a client that already has a connection never
 *    collides with UNIQUE(client_id).
 *  - qbo_oauth_states: the CSRF nonce for an authorization round trip AND the
 *    post-callback handoff (realm, company name, encrypted tokens) awaiting
 *    the user's Bind / Discard decision.
 *  - chart_of_accounts.qbo_account_id: the durable QBO account <-> COA row link.
 *    The COA row is the account map; it persists across periods like the lead
 *    sheet does.
 */
exports.up = async function (knex) {
  if (!(await knex.schema.hasTable('qbo_connections'))) {
    await knex.schema.createTable('qbo_connections', (t) => {
      t.increments('id').primary();
      t.integer('client_id').unsigned().notNullable().unique()
        .references('id').inTable('clients').onDelete('CASCADE');
      t.string('realm_id', 32).notNullable();
      t.string('company_name', 255).nullable();
      t.string('environment', 12).notNullable();
      t.string('status', 20).notNullable().defaultTo('active');
      t.text('access_token_enc').nullable();
      t.timestamp('access_token_expires_at', { useTz: true }).nullable();
      t.text('refresh_token_enc').notNullable();
      t.timestamp('refresh_token_expires_at', { useTz: true }).notNullable();
      t.timestamp('first_authorized_at', { useTz: true }).notNullable();
      t.timestamp('last_refreshed_at', { useTz: true }).nullable();
      t.text('last_refresh_error').nullable();
      t.timestamp('last_import_at', { useTz: true }).nullable();
      t.integer('connected_by').unsigned().nullable()
        .references('id').inTable('app_users').onDelete('SET NULL');
      t.timestamp('bound_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
      t.timestamps(true, true);
      // One grant per company: two rows for the same realm would race on
      // refresh-token rotation and one of them would always end up dead.
      t.unique(['environment', 'realm_id'], 'qbo_connections_realm_unique');
    });
    await knex.raw(
      "ALTER TABLE qbo_connections ADD CONSTRAINT qbo_connections_environment_chk CHECK (environment IN ('sandbox', 'production'))",
    );
    await knex.raw(
      "ALTER TABLE qbo_connections ADD CONSTRAINT qbo_connections_status_chk CHECK (status IN ('active', 'needs_reauth', 'error'))",
    );
  }

  if (!(await knex.schema.hasTable('qbo_oauth_states'))) {
    await knex.schema.createTable('qbo_oauth_states', (t) => {
      t.increments('id').primary();
      // sha256 of the raw 32-byte nonce; the raw value only ever travels in
      // the authorize URL and back on the callback.
      t.string('state_hash', 64).notNullable().unique();
      t.integer('client_id').unsigned().notNullable()
        .references('id').inTable('clients').onDelete('CASCADE');
      t.integer('user_id').unsigned().notNullable()
        .references('id').inTable('app_users').onDelete('CASCADE');
      t.string('environment', 12).notNullable();
      // Snapshot of the redirect_uri used in the authorize URL: the token
      // exchange must send the identical value even if the setting changed.
      t.string('redirect_uri', 1024).notNullable();
      t.timestamp('expires_at', { useTz: true }).notNullable();
      t.timestamp('consumed_at', { useTz: true }).nullable();
      // Filled by the callback, read by the Bind / Discard step.
      t.string('realm_id', 32).nullable();
      t.string('company_name', 255).nullable();
      t.text('token_payload_enc').nullable();
      t.timestamp('pending_expires_at', { useTz: true }).nullable();
      t.timestamp('bound_at', { useTz: true }).nullable();
      t.timestamp('discarded_at', { useTz: true }).nullable();
      t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    });
    await knex.raw(
      "ALTER TABLE qbo_oauth_states ADD CONSTRAINT qbo_oauth_states_environment_chk CHECK (environment IN ('sandbox', 'production'))",
    );
  }

  if (!(await knex.schema.hasColumn('chart_of_accounts', 'qbo_account_id'))) {
    await knex.schema.alterTable('chart_of_accounts', (t) => {
      t.string('qbo_account_id', 32).nullable();
    });
  }
  await knex.raw(
    'CREATE UNIQUE INDEX IF NOT EXISTS chart_of_accounts_qbo_account_unique ON chart_of_accounts (client_id, qbo_account_id) WHERE qbo_account_id IS NOT NULL',
  );
};

exports.down = async function (knex) {
  await knex.raw('DROP INDEX IF EXISTS chart_of_accounts_qbo_account_unique');
  if (await knex.schema.hasColumn('chart_of_accounts', 'qbo_account_id')) {
    await knex.schema.alterTable('chart_of_accounts', (t) => {
      t.dropColumn('qbo_account_id');
    });
  }
  await knex.schema.dropTableIfExists('qbo_oauth_states');
  await knex.schema.dropTableIfExists('qbo_connections');
};
