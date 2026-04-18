const bcrypt = require('bcrypt');

/**
 * Bootstrap the `admin` user if (and only if) no admin already exists.
 *
 * The default bootstrap password is a fixed, publicly-known string: `admin1234`.
 * The `must_change_password` flag is set so that the first login forces rotation
 * before the user is allowed anywhere else in the app — that rotation is what
 * actually protects the instance, not the bootstrap password.
 *
 * The seed never deletes existing users — running it on a populated database is a no-op.
 */
exports.seed = async function (knex) {
  const existing = await knex('app_users').where({ username: 'admin' }).first('id');
  if (existing) {
    return;
  }

  const hash = await bcrypt.hash('admin1234', 12);
  await knex('app_users').insert([{
    username: 'admin',
    password_hash: hash,
    display_name: 'Administrator',
    role: 'admin',
    is_active: true,
    must_change_password: true,
  }]);
};
