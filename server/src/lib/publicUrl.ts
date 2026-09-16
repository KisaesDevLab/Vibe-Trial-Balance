// Copyright 2025-2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Use is limited to qualifying small businesses. See LICENSE for terms.

/**
 * The app's public base URL — the one link an operator would paste into a
 * browser. It feeds password-reset and invite links, the QuickBooks redirect
 * URI, and (new) the WebAuthn relying party: passkeys are bound to the
 * hostname, so a wrong or missing URL means no passkey can ever be created.
 *
 * Resolution: `app.public_url` settings row > APP_BASE_URL env > the first
 * non-regex ALLOWED_ORIGIN entry > http://localhost:5173 (dev). The settings
 * row exists because a self-hosted firm edits Settings, not .env (see
 * CLAUDE.md); the env fallback keeps every existing deployment working.
 *
 * The pure functions are unit-tested; the snapshot is loaded at boot and after
 * every save, and a DB failure only logs (never blocks boot).
 */

export type PublicUrlSource = 'setting' | 'env' | 'origin' | 'default';

export interface PublicUrlResolution {
  url: string;
  source: PublicUrlSource;
}

export const DEFAULT_DEV_URL = 'http://localhost:5173';

function clean(v: string | null | undefined): string {
  return (v ?? '').trim().replace(/\/+$/, '');
}

/** Pure: pick the effective base URL and say where it came from. */
export function resolvePublicBaseUrl(input: {
  setting?: string | null;
  appBaseUrl?: string | null;
  allowedOrigin?: string | null;
}): PublicUrlResolution {
  const setting = clean(input.setting);
  if (setting) return { url: setting, source: 'setting' };
  const env = clean(input.appBaseUrl);
  if (env) return { url: env, source: 'env' };
  // ALLOWED_ORIGIN is a comma list whose entries may be /regex/ — a regex is
  // not a URL and must not become a base. Test BEFORE stripping slashes, or
  // the closing one is gone by the time we look.
  const rawFirst = ((input.allowedOrigin ?? '').split(',')[0] ?? '').trim();
  const isRegex = rawFirst.length > 1 && rawFirst.startsWith('/') && rawFirst.endsWith('/');
  const first = clean(rawFirst);
  if (first && !isRegex) return { url: first, source: 'origin' };
  return { url: DEFAULT_DEV_URL, source: 'default' };
}

export type RelyingParty =
  | { ok: true; rpID: string; origin: string }
  | { ok: false; reason: string };

const IPV4 = /^\d{1,3}(\.\d{1,3}){3}$/;

/**
 * Pure: derive the WebAuthn relying party from a base URL. WebAuthn only runs
 * in a secure context, so https for any host, or plain http for `localhost`
 * (which browsers treat as secure — that is what lets `npm run dev` work).
 * A LAN IP over http is the common misconfiguration and gets a precise reason.
 */
export function deriveRelyingParty(baseUrl: string): RelyingParty {
  let u: URL;
  try {
    u = new URL(baseUrl);
  } catch {
    return { ok: false, reason: `The public app URL "${baseUrl}" is not a valid URL.` };
  }
  const host = u.hostname.toLowerCase();
  if (!host) return { ok: false, reason: 'The public app URL has no hostname.' };
  if (u.protocol === 'https:') {
    if (IPV4.test(host) || host.startsWith('[')) {
      return { ok: false, reason: 'Passkeys need a hostname, not an IP address. Set the public app URL to a domain name.' };
    }
    return { ok: true, rpID: host, origin: u.origin };
  }
  if (u.protocol === 'http:') {
    if (host === 'localhost') return { ok: true, rpID: host, origin: u.origin };
    return {
      ok: false,
      reason: `Passkeys require https. The public app URL is "${baseUrl}"; set it to an https address (or use http://localhost for development).`,
    };
  }
  return { ok: false, reason: `The public app URL must start with https:// (got "${u.protocol}").` };
}

// ── Live snapshot ────────────────────────────────────────────────────────────

export const PUBLIC_URL_SETTING_KEY = 'app.public_url';

let settingValue: string | null = null;

/** Push the settings-row value into the snapshot (null / '' = not set). */
export function setPublicUrlSetting(value: string | null): void {
  settingValue = clean(value) || null;
}

export function getPublicUrlSetting(): string | null {
  return settingValue;
}

/** The effective base URL right now (no trailing slash) with its source. */
export function resolvePublicUrl(): PublicUrlResolution {
  return resolvePublicBaseUrl({
    setting: settingValue,
    appBaseUrl: process.env.APP_BASE_URL,
    allowedOrigin: process.env.ALLOWED_ORIGIN,
  });
}

export function getPublicBaseUrl(): string {
  return resolvePublicUrl().url;
}

export function getRelyingParty(): RelyingParty {
  return deriveRelyingParty(getPublicBaseUrl());
}
