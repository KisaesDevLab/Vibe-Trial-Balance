// Copyright 2025-2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Use is limited to qualifying small businesses. See LICENSE for terms.

/**
 * Token lifecycle for a bound QuickBooks connection. DB-bound.
 *
 * Intuit ROTATES the refresh token on every refresh and the old one dies, so
 * two concurrent refreshes for one realm would leave one caller holding a
 * dead token that then marks the connection `needs_reauth`. Every refresh
 * therefore runs under a transaction-scoped advisory lock keyed by the realm
 * and re-reads the row after acquiring it — the second caller finds a fresh
 * access token already persisted and skips.
 */
import { createHash } from 'crypto';
import { db } from '../../db';
import { decrypt, encrypt } from '../encryption';
import { createQboApi, type QboApi } from './apiClient';
import { qboLimiter } from './limiter';
import { QboOAuthError, refreshTokens, revokeToken, type FetchLike } from './oauth';
import { loadQboConfig, type QboEnvironment } from './settings';

export interface QboConnectionRow {
  id: number;
  client_id: number;
  realm_id: string;
  company_name: string | null;
  environment: QboEnvironment;
  status: 'active' | 'needs_reauth' | 'error';
  access_token_enc: string | null;
  access_token_expires_at: Date | string | null;
  refresh_token_enc: string;
  refresh_token_expires_at: Date | string;
  first_authorized_at: Date | string;
  last_refreshed_at: Date | string | null;
  last_refresh_error: string | null;
  last_import_at: Date | string | null;
  connected_by: number | null;
  bound_at: Date | string;
}

export type QboConnectionErrorCode = 'NOT_FOUND' | 'NEEDS_REAUTH' | 'ENV_MISMATCH' | 'NOT_CONFIGURED';

export class QboConnectionError extends Error {
  readonly code: QboConnectionErrorCode;
  constructor(code: QboConnectionErrorCode, message: string) {
    super(message);
    this.name = 'QboConnectionError';
    this.code = code;
  }
}

/** sha256 hex of the raw state nonce — the DB never stores the raw value. */
export function hashState(raw: string): string {
  return createHash('sha256').update(raw, 'utf8').digest('hex');
}

/** Refresh when the access token has less than this left; Intuit access tokens live ~1h. */
const REFRESH_SKEW_MS = 120_000;

function toMs(v: Date | string | null | undefined): number {
  if (!v) return 0;
  const t = v instanceof Date ? v.getTime() : Date.parse(v);
  return Number.isFinite(t) ? t : 0;
}

/** Advisory lock key: the realm alone would collide across environments in theory; include both. */
function lockKey(row: Pick<QboConnectionRow, 'environment' | 'realm_id'>): string {
  return `qbo:${row.environment}:${row.realm_id}`;
}

async function markNeedsReauth(connectionId: number, reason: string): Promise<void> {
  await db('qbo_connections')
    .where({ id: connectionId })
    .update({ status: 'needs_reauth', last_refresh_error: reason.slice(0, 1000), updated_at: db.fn.now() });
}

export interface AccessTokenOptions {
  forceRefresh?: boolean;
  fetchImpl?: FetchLike;
}

/**
 * A usable access token for the connection, refreshing (and persisting the
 * rotated pair) when it is missing, near expiry, or `forceRefresh` is set.
 * Throws `QboConnectionError('NEEDS_REAUTH')` when only a new authorization
 * can help; the row is already flagged by then.
 */
export async function getValidAccessToken(connectionId: number, opts: AccessTokenOptions = {}): Promise<string> {
  const cfg = await loadQboConfig();
  if (!cfg.configured) throw new QboConnectionError('NOT_CONFIGURED', 'QuickBooks is not configured.');

  const peek = (await db('qbo_connections').where({ id: connectionId }).first()) as QboConnectionRow | undefined;
  if (!peek) throw new QboConnectionError('NOT_FOUND', 'QuickBooks connection not found.');
  if (peek.environment !== cfg.environment) {
    throw new QboConnectionError(
      'ENV_MISMATCH',
      `This connection was authorized against the ${peek.environment} environment but QuickBooks is now set to ${cfg.environment}. Reconnect the client.`,
    );
  }
  if (peek.status !== 'active') {
    throw new QboConnectionError('NEEDS_REAUTH', peek.last_refresh_error || 'QuickBooks connection needs re-authorization.');
  }

  // Fast path: a fresh token without taking the lock.
  if (!opts.forceRefresh && peek.access_token_enc && toMs(peek.access_token_expires_at) - Date.now() > REFRESH_SKEW_MS) {
    try {
      return decrypt(peek.access_token_enc);
    } catch {
      // Fall through to a refresh; the refresh token may still decrypt.
    }
  }

  const staleAccess = peek.access_token_enc;
  let outcome: { token: string } | { needsReauth: string } | null = null;

  await db.transaction(async (trx) => {
    await trx.raw('SELECT pg_advisory_xact_lock(hashtext(?))', [lockKey(peek)]);
    const row = (await trx('qbo_connections').where({ id: connectionId }).first()) as QboConnectionRow | undefined;
    if (!row) throw new QboConnectionError('NOT_FOUND', 'QuickBooks connection not found.');
    if (row.status !== 'active') {
      outcome = { needsReauth: row.last_refresh_error || 'QuickBooks connection needs re-authorization.' };
      return;
    }

    // Someone else refreshed while we waited for the lock: their token is fresh and not the one that 401'd.
    if (row.access_token_enc && row.access_token_enc !== staleAccess && toMs(row.access_token_expires_at) - Date.now() > REFRESH_SKEW_MS) {
      try {
        outcome = { token: decrypt(row.access_token_enc) };
        return;
      } catch {
        // proceed to refresh
      }
    }

    let refreshToken: string;
    try {
      refreshToken = decrypt(row.refresh_token_enc);
    } catch {
      // ENCRYPTION_KEY rotated under us: the stored grant is unreadable, so it is as good as revoked.
      outcome = { needsReauth: 'Stored QuickBooks credentials could not be decrypted (encryption key changed). Reconnect the client.' };
      return;
    }

    try {
      const tokens = await refreshTokens({
        clientId: cfg.clientId,
        clientSecret: cfg.clientSecret,
        refreshToken,
        fetchImpl: opts.fetchImpl,
      });
      await trx('qbo_connections')
        .where({ id: connectionId })
        .update({
          access_token_enc: encrypt(tokens.accessToken),
          access_token_expires_at: tokens.accessTokenExpiresAt,
          refresh_token_enc: encrypt(tokens.refreshToken),
          refresh_token_expires_at: tokens.refreshTokenExpiresAt,
          last_refreshed_at: trx.fn.now(),
          last_refresh_error: null,
          updated_at: trx.fn.now(),
        });
      outcome = { token: tokens.accessToken };
    } catch (err) {
      if (err instanceof QboOAuthError && err.kind === 'invalid_grant') {
        outcome = { needsReauth: `Intuit rejected the stored authorization (${err.intuitError ?? 'invalid_grant'}). Reconnect the client.` };
        return;
      }
      // Transient / fatal: keep the row active, record the error, and let the caller see it.
      await trx('qbo_connections')
        .where({ id: connectionId })
        .update({ last_refresh_error: (err instanceof Error ? err.message : String(err)).slice(0, 1000), updated_at: trx.fn.now() });
      throw err;
    }
  });

  const result = outcome as { token: string } | { needsReauth: string } | null;
  if (result && 'token' in result) return result.token;
  const reason = result && 'needsReauth' in result ? result.needsReauth : 'QuickBooks connection needs re-authorization.';
  await markNeedsReauth(connectionId, reason);
  throw new QboConnectionError('NEEDS_REAUTH', reason);
}

export async function loadConnection(connectionId: number): Promise<QboConnectionRow | null> {
  const row = (await db('qbo_connections').where({ id: connectionId }).first()) as QboConnectionRow | undefined;
  return row ?? null;
}

export async function loadConnectionForClient(clientId: number): Promise<QboConnectionRow | null> {
  const row = (await db('qbo_connections').where({ client_id: clientId }).first()) as QboConnectionRow | undefined;
  return row ?? null;
}

/** An API client bound to a connection, sharing the process-wide realm limiter. */
export async function apiForConnection(conn: Pick<QboConnectionRow, 'id' | 'realm_id'>, fetchImpl?: FetchLike): Promise<QboApi> {
  const cfg = await loadQboConfig();
  return createQboApi({
    baseUrl: cfg.apiBaseUrl,
    realmId: conn.realm_id,
    getAccessToken: (force) => getValidAccessToken(conn.id, { forceRefresh: force, fetchImpl }),
    fetchImpl,
    limiter: qboLimiter,
  });
}

/** Best-effort revoke of a stored (encrypted) refresh token. Never throws. */
export async function revokeEncryptedToken(refreshTokenEnc: string | null | undefined, fetchImpl?: FetchLike): Promise<boolean> {
  if (!refreshTokenEnc) return false;
  const cfg = await loadQboConfig();
  if (!cfg.configured) return false;
  let token: string;
  try {
    token = decrypt(refreshTokenEnc);
  } catch {
    return false;
  }
  return revokeToken({ clientId: cfg.clientId, clientSecret: cfg.clientSecret, token, fetchImpl });
}
