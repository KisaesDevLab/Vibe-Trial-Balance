import type { Knex } from 'knex';
import bcrypt from 'bcrypt';

export async function seed(knex: Knex): Promise<void> {
  await knex('app_users').del();
  const hash = await bcrypt.hash('admin', 12);
  await knex('app_users').insert([{ username: 'admin', password_hash: hash, display_name: 'Administrator', role: 'admin', is_active: true }]);
}
