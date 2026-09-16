// Copyright 2025-2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Use is limited to qualifying small businesses. See LICENSE for terms.

/**
 * Trusted-browser tokens and the cookie plumbing around them.
 * Run: npx tsx --test src/lib/__tests__/trustedBrowser.test.ts
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildCookie, clearCookie, parseCookieHeader } from '../cookies';
import {
  TRUSTED_BROWSER_COOKIE,
  TRUSTED_BROWSER_TTL_MS,
  buildTrustedBrowserCookie,
  clearTrustedBrowserCookie,
  generateTrustedBrowserToken,
  hashTrustedBrowserToken,
  isTrustedBrowserRowValid,
} from '../trustedBrowser';

test('the raw token never equals what is stored, and the hash is stable', () => {
  const t = generateTrustedBrowserToken();
  assert.notEqual(t.raw, t.hash);
  assert.equal(t.hash.length, 64);
  assert.equal(hashTrustedBrowserToken(t.raw), t.hash);
  assert.notEqual(generateTrustedBrowserToken().raw, t.raw);
});

test('the cookie is httpOnly, site-wide, 30 days, and Secure only over https', () => {
  const c = buildTrustedBrowserCookie('abc', { secure: true });
  assert.match(c, new RegExp(`^${TRUSTED_BROWSER_COOKIE}=abc; `));
  assert.match(c, new RegExp(`Max-Age=${TRUSTED_BROWSER_TTL_MS / 1000}`));
  assert.match(c, /Path=\//);
  assert.match(c, /HttpOnly/);
  assert.match(c, /SameSite=Lax/);
  assert.match(c, /Secure/);
  assert.doesNotMatch(buildTrustedBrowserCookie('abc', { secure: false }), /Secure/);
  assert.match(clearTrustedBrowserCookie({ secure: false }), /Max-Age=0/);
});

test('round trip through the request Cookie header', () => {
  const set = buildCookie('x', 'a b=c', { maxAgeSec: 10, secure: false });
  const value = set.split(';')[0].split('=')[1];
  assert.deepEqual(parseCookieHeader(`foo=1; x=${value}; bar="q"`), { foo: '1', x: 'a b=c', bar: 'q' });
  assert.deepEqual(parseCookieHeader(undefined), {});
  assert.deepEqual(parseCookieHeader('junk'), {});
  assert.match(clearCookie('x', { secure: true }), /^x=; Max-Age=0; Path=\/; HttpOnly; SameSite=Lax; Secure$/);
});

test('row validity: revoked or expired rows never count', () => {
  const now = Date.parse('2026-09-15T12:00:00Z');
  assert.equal(isTrustedBrowserRowValid({ expires_at: '2026-10-01T00:00:00Z', revoked_at: null }, now), true);
  assert.equal(isTrustedBrowserRowValid({ expires_at: new Date(now + 1000), revoked_at: null }, now), true);
  assert.equal(isTrustedBrowserRowValid({ expires_at: '2026-09-01T00:00:00Z', revoked_at: null }, now), false);
  assert.equal(isTrustedBrowserRowValid({ expires_at: '2026-10-01T00:00:00Z', revoked_at: '2026-09-14T00:00:00Z' }, now), false);
});
