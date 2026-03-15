const bcrypt = require('bcrypt');

exports.seed = async function(knex) {
  await knex('app_users').del();
  const hash = await bcrypt.hash('admin', 12);
  await knex('app_users').insert([{ username: 'admin', password_hash: hash, display_name: 'Administrator', role: 'admin', is_active: true }]);
};
