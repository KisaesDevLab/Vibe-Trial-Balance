const path = require('path');

const isProduction = process.env.NODE_ENV === 'production';
const databaseUrl = process.env.DATABASE_URL;

// `DATABASE_URL` is the preferred config (single connection string carrying
// host, port, db, user, password). Discrete `DB_*` vars remain supported for
// one deprecation cycle — log a warning when they're used in production.
if (!databaseUrl && isProduction && !process.env.DB_PASSWORD) {
  throw new Error('DB_PASSWORD environment variable is required in production (or set DATABASE_URL).');
}

if (!databaseUrl && isProduction) {
  console.warn(
    '[knex] DB_HOST/DB_PORT/DB_NAME/DB_USER/DB_PASSWORD are deprecated. Set DATABASE_URL instead.'
  );
}

const connection = databaseUrl ?? {
  host: process.env.DB_HOST || '127.0.0.1',
  port: Number(process.env.DB_PORT) || 5432,
  database: process.env.DB_NAME || 'vibe_tb_db',
  user: process.env.DB_USER || 'vibetb',
  password: process.env.DB_PASSWORD || (isProduction ? '' : 'localdev123'),
};

const migrations = {
  tableName: 'knex_migrations',
  directory: path.resolve(__dirname, 'migrations'),
};

const seeds = {
  directory: path.resolve(__dirname, 'seeds'),
  loadExtensions: ['.js'],
};

module.exports = {
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
