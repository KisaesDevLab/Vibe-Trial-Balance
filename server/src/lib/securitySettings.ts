// Copyright 2025-2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Use is limited to qualifying small businesses. See LICENSE for terms.

/**
 * Firm-wide sign-in policy, DB-backed (settings rows), memoised like
 * aiModeSettings.ts: loaded at boot and after every save, re-read on a short
 * TTL as insurance, and a DB failure only logs — a policy row must never brick
 * boot.
 *
 *   security.require_two_factor  'true' | 'false'
 *   app.public_url               absolute URL (lib/publicUrl.ts owns it)
 */

import { db } from '../db';
import { PUBLIC_URL_SETTING_KEY, setPublicUrlSetting } from './publicUrl';

export const REQUIRE_TWO_FACTOR_KEY = 'security.require_two_factor';

export interface SecuritySettings {
  requireTwoFactor: boolean;
}

const TTL_MS = 60 * 1000;
let snapshot: SecuritySettings = { requireTwoFactor: false };
let loadedAt = 0;
let refreshing: Promise<void> | null = null;

export async function readSecuritySettings(): Promise<{ requireTwoFactor: boolean; publicUrl: string | null }> {
  const rows = await db('settings')
    .whereIn('key', [REQUIRE_TWO_FACTOR_KEY, PUBLIC_URL_SETTING_KEY])
    .select('key', 'value');
  const s: Record<string, string | null> = {};
  for (const r of rows) s[r.key as string] = (r.value as string | null) ?? null;
  return {
    requireTwoFactor: s[REQUIRE_TWO_FACTOR_KEY] === 'true',
    publicUrl: s[PUBLIC_URL_SETTING_KEY] || null,
  };
}

/** Load both rows into their snapshots. Boot + after every save. */
export async function loadSecuritySettings(): Promise<void> {
  try {
    const s = await readSecuritySettings();
    snapshot = { requireTwoFactor: s.requireTwoFactor };
    setPublicUrlSetting(s.publicUrl);
    loadedAt = Date.now();
  } catch (err) {
    console.error(
      `[security] could not load sign-in policy from DB; keeping previous values: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

/** Sync read of the current policy; kicks a background refresh when stale. */
export function securitySettings(): SecuritySettings {
  if (Date.now() - loadedAt > TTL_MS && !refreshing) {
    refreshing = loadSecuritySettings().finally(() => { refreshing = null; });
  }
  return snapshot;
}

/** Test seam. */
export function setSecuritySettingsForTest(s: SecuritySettings): void {
  snapshot = s;
  loadedAt = Date.now();
}
