// Copyright 2025-2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Use is limited to qualifying small businesses. See LICENSE for terms.

/**
 * Public URL resolution + WebAuthn relying-party derivation.
 * Run: npx tsx --test src/lib/__tests__/publicUrl.test.ts
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_DEV_URL, deriveRelyingParty, resolvePublicBaseUrl } from '../publicUrl';

test('the settings row wins, then env, then the first plain ALLOWED_ORIGIN, then the dev default', () => {
  assert.deepEqual(
    resolvePublicBaseUrl({ setting: 'https://tb.firm.com/', appBaseUrl: 'https://env.example', allowedOrigin: 'https://o.example' }),
    { url: 'https://tb.firm.com', source: 'setting' },
  );
  assert.deepEqual(
    resolvePublicBaseUrl({ setting: '  ', appBaseUrl: 'https://env.example/', allowedOrigin: 'https://o.example' }),
    { url: 'https://env.example', source: 'env' },
  );
  assert.deepEqual(
    resolvePublicBaseUrl({ setting: null, appBaseUrl: '', allowedOrigin: 'https://o.example, https://two.example' }),
    { url: 'https://o.example', source: 'origin' },
  );
  assert.deepEqual(resolvePublicBaseUrl({}), { url: DEFAULT_DEV_URL, source: 'default' });
});

test('a regex ALLOWED_ORIGIN entry is not a URL and never becomes the base', () => {
  assert.deepEqual(
    resolvePublicBaseUrl({ allowedOrigin: '/^https:\\/\\/.*\\.firm\\.com$/' }),
    { url: DEFAULT_DEV_URL, source: 'default' },
  );
});

test('https hosts and http://localhost are valid relying parties', () => {
  assert.deepEqual(deriveRelyingParty('https://tb.firm.com'), { ok: true, rpID: 'tb.firm.com', origin: 'https://tb.firm.com' });
  assert.deepEqual(deriveRelyingParty('https://tb.firm.com:8443/tb'), { ok: true, rpID: 'tb.firm.com', origin: 'https://tb.firm.com:8443' });
  assert.deepEqual(deriveRelyingParty('http://localhost:5173'), { ok: true, rpID: 'localhost', origin: 'http://localhost:5173' });
});

test('http on a LAN address, IPs and junk are refused with a reason an operator can act on', () => {
  const lan = deriveRelyingParty('http://192.168.1.50');
  assert.equal(lan.ok, false);
  assert.match((lan as { reason: string }).reason, /require https/);
  const ip = deriveRelyingParty('https://10.0.0.5');
  assert.equal(ip.ok, false);
  assert.match((ip as { reason: string }).reason, /IP address/);
  assert.equal(deriveRelyingParty('not a url').ok, false);
  assert.equal(deriveRelyingParty('ftp://files.example').ok, false);
});
