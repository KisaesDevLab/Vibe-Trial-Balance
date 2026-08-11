// Copyright 2025-2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Use is limited to qualifying small businesses. See LICENSE for terms.

/**
 * DB-backed AI mode settings (admin-selectable router/direct).
 *
 * Storage: three rows in the settings table —
 *   ai.mode          'router' | 'direct'   (absent = follow VIBE_AI_MODE env)
 *   ai.router_url    router base URL       (absent = follow VIBE_AI_ROUTER_URL)
 *   ai.router_token  app token, encrypted  (absent = follow VIBE_AI_TOKEN)
 *
 * This module owns the DB reads/writes; the in-memory snapshot the request path
 * consults lives in routerProvider.ts (setAiModeOverrides) so the router driver
 * and its tests stay database-free. A DB-set mode must never brick boot the way
 * bad env does (validateAiModeEnv + process.exit): loadAiModeOverrides only logs
 * on failure, and a saved-but-unreachable router fails at request time with the
 * driver's normal no-fallback error.
 */

import { db } from '../db';
import { decrypt, isEncrypted } from '../lib/encryption';
import { setAiModeOverrides, type AiModeOverrides } from './routerProvider';

export const AI_MODE_KEYS = {
  mode: 'ai.mode',
  routerUrl: 'ai.router_url',
  routerToken: 'ai.router_token',
} as const;

/** Read the settings rows (token decrypted) without touching the live snapshot. */
export async function readAiModeSettings(): Promise<AiModeOverrides> {
  const rows = await db('settings')
    .whereIn('key', Object.values(AI_MODE_KEYS))
    .select('key', 'value');
  const s: Record<string, string> = {};
  for (const r of rows) s[r.key as string] = r.value as string;

  let token = s[AI_MODE_KEYS.routerToken] || null;
  if (token && isEncrypted(token)) {
    try { token = decrypt(token); } catch { /* legacy plaintext */ }
  }
  const mode = s[AI_MODE_KEYS.mode];
  return {
    mode: mode === 'router' || mode === 'direct' ? mode : null,
    routerUrl: s[AI_MODE_KEYS.routerUrl] || null,
    routerToken: token,
  };
}

/** Load the settings rows into the live snapshot. Fired at boot and after every save. */
export async function loadAiModeOverrides(): Promise<void> {
  try {
    setAiModeOverrides(await readAiModeSettings());
  } catch (err) {
    console.error(
      `[ai-mode] could not load AI mode settings from DB; using env/default: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}
