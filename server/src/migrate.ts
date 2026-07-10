// Copyright 2025-2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Use is limited to qualifying small businesses. See LICENSE for terms.

// Standalone migration runner. Used by the appliance enable-app.sh as a
// one-shot container before starting the API service when MIGRATIONS_AUTO=false.
//
// Usage: node dist/migrate.js
//
// Exits 0 on success (idempotent — no-op when no pending migrations) and 1
// on any failure.

import 'dotenv/config';
import knex, { Knex } from 'knex';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const config = require('../knexfile') as Record<string, Knex.Config>;

const env = process.env.NODE_ENV === 'production' ? 'production' : 'development';
const envConfig = config[env];
if (!envConfig) {
  console.error(`[migrate] No knex config for NODE_ENV="${env}"`);
  process.exit(1);
}

const k = knex(envConfig);
k.migrate.latest()
  .then(([batch, applied]) => {
    const list = applied as string[];
    console.log(`[migrate] batch=${batch} applied=${list.length}${list.length ? ': ' + list.join(', ') : ''}`);
    return k.destroy();
  })
  .then(() => process.exit(0))
  .catch((err: unknown) => {
    console.error('[migrate] failed:', err);
    process.exit(1);
  });
