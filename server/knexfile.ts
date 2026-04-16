import type { Knex } from 'knex';
import path from 'path';

const isProduction = process.env.NODE_ENV === 'production';

// In production, DB_PASSWORD MUST come from env — no dev fallback.
if (isProduction && !process.env.DB_PASSWORD) {
  throw new Error('DB_PASSWORD environment variable is required in production.');
}

const connection = {
  host: process.env.DB_HOST || '127.0.0.1',
  port: Number(process.env.DB_PORT) || 5432,
  database: process.env.DB_NAME || 'vibe_tb_db',
  user: process.env.DB_USER || 'vibetb',
  password: process.env.DB_PASSWORD || (isProduction ? '' : 'localdev123'),
};

const migrations = {
  tableName: 'knex_migrations',
  directory: path.resolve(__dirname, 'migrations'),
  extension: 'ts',
};

const seeds = {
  directory: path.resolve(__dirname, 'seeds'),
  extension: 'ts',
};

const config: { [key: string]: Knex.Config } = {
  development: {
    client: 'pg',
    connection,
    pool: { min: 2, max: 10 },
    migrations,
    seeds,
  },
  production: {
    client: 'pg',
    connection,
    pool: { min: 2, max: 20 },
    migrations,
    seeds,
  },
};

export default config;
