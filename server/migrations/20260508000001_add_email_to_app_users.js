// Copyright 2025-2026 Kisaes LLC
// Licensed under the PolyForm Internal Use License 1.0.0.
// You may not distribute this software. See LICENSE for terms.

/**
 * Add nullable email + email_verified_at columns to app_users so users can
 * receive self-service password reset links. Existing users without an email
 * simply can't initiate self-service reset and continue to use the
 * admin-initiated flow.
 */
exports.up = async function (knex) {
  const hasEmail = await knex.schema.hasColumn('app_users', 'email');
  if (!hasEmail) {
    await knex.schema.alterTable('app_users', (t) => {
      t.string('email', 320).nullable();
      t.timestamp('email_verified_at', { useTz: true }).nullable();
    });
    // Case-insensitive uniqueness via a unique index on lower(email). Allows
    // multiple NULLs (Postgres unique indexes treat NULLs as distinct).
    await knex.raw(
      `CREATE UNIQUE INDEX app_users_email_lower_unique ON app_users (LOWER(email)) WHERE email IS NOT NULL`,
    );
  }
};

exports.down = async function (knex) {
  await knex.raw(`DROP INDEX IF EXISTS app_users_email_lower_unique`);
  const hasEmail = await knex.schema.hasColumn('app_users', 'email');
  if (hasEmail) {
    await knex.schema.alterTable('app_users', (t) => {
      t.dropColumn('email_verified_at');
      t.dropColumn('email');
    });
  }
};
