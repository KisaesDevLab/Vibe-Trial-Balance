// Copyright 2025-2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Use is limited to qualifying small businesses. See LICENSE for terms.

import knex, { Knex } from 'knex';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const config = require('../knexfile') as Record<string, Knex.Config>;

const env = process.env.NODE_ENV === 'production' ? 'production' : 'development';
const envConfig = config[env];
if (!envConfig) {
  throw new Error(`No knex config for NODE_ENV="${env}"`);
}

export const db = knex(envConfig);
