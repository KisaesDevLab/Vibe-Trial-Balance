// Copyright 2025-2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Use is limited to qualifying small businesses. See LICENSE for terms.

/**
 * Two-factor authentication: authenticator-app TOTP, WebAuthn passkeys, the
 * "remember this browser" tokens, and the server-side WebAuthn challenge store
 * (there is no session, so the challenge between the two halves of a ceremony
 * has to live somewhere).
 *
 * - user_totp.secret_enc is the base32 seed encrypted with lib/encryption.ts.
 *   A seed must be recoverable in plaintext to compute a code, so it cannot be
 *   hashed like a password; AES-GCM under ENCRYPTION_KEY keeps a DB dump or a
 *   .tbak archive from yielding working seeds. Restoring onto a host with a
 *   different ENCRYPTION_KEY makes them undecryptable — reset the user's 2FA.
 * - user_passkeys.public_key is base64url TEXT, not bytea, so routes/backup.ts's
 *   JSON dump round-trips it.
 * - trusted_browsers.token_hash is the SHA-256 of the raw cookie value, the
 *   same posture as password_reset_tokens.
 * - Every FK cascades from app_users: deleting a user drops their factors.
 */
exports.up = async function (knex) {
  if (!(await knex.schema.hasTable('user_totp'))) {
    await knex.schema.createTable('user_totp', (t) => {
      t.integer('user_id').unsigned().primary().references('id').inTable('app_users').onDelete('CASCADE');
      t.text('secret_enc').notNullable();
      t.timestamp('confirmed_at', { useTz: true }).nullable();
      t.bigInteger('last_used_step').nullable();
      t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
      t.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    });
  }

  if (!(await knex.schema.hasTable('user_passkeys'))) {
    await knex.schema.createTable('user_passkeys', (t) => {
      t.increments('id').primary();
      t.integer('user_id').unsigned().notNullable().references('id').inTable('app_users').onDelete('CASCADE');
      t.string('credential_id', 512).notNullable().unique();
      t.text('public_key').notNullable();
      t.bigInteger('counter').notNullable().defaultTo(0);
      t.text('transports').nullable();
      t.string('device_type', 16).nullable();
      t.boolean('backed_up').notNullable().defaultTo(false);
      t.string('name', 100).notNullable();
      t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
      t.timestamp('last_used_at', { useTz: true }).nullable();
      t.index(['user_id'], 'user_passkeys_user_id_idx');
    });
  }

  if (!(await knex.schema.hasTable('trusted_browsers'))) {
    await knex.schema.createTable('trusted_browsers', (t) => {
      t.increments('id').primary();
      t.integer('user_id').unsigned().notNullable().references('id').inTable('app_users').onDelete('CASCADE');
      t.specificType('token_hash', 'char(64)').notNullable().unique();
      t.timestamp('expires_at', { useTz: true }).notNullable();
      t.timestamp('revoked_at', { useTz: true }).nullable();
      t.string('user_agent', 255).nullable();
      t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
      t.timestamp('last_used_at', { useTz: true }).nullable();
      t.index(['user_id', 'revoked_at'], 'trusted_browsers_user_revoked_idx');
    });
  }

  if (!(await knex.schema.hasTable('webauthn_challenges'))) {
    await knex.schema.createTable('webauthn_challenges', (t) => {
      t.string('id', 64).primary();
      t.integer('user_id').unsigned().nullable().references('id').inTable('app_users').onDelete('CASCADE');
      t.string('kind', 16).notNullable();
      t.text('challenge').notNullable();
      t.timestamp('expires_at', { useTz: true }).notNullable();
      t.timestamp('consumed_at', { useTz: true }).nullable();
      t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
      t.index(['expires_at'], 'webauthn_challenges_expires_idx');
    });
  }
};

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('webauthn_challenges');
  await knex.schema.dropTableIfExists('trusted_browsers');
  await knex.schema.dropTableIfExists('user_passkeys');
  await knex.schema.dropTableIfExists('user_totp');
};
