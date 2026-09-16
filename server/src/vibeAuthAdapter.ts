// Copyright 2025-2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Use is limited to qualifying small businesses. See LICENSE for terms.

/**
 * Adapter module for the `vibe-auth` CLI (break-glass account management):
 *
 *   cd server && npx vibe-auth breakglass ensure|rotate|status
 *
 * package.json → "vibeAuth": { "adapter": "./dist/vibeAuthAdapter.js" } points
 * the CLI here. It runs in its own process with the same env as the server
 * (DATABASE_URL etc.); nothing here needs JWT_SECRET or Express.
 *
 * `export =` because the CLI is ESM and reads `module.exports` as the default
 * export — a TS `export default` would arrive wrapped as `{ default: ... }`.
 */

import 'dotenv/config';
import type { VibeAuthCliAdapter } from '@kisaesdevlab/vibe-auth';
import { db } from './db';
import { createVibeUsers, vibeAuditSink } from './lib/vibeAuthUsers';

const adapter: VibeAuthCliAdapter = {
  users: createVibeUsers(),
  audit: vibeAuditSink,
  adminRole: 'admin',
  breakglassEmail: 'breakglass@vibe-tb.local',
  close: () => db.destroy(),
};

export = adapter;
