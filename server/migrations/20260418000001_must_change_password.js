// Copyright 2025-2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Use is limited to qualifying small businesses. See LICENSE for terms.

/**
 * Add a `must_change_password` flag to app_users so the bootstrap admin
 * (and any admin-created account) can be forced to rotate credentials on
 * first login.
 */
exports.up = async function (knex) {
  const hasColumn = await knex.schema.hasColumn('app_users', 'must_change_password');
  if (!hasColumn) {
    await knex.schema.alterTable('app_users', (t) => {
      t.boolean('must_change_password').notNullable().defaultTo(false);
    });
  }
};

exports.down = async function (knex) {
  const hasColumn = await knex.schema.hasColumn('app_users', 'must_change_password');
  if (hasColumn) {
    await knex.schema.alterTable('app_users', (t) => {
      t.dropColumn('must_change_password');
    });
  }
};
