// Copyright 2025-2026 Kisaes LLC
// Licensed under the PolyForm Internal Use License 1.0.0.
// You may not distribute this software. See LICENSE for terms.

// Standalone seed runner. Companion to migrate.ts — used by the appliance
// enable-app.sh on a fresh install when MIGRATIONS_AUTO=false (which causes
// docker-entrypoint.sh to skip both migrations and seeds).
//
// Usage: node dist/seed.js
//
// Idempotent: knex seed files use insert-ignore / on-conflict patterns so
// re-running is safe. Exits 0 on success, 1 on failure.

import 'dotenv/config';
import knex, { Knex } from 'knex';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const config = require('../knexfile') as Record<string, Knex.Config>;

const env = process.env.NODE_ENV === 'production' ? 'production' : 'development';
const envConfig = config[env];
if (!envConfig) {
  console.error(`[seed] No knex config for NODE_ENV="${env}"`);
  process.exit(1);
}

const k = knex(envConfig);
k.seed.run()
  .then(([files]) => {
    const list = files as string[];
    console.log(`[seed] ran ${list.length} seed file(s)${list.length ? ': ' + list.join(', ') : ''}`);
    return k.destroy();
  })
  .then(() => process.exit(0))
  .catch((err: unknown) => {
    console.error('[seed] failed:', err);
    process.exit(1);
  });
