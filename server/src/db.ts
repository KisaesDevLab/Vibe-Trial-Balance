// Copyright 2025-2026 Kisaes LLC
// Licensed under the PolyForm Internal Use License 1.0.0.
// You may not distribute this software. See LICENSE for terms.

import knex from 'knex';
import config from '../knexfile';

const env = process.env.NODE_ENV === 'production' ? 'production' : 'development';
const envConfig = config[env];
if (!envConfig) {
  throw new Error(`No knex config for NODE_ENV="${env}"`);
}

export const db = knex(envConfig);
