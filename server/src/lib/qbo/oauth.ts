// Copyright 2025-2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Use is limited to qualifying small businesses. See LICENSE for terms.

/**
 * Intuit OAuth2 primitives. Pure apart from the injected `fetchImpl`, so the
 * token-response parsing and error classification are unit-testable without
 * a network.
 *
 * Logging discipline: on failure only the HTTP status and Intuit's `error` /
 * `error_description` fields are surfaced — never a raw body, which on the
 * success path would contain tokens.
 */
import { QBO_AUTHORIZE_URL, QBO_REVOKE_URL, QBO_SCOPE, QBO_TOKEN_URL } from './settings';

export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

const REQUEST_TIMEOUT_MS = 15_000;

export interface TokenSet {
  accessToken: string;
  accessTokenExpiresAt: Date;
  refreshToken: string;
  refreshTokenExpiresAt: Date;
}

export type TokenErrorKind = 'invalid_grant' | 'transient' | 'fatal';

export class QboOAuthError extends Error {
  readonly kind: TokenErrorKind;
  readonly status: number;
  readonly intuitError: string | null;
  constructor(message: string, kind: TokenErrorKind, status: number, intuitError: string | null = null) {
    super(message);
    this.name = 'QboOAuthError';
    this.kind = kind;
    this.status = status;
    this.intuitError = intuitError;
  }
}

export function buildAuthorizeUrl(params: { clientId: string; redirectUri: string; state: string }): string {
  const u = new URL(QBO_AUTHORIZE_URL);
  u.searchParams.set('client_id', params.clientId);
  u.searchParams.set('response_type', 'code');
  u.searchParams.set('scope', QBO_SCOPE);
  u.searchParams.set('redirect_uri', params.redirectUri);
  u.searchParams.set('state', params.state);
  return u.toString();
}

/**
 * Intuit returns lifetimes as seconds-from-now (`expires_in`, ~1h;
 * `x_refresh_token_expires_in`, ~100 days). A response without a refresh token
 * is unusable — we could never refresh — so it is rejected outright.
 */
export function parseTokenResponse(json: unknown, nowMs: number): TokenSet {
  const o = (json ?? {}) as Record<string, unknown>;
  const accessToken = typeof o.access_token === 'string' ? o.access_token : '';
  const refreshToken = typeof o.refresh_token === 'string' ? o.refresh_token : '';
  if (!accessToken) throw new QboOAuthError('Token response had no access_token.', 'fatal', 200);
  if (!refreshToken) throw new QboOAuthError('Token response had no refresh_token.', 'fatal', 200);
  const expiresIn = Number(o.expires_in);
  const refreshExpiresIn = Number(o.x_refresh_token_expires_in);
  return {
    accessToken,
    accessTokenExpiresAt: new Date(nowMs + (Number.isFinite(expiresIn) && expiresIn > 0 ? expiresIn : 3600) * 1000),
    refreshToken,
    refreshTokenExpiresAt: new Date(
      nowMs + (Number.isFinite(refreshExpiresIn) && refreshExpiresIn > 0 ? refreshExpiresIn : 100 * 86_400) * 1000,
    ),
  };
}

/**
 * `invalid_grant` means the refresh token is dead (revoked, expired, rotated
 * away) and only a fresh authorization fixes it; 429/5xx are worth a retry;
 * everything else (bad credentials, bad request) is fatal until an admin acts.
 */
export function classifyTokenError(status: number, body: unknown): TokenErrorKind {
  const o = (body ?? {}) as Record<string, unknown>;
  const err = typeof o.error === 'string' ? o.error : '';
  if (err === 'invalid_grant') return 'invalid_grant';
  if (status === 429 || status >= 500) return 'transient';
  return 'fatal';
}

function intuitErrorField(body: unknown): string | null {
  const o = (body ?? {}) as Record<string, unknown>;
  const err = typeof o.error === 'string' ? o.error : null;
  const desc = typeof o.error_description === 'string' ? o.error_description : null;
  if (err && desc) return `${err}: ${desc}`;
  return err ?? desc;
}

function basicAuth(clientId: string, clientSecret: string): string {
  return `Basic ${Buffer.from(`${clientId}:${clientSecret}`, 'utf8').toString('base64')}`;
}

async function tokenRequest(
  form: Record<string, string>,
  creds: { clientId: string; clientSecret: string },
  fetchImpl: FetchLike,
  what: string,
): Promise<TokenSet> {
  let res: Response;
  try {
    res = await fetchImpl(QBO_TOKEN_URL, {
      method: 'POST',
      headers: {
        Authorization: basicAuth(creds.clientId, creds.clientSecret),
        Accept: 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams(form).toString(),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (err) {
    throw new QboOAuthError(`Intuit ${what} request failed: ${err instanceof Error ? err.message : String(err)}`, 'transient', 0);
  }
  let body: unknown = null;
  try {
    body = await res.json();
  } catch {
    body = null;
  }
  if (!res.ok) {
    const kind = classifyTokenError(res.status, body);
    const detail = intuitErrorField(body);
    throw new QboOAuthError(`Intuit ${what} failed (HTTP ${res.status}${detail ? `, ${detail}` : ''}).`, kind, res.status, detail);
  }
  return parseTokenResponse(body, Date.now());
}

export async function exchangeCode(params: {
  clientId: string;
  clientSecret: string;
  code: string;
  redirectUri: string;
  fetchImpl?: FetchLike;
}): Promise<TokenSet> {
  return tokenRequest(
    { grant_type: 'authorization_code', code: params.code, redirect_uri: params.redirectUri },
    params,
    params.fetchImpl ?? fetch,
    'code exchange',
  );
}

export async function refreshTokens(params: {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
  fetchImpl?: FetchLike;
}): Promise<TokenSet> {
  return tokenRequest(
    { grant_type: 'refresh_token', refresh_token: params.refreshToken },
    params,
    params.fetchImpl ?? fetch,
    'token refresh',
  );
}

/**
 * Revoke a refresh token (which also invalidates its access token). Best
 * effort by design: callers disconnect locally whether or not Intuit answers.
 */
export async function revokeToken(params: {
  clientId: string;
  clientSecret: string;
  token: string;
  fetchImpl?: FetchLike;
}): Promise<boolean> {
  const fetchImpl = params.fetchImpl ?? fetch;
  try {
    const res = await fetchImpl(QBO_REVOKE_URL, {
      method: 'POST',
      headers: {
        Authorization: basicAuth(params.clientId, params.clientSecret),
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ token: params.token }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    if (!res.ok) console.warn(`[qbo] Token revoke returned HTTP ${res.status}.`);
    return res.ok;
  } catch (err) {
    console.warn('[qbo] Token revoke request failed:', err instanceof Error ? err.message : err);
    return false;
  }
}
