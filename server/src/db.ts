// Copyright 2025-2026 Kisaes LLC
// Licensed under the PolyForm Internal Use License 1.0.0.
// You may not distribute this software. See LICENSE for terms.

import knex from 'knex';
import config from '../knexfile';

export const db = knex(config['development']);
