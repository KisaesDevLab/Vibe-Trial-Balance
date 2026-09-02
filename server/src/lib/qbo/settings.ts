// Copyright 2025-2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Use is limited to qualifying small businesses. See LICENSE for terms.

/**
 * QuickBooks Online connector configuration.
 *
 * Resolution is settings rows > env > unconfigured, memoised like
 * `lib/mailService.ts` / `lib/storage/index.ts`. The Intuit app credentials are
 * entered on the QuickBooks page; env vars are only a fallback for operators
 * who prefer them. Credentials are NEVER copied into `process.env`.
 *
 * A DB failure while loading logs and reports "unconfigured" — this must never
 * brick boot over an optional feature.
 */
import { db } from '../../db';
import { decrypt, isEncrypted } from '../encryption';
import { buildAppUrl } from '../mailTemplates';

export type QboEnvironment = 'sandbox' | 'production';

export const QBO_SETTING_KEYS = {
  clientId: 'qbo.client_id',
  clientSecret: 'qbo.client_secret',
  environment: 'qbo.environment',
  redirectUri: 'qbo.redirect_uri',
} as const;

/** Every setting key the loader reads, for a single whereIn. */
export const QBO_SETTING_KEY_LIST: readonly string[] = Object.values(QBO_SETTING_KEYS);

/** Intuit's OAuth2 endpoints are environment-independent; only the API host differs. */
export const QBO_AUTHORIZE_URL = 'https://appcenter.intuit.com/connect/oauth2';
export const QBO_TOKEN_URL = 'https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer';
export const QBO_REVOKE_URL = 'https://developer.api.intuit.com/v2/oauth2/tokens/revoke';
export const QBO_API_BASE: Record<QboEnvironment, string> = {
  sandbox: 'https://sandbox-quickbooks.api.intuit.com',
  production: 'https://quickbooks.api.intuit.com',
};
/** Read-only accounting scope — the connector never writes to QuickBooks. */
export const QBO_SCOPE = 'com.intuit.quickbooks.accounting';
/** Pinned so a QBO-side default bump cannot change a response shape under us. */
export const QBO_MINOR_VERSION = '75';

/** The path our callback route is mounted at; the redirect URI must end with it. */
export const QBO_CALLBACK_PATH = '/api/v1/integrations/qbo/callback';

export interface QboConfig {
  /** Client ID + secret present. Environment always resolves. */
  configured: boolean;
  clientId: string;
  clientSecret: string;
  environment: QboEnvironment;
  /** Effective redirect URI: the override when set, else derived from the app base URL. */
  redirectUri: string;
  /** The override as stored ('' when the derived default is in use). */
  redirectUriOverride: string;
  /** Default the instance would use with no override. */
  defaultRedirectUri: string;
  /** True when credentials came from env vars rather than settings rows. */
  envOverride: boolean;
  apiBaseUrl: string;
}

export function isQboEnvironment(v: unknown): v is QboEnvironment {
  return v === 'sandbox' || v === 'production';
}

/** `https://tb.firm.com` → `https://tb.firm.com/api/v1/integrations/qbo/callback`. */
export function defaultRedirectUri(appBase: string): string {
  return `${appBase.trim().replace(/\/+$/, '')}${QBO_CALLBACK_PATH}`;
}

/**
 * Inverse of `defaultRedirectUri`: the SPA base the callback should send the
 * browser back to. Derived from the CONFIGURED redirect URI (never from the
 * request) so an override that carries a base path (`https://host/tb/api/...`)
 * lands on `https://host/tb`. A URI without our callback path falls back to
 * its origin.
 */
export function publicBaseFromRedirectUri(uri: string): string {
  const trimmed = uri.trim().replace(/\/+$/, '');
  if (trimmed.endsWith(QBO_CALLBACK_PATH)) return trimmed.slice(0, -QBO_CALLBACK_PATH.length);
  try {
    return new URL(trimmed).origin;
  } catch {
    return trimmed;
  }
}

/** Validation shared by the settings route: absolute http(s), ends with the callback path. */
export function redirectUriProblem(uri: string): string | null {
  let parsed: URL;
  try {
    parsed = new URL(uri);
  } catch {
    return 'Redirect URI must be an absolute URL.';
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return 'Redirect URI must use http or https.';
  if (parsed.search || parsed.hash) return 'Redirect URI must not carry a query string or fragment.';
  if (!parsed.pathname.replace(/\/+$/, '').endsWith(QBO_CALLBACK_PATH)) {
    return `Redirect URI must end with ${QBO_CALLBACK_PATH} — that is where Intuit sends the browser back.`;
  }
  return null;
}

/** Pure resolver: settings values (already decrypted) > env > unconfigured. */
export function resolveQboConfig(
  dbVals: Partial<Record<string, string>>,
  env: NodeJS.ProcessEnv,
  appBase: string,
): QboConfig {
  const dbClientId = (dbVals[QBO_SETTING_KEYS.clientId] ?? '').trim();
  const dbSecret = (dbVals[QBO_SETTING_KEYS.clientSecret] ?? '').trim();
  const fromDb = dbClientId.length > 0 || dbSecret.length > 0;

  const clientId = fromDb ? dbClientId : (env.QBO_CLIENT_ID ?? '').trim();
  const clientSecret = fromDb ? dbSecret : (env.QBO_CLIENT_SECRET ?? '').trim();
  const envOverride = !fromDb && clientId.length > 0;

  const rawEnv = (dbVals[QBO_SETTING_KEYS.environment] ?? env.QBO_ENVIRONMENT ?? 'sandbox').trim().toLowerCase();
  const environment: QboEnvironment = isQboEnvironment(rawEnv) ? rawEnv : 'sandbox';

  const override = (dbVals[QBO_SETTING_KEYS.redirectUri] ?? env.QBO_REDIRECT_URI ?? '').trim();
  const defaultUri = defaultRedirectUri(appBase);
  const redirectUri = override.length > 0 && redirectUriProblem(override) === null ? override : defaultUri;

  return {
    configured: clientId.length > 0 && clientSecret.length > 0,
    clientId,
    clientSecret,
    environment,
    redirectUri,
    redirectUriOverride: override,
    defaultRedirectUri: defaultUri,
    envOverride,
    apiBaseUrl: QBO_API_BASE[environment],
  };
}

function decryptIfNeeded(value: string): string {
  if (!isEncrypted(value)) return value;
  try {
    return decrypt(value);
  } catch {
    return value;
  }
}

async function loadDbSettings(): Promise<Record<string, string>> {
  try {
    const rows = await db('settings').whereIn('key', QBO_SETTING_KEY_LIST).select('key', 'value');
    const out: Record<string, string> = {};
    for (const r of rows as Array<{ key: string; value: string | null }>) {
      if (r.value === null || r.value === undefined) continue;
      out[r.key] = r.key === QBO_SETTING_KEYS.clientSecret ? decryptIfNeeded(String(r.value)) : String(r.value);
    }
    return out;
  } catch (err) {
    console.error('[qbo] Could not load settings; treating the connector as unconfigured:', err instanceof Error ? err.message : err);
    return {};
  }
}

/** The SPA base URL this server believes it is served from (`APP_BASE_URL` > first allowed origin > localhost). */
export function appBaseUrl(): string {
  return buildAppUrl('/').replace(/\/$/, '');
}

let cached: QboConfig | null = null;

export async function loadQboConfig(): Promise<QboConfig> {
  if (cached) return cached;
  cached = resolveQboConfig(await loadDbSettings(), process.env, appBaseUrl());
  return cached;
}

/** Call after any settings write so the next request re-reads the rows. */
export function invalidateQboCache(): void {
  cached = null;
}

export async function isQboConfigured(): Promise<boolean> {
  return (await loadQboConfig()).configured;
}
