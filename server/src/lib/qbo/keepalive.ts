// Copyright 2025-2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Use is limited to qualifying small businesses. See LICENSE for terms.

/**
 * Weekly QuickBooks keepalive. Intuit refresh tokens expire ~100 days after
 * they were last used; a client whose books are only pulled at year end
 * would otherwise need re-authorizing every time. Refreshing weekly keeps
 * every grant alive, and each refresh goes through `tokenStore`, so it
 * serialises with any request-path refresh for the same realm.
 *
 * Also prunes expired OAuth states and abandoned pending imports. Every step
 * is try/caught: a scheduler must never take the process down.
 */
import cron from 'node-cron';
import { db } from '../../db';
import { loadQboConfig } from './settings';
import { getValidAccessToken, type QboConnectionRow } from './tokenStore';

const WARN_BEFORE_MS = 14 * 86_400_000;

export async function runQboKeepalive(): Promise<{ refreshed: number; failed: number; skipped: boolean }> {
  const cfg = await loadQboConfig();
  if (!cfg.configured) {
    console.log('[qbo-keepalive] QuickBooks not configured; nothing to do.');
    return { refreshed: 0, failed: 0, skipped: true };
  }

  let refreshed = 0;
  let failed = 0;
  try {
    const rows = (await db('qbo_connections')
      .where({ status: 'active', environment: cfg.environment })
      .select('id', 'client_id', 'realm_id', 'company_name', 'refresh_token_expires_at')) as Array<
      Pick<QboConnectionRow, 'id' | 'client_id' | 'realm_id' | 'company_name' | 'refresh_token_expires_at'>
    >;
    for (const row of rows) {
      try {
        await getValidAccessToken(row.id, { forceRefresh: true });
        refreshed++;
      } catch (err) {
        failed++;
        console.warn(
          `[qbo-keepalive] Refresh failed for client ${row.client_id} (${row.company_name ?? row.realm_id}):`,
          err instanceof Error ? err.message : err,
        );
      }
    }
    // Post-refresh read: a successful refresh pushed the expiry out ~100 days, so anything still near is stuck.
    const soon = (await db('qbo_connections')
      .where({ status: 'active' })
      .andWhere('refresh_token_expires_at', '<', new Date(Date.now() + WARN_BEFORE_MS))
      .select('client_id', 'company_name', 'refresh_token_expires_at')) as Array<
      Pick<QboConnectionRow, 'client_id' | 'company_name' | 'refresh_token_expires_at'>
    >;
    for (const s of soon) {
      console.warn(
        `[qbo-keepalive] Refresh token for client ${s.client_id} (${s.company_name ?? '?'}) expires ${String(s.refresh_token_expires_at)}; reconnect soon.`,
      );
    }
  } catch (err) {
    console.error('[qbo-keepalive] Connection sweep failed:', err instanceof Error ? err.message : err);
  }

  try {
    await db('qbo_oauth_states')
      .where('expires_at', '<', new Date(Date.now() - 86_400_000))
      .andWhere((q) => q.whereNull('pending_expires_at').orWhere('pending_expires_at', '<', new Date(Date.now() - 86_400_000)))
      .del();
    await db('document_imports')
      .where({ import_type: 'qbo', status: 'pending' })
      .andWhere('imported_at', '<', new Date(Date.now() - 7 * 86_400_000))
      .del();
  } catch (err) {
    console.error('[qbo-keepalive] Prune failed:', err instanceof Error ? err.message : err);
  }

  console.log(`[qbo-keepalive] Done: ${refreshed} refreshed, ${failed} failed.`);
  return { refreshed, failed, skipped: false };
}

/** Mondays 03:00 server time — after the nightly backup, before anyone is in. */
export function startQboKeepalive(): void {
  cron.schedule('0 3 * * 1', () => {
    runQboKeepalive().catch((err) => {
      console.error('[qbo-keepalive] Unexpected failure:', err instanceof Error ? err.message : err);
    });
  });
  console.log('[qbo-keepalive] Scheduled weekly QuickBooks token refresh (Mon 03:00).');
}
