/**
 * Seed: Default admin user.
 *
 * Password: 'admin' (bcrypt hashed). Change immediately after first login.
 * In production, the setup script should prompt for a real password.
 */

import type { Knex } from 'knex';
import bcrypt from 'bcrypt';

export async function seed(knex: Knex): Promise<void> {
  // Clear existing users (dev only — remove this guard in production seed)
  await knex('app_users').del();

  const passwordHash = await bcrypt.hash('admin', 12);

  await knex('app_users').insert([
    {
      username: 'admin',
      password_hash: passwordHash,
      display_name: 'Administrator',
      role: 'admin',
      is_active: true,
    },
  ]);
}
