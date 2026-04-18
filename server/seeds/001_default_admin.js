const bcrypt = require('bcrypt');
const crypto = require('crypto');

/**
 * Bootstrap the `admin` user if (and only if) no admin already exists.
 *
 * Password source, in priority order:
 *   1. INITIAL_ADMIN_PASSWORD environment variable (recommended for prod).
 *   2. A securely generated random password printed to stdout ONCE. The operator
 *      must copy it from the boot log and will be forced to rotate it on first login.
 *
 * The seed never deletes existing users — running it on a populated database is a no-op.
 * The `must_change_password` flag is set so that the first login forces rotation.
 */
exports.seed = async function (knex) {
  const existing = await knex('app_users').where({ username: 'admin' }).first('id');
  if (existing) {
    // Do not touch existing admin. Do not wipe the table.
    return;
  }

  const envPassword = process.env.INITIAL_ADMIN_PASSWORD;
  let password;
  let origin;
  if (envPassword && envPassword.length >= 8) {
    password = envPassword;
    origin = 'environment variable INITIAL_ADMIN_PASSWORD';
  } else {
    password = crypto.randomBytes(18).toString('base64url');
    origin = 'randomly generated';
  }

  const hash = await bcrypt.hash(password, 12);
  await knex('app_users').insert([{
    username: 'admin',
    password_hash: hash,
    display_name: 'Administrator',
    role: 'admin',
    is_active: true,
    must_change_password: true,
  }]);

  if (origin !== 'environment variable INITIAL_ADMIN_PASSWORD') {
    // Print the password to stdout (captured by Docker / PM2 logs) so the operator
    // can read it exactly once. The user MUST change it on first login.
    // Using console.log here intentionally — this is a boot-time log event.
    // eslint-disable-next-line no-console
    console.log('\n────────────────────────────────────────────────────────────────────');
    // eslint-disable-next-line no-console
    console.log('  FIRST-BOOT ADMIN PASSWORD  (change on first login, stored nowhere)');
    // eslint-disable-next-line no-console
    console.log(`    username: admin`);
    // eslint-disable-next-line no-console
    console.log(`    password: ${password}`);
    // eslint-disable-next-line no-console
    console.log('────────────────────────────────────────────────────────────────────\n');
  }
};
