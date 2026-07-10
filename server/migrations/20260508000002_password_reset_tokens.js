// Copyright 2025-2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Use is limited to qualifying small businesses. See LICENSE for terms.

/**
 * Self-service password reset tokens. The raw token only ever lives in the
 * email link; we persist the SHA-256 hash so a DB read alone doesn't yield a
 * usable token. Tokens are single-use (consumed_at) and short-lived
 * (expires_at). All prior unconsumed tokens for a user are invalidated when
 * a new one is issued or one is consumed.
 */
exports.up = async function (knex) {
  const exists = await knex.schema.hasTable('password_reset_tokens');
  if (exists) return;

  await knex.schema.createTable('password_reset_tokens', (t) => {
    t.bigIncrements('id').primary();
    t.bigInteger('user_id')
      .notNullable()
      .references('id')
      .inTable('app_users')
      .onDelete('CASCADE');
    t.string('token_hash', 64).notNullable(); // sha256 hex
    t.timestamp('expires_at', { useTz: true }).notNullable();
    t.timestamp('consumed_at', { useTz: true }).nullable();
    t.string('requester_ip', 64).nullable();
    t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());

    t.index(['token_hash'], 'password_reset_tokens_token_hash_idx');
    t.index(['user_id', 'consumed_at'], 'password_reset_tokens_user_consumed_idx');
  });
};

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('password_reset_tokens');
};
