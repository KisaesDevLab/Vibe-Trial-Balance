// Copyright 2025-2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Use is limited to qualifying small businesses. See LICENSE for terms.

/**
 * Shared building blocks for transactional email (password reset, invites).
 * Kept separate from mailService so the transport layer stays free of copy.
 */

import { getPublicBaseUrl } from './publicUrl';

export function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));
}

/** Attribute values go through the same escaper — quotes and angle brackets
 *  are the only characters that can break out of an href. */
export const escapeAttr = escapeHtml;

/**
 * Absolute URL for a path in the SPA. The base comes from lib/publicUrl.ts:
 * the admin-set `app.public_url` setting, then APP_BASE_URL, then the first
 * ALLOWED_ORIGIN entry, then localhost for dev — the same value passkeys bind to.
 */
export function buildAppUrl(path: string): string {
  const base = getPublicBaseUrl();
  return `${base}${path.startsWith('/') ? path : `/${path}`}`;
}

/** Absolute URL carrying a one-shot token as a query param. */
export function buildTokenUrl(path: string, rawToken: string): string {
  return `${buildAppUrl(path)}?token=${encodeURIComponent(rawToken)}`;
}

/** Primary call-to-action button, inline-styled for mail clients. */
export function actionButton(label: string, link: string): string {
  return `
    <p>
      <a href="${escapeAttr(link)}" style="display:inline-block;background:#2563eb;color:#fff;padding:10px 18px;border-radius:6px;text-decoration:none;font-weight:500">
        ${escapeHtml(label)}
      </a>
    </p>`;
}

/** "Or paste this link…" fallback shown under the button. */
export function fallbackLink(link: string, validityNote: string): string {
  return `<p style="color:#555;font-size:13px">Or paste this link into your browser (${escapeHtml(validityNote)}):<br><span style="word-break:break-all">${escapeHtml(link)}</span></p>`;
}
