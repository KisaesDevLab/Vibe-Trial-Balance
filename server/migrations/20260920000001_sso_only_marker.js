/**
 * Migration: app_users.sso_only_since.
 *
 * Nothing in the schema could tell "this account has only ever signed in
 * through the identity provider" from "this account has a password": a
 * just-in-time provisioned user carries a bcrypt hash of random bytes
 * (password_hash is NOT NULL) that looks like any other hash, and a plain
 * password sign-in leaves no trace. Self-service password reset needs that
 * distinction (routes/passwordReset.ts), so:
 *
 *   sso_only_since  NULL      = has, or may have, a usable local password
 *                   timestamp = provisioned by single sign-on and never given one
 *
 * Set by the Vibe Auth user adapter's create(); cleared wherever a real
 * password is written (admin set, invite/reset confirm, break-glass rotate).
 * A forgotten clear fails closed: self-service reset refused, an admin can
 * still set a password.
 *
 * Backfill: accounts already provisioned by SSO are recognised by an identity
 * linked within a minute of the user row's creation (create + link are one
 * sign-in), no forced rotation pending, never invited, and no audit trail of a
 * password ever being set. Admin-created accounts start with
 * must_change_password = true and clearing it always leaves one of those audit
 * rows, so they are never caught.
 */
exports.up = async function (knex) {
  const hasColumn = await knex.schema.hasColumn('app_users', 'sso_only_since');
  if (!hasColumn) {
    await knex.schema.alterTable('app_users', (t) => {
      t.timestamp('sso_only_since', { useTz: true }).nullable();
    });
  }

  const hasIdentities = await knex.schema.hasTable('auth_identities');
  if (!hasIdentities) return;
  await knex.raw(`
    UPDATE app_users u
       SET sso_only_since = u.created_at
     WHERE u.sso_only_since IS NULL
       AND u.must_change_password = false
       AND u.invited_at IS NULL
       AND EXISTS (
             SELECT 1 FROM auth_identities i
              WHERE i.user_id = u.id::text
                AND i.created_at >= u.created_at
                AND i.created_at <  u.created_at + interval '1 minute')
       AND NOT EXISTS (
             SELECT 1 FROM audit_log a
              WHERE a.entity_type = 'user'
                AND a.entity_id = u.id
                AND (a.action IN ('password_reset_completed', 'invite_accepted')
                     OR (a.action = 'update' AND (a.description LIKE '%password changed%'
                                               OR a.description LIKE '%changed their own password%'))))
  `);
};

exports.down = async function (knex) {
  const hasColumn = await knex.schema.hasColumn('app_users', 'sso_only_since');
  if (hasColumn) {
    await knex.schema.alterTable('app_users', (t) => {
      t.dropColumn('sso_only_since');
    });
  }
};
