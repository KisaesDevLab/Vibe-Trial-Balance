// Copyright 2025-2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Use is limited to qualifying small businesses. See LICENSE for terms.

/**
 * User invitations. An invite is the same one-shot, hashed, single-use token
 * as a password reset — the only differences are the email copy and a longer
 * TTL — so it reuses password_reset_tokens with a `purpose` discriminator
 * rather than a parallel table (one consume path, one invalidation rule).
 *
 * app_users gains invited_at / invite_accepted_at so the admin UI can show
 * "Invite pending" and so a resend is distinguishable from a first send.
 */
exports.up = async function (knex) {
  const hasPurpose = await knex.schema.hasColumn('password_reset_tokens', 'purpose');
  if (!hasPurpose) {
    await knex.schema.alterTable('password_reset_tokens', (t) => {
      t.string('purpose', 16).notNullable().defaultTo('reset');
    });
  }

  const hasInvitedAt = await knex.schema.hasColumn('app_users', 'invited_at');
  if (!hasInvitedAt) {
    await knex.schema.alterTable('app_users', (t) => {
      // Last time an invite email was sent (updated on every resend).
      t.timestamp('invited_at', { useTz: true }).nullable();
      // Set when the invited user actually sets their password.
      t.timestamp('invite_accepted_at', { useTz: true }).nullable();
    });
  }
};

exports.down = async function (knex) {
  const hasInvitedAt = await knex.schema.hasColumn('app_users', 'invited_at');
  if (hasInvitedAt) {
    await knex.schema.alterTable('app_users', (t) => {
      t.dropColumn('invite_accepted_at');
      t.dropColumn('invited_at');
    });
  }
  const hasPurpose = await knex.schema.hasColumn('password_reset_tokens', 'purpose');
  if (hasPurpose) {
    await knex.schema.alterTable('password_reset_tokens', (t) => {
      t.dropColumn('purpose');
    });
  }
};
