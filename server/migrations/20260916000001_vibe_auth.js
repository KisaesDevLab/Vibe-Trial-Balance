/**
 * Migration: Vibe Auth (single sign-on) tables.
 *
 * The three package tables (auth_identities, auth_settings, auth_revocations)
 * come verbatim from @kisaesdevlab/vibe-auth's shipped SQL so they stay in step with
 * the package's query-backed stores. auth_sessions_oidc is ours: Trial Balance
 * sessions are stateless JWTs, so the identity behind an SSO login (issuer,
 * subject, IdP session id, ID token for RP-initiated logout) is parked here,
 * keyed by the `sid` claim the SSO JWT carries.
 */
const fs = require('fs');

function packageSql() {
  const file = require.resolve('@kisaesdevlab/vibe-auth/sql/auth_identities.sql');
  return fs.readFileSync(file, 'utf8');
}

exports.up = async function (knex) {
  await knex.raw(packageSql());

  const hasSessions = await knex.schema.hasTable('auth_sessions_oidc');
  if (!hasSessions) {
    await knex.schema.createTable('auth_sessions_oidc', (t) => {
      t.string('sid', 64).primary();
      t.integer('user_id').unsigned().notNullable().references('id').inTable('app_users').onDelete('CASCADE');
      t.text('issuer').notNullable();
      t.text('subject').notNullable();
      t.text('oidc_sid').nullable();
      t.text('id_token').nullable();
      t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
      t.index(['user_id']);
      t.index(['issuer', 'subject']);
      t.index(['oidc_sid']);
    });
  }
};

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('auth_sessions_oidc');
  await knex.schema.dropTableIfExists('auth_revocations');
  await knex.schema.dropTableIfExists('auth_settings');
  await knex.schema.dropTableIfExists('auth_identities');
};
