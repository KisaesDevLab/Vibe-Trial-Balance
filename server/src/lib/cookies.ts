// Copyright 2025-2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Use is limited to qualifying small businesses. See LICENSE for terms.

/**
 * Just enough cookie handling for the one cookie this app sets (the trusted
 * browser token). Not worth a dependency.
 */

export function parseCookieHeader(header: string | undefined | null): Record<string, string> {
  const out: Record<string, string> = {};
  if (!header) return out;
  for (const part of header.split(';')) {
    const eq = part.indexOf('=');
    if (eq < 0) continue;
    const name = part.slice(0, eq).trim();
    if (!name) continue;
    let value = part.slice(eq + 1).trim();
    if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
    try {
      out[name] = decodeURIComponent(value);
    } catch {
      out[name] = value;
    }
  }
  return out;
}

export interface CookieAttrs {
  maxAgeSec: number;
  secure: boolean;
  /** Defaults to '/'. */
  path?: string;
  sameSite?: 'Lax' | 'Strict';
}

/** Build a Set-Cookie header value. HttpOnly always. */
export function buildCookie(name: string, value: string, attrs: CookieAttrs): string {
  const parts = [
    `${name}=${encodeURIComponent(value)}`,
    `Max-Age=${Math.max(0, Math.floor(attrs.maxAgeSec))}`,
    `Path=${attrs.path ?? '/'}`,
    'HttpOnly',
    `SameSite=${attrs.sameSite ?? 'Lax'}`,
  ];
  if (attrs.secure) parts.push('Secure');
  return parts.join('; ');
}

/** A Set-Cookie header value that deletes the cookie. */
export function clearCookie(name: string, attrs: Pick<CookieAttrs, 'secure' | 'path'>): string {
  return buildCookie(name, '', { maxAgeSec: 0, secure: attrs.secure, path: attrs.path });
}
