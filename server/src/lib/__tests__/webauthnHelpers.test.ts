// Copyright 2025-2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Use is limited to qualifying small businesses. See LICENSE for terms.

/**
 * The pure parts of lib/webauthn.ts (encoding, counter rule, user handle).
 * Run: npx tsx --test src/lib/__tests__/webauthnHelpers.test.ts
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

process.env.JWT_SECRET ??= 'test'.repeat(16);
const {
  counterCheck, fromBase64url, newChallengeId, parseTransports, serializeTransports, toBase64url, userIdHandle,
} = require('../webauthn') as typeof import('../webauthn');

test('public keys round-trip through base64url text', () => {
  const bytes = new Uint8Array([0, 1, 2, 250, 251, 252, 253, 254, 255]);
  const text = toBase64url(bytes);
  assert.doesNotMatch(text, /[+/=]/);
  assert.deepEqual(Array.from(fromBase64url(text)), Array.from(bytes));
});

test('transports survive storage and tolerate garbage', () => {
  assert.equal(serializeTransports(undefined), null);
  assert.equal(serializeTransports([]), null);
  assert.deepEqual(parseTransports(serializeTransports(['internal', 'hybrid'])), ['internal', 'hybrid']);
  assert.deepEqual(parseTransports(null), []);
  assert.deepEqual(parseTransports('not json'), []);
  assert.deepEqual(parseTransports('{"a":1}'), []);
  assert.deepEqual(parseTransports('[1,"usb"]'), ['usb']);
});

test('the counter must increase, except that synced passkeys legitimately stay at zero', () => {
  assert.equal(counterCheck(0, 0), 'ok');
  assert.equal(counterCheck(0, 1), 'ok');
  assert.equal(counterCheck(5, 6), 'ok');
  assert.equal(counterCheck(5, 5), 'regression');
  assert.equal(counterCheck(5, 2), 'regression');
  assert.equal(counterCheck(5, 0), 'regression');
});

test('the user handle is stable per id, opaque, and never the username', () => {
  const h = userIdHandle(42);
  assert.deepEqual(Array.from(h), Array.from(userIdHandle(42)));
  assert.notDeepEqual(Array.from(h), Array.from(userIdHandle(43)));
  assert.equal(new TextDecoder().decode(h), 'vtb-user-42');
});

test('challenge ids are random and URL-safe', () => {
  const a = newChallengeId();
  assert.notEqual(a, newChallengeId());
  assert.match(a, /^[A-Za-z0-9_-]{43}$/);
});
