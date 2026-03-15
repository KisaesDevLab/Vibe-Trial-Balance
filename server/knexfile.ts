import type { Knex } from 'knex';
import path from 'path';

const config: { [key: string]: Knex.Config } = {
  development: {
    client: 'pg',
    connection: {
      host: process.env.DB_HOST || '127.0.0.1',
      port: Number(process.env.DB_PORT) || 5432,
      database: process.env.DB_NAME || 'trialbalance_db',
      user: process.env.DB_USER || 'trialbalance',
      password: process.env.DB_PASSWORD || 'localdev123',
    },
    pool: { min: 2, max: 10 },
    migrations: {
      tableName: 'knex_migrations',
      directory: path.resolve(__dirname, 'migrations'),
      extension: 'ts',
    },
    seeds: {
      directory: path.resolve(__dirname, 'seeds'),
      extension: 'ts',
    },
  },
};

export default config;
