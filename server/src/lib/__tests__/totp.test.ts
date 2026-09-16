// Copyright 2025-2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Use is limited to qualifying small businesses. See LICENSE for terms.

/**
 * TOTP wrapper against the RFC 6238 test vectors.
 * Run: npx tsx --test src/lib/__tests__/totp.test.ts
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

process.env.JWT_SECRET ??= 'test'.repeat(16);
process.env.ENCRYPTION_KEY ??= 'unit-test-encryption-key-not-secret';
const {
  buildOtpauthUrl, decryptTotpSecret, encryptTotpSecret, generateTotpSecret, isReplay, normalizeTotpCode, verifyTotpCode,
} = require('../totp') as typeof import('../totp');

// RFC 6238 appendix B: ASCII seed "12345678901234567890" (SHA-1) in base32.
const RFC_SECRET = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ';

test('RFC 6238 vectors verify and report the step they were minted for', async () => {
  // T=59 → step 1 → 287082; T=1111111109 → step 37037036 → 081804
  const a = await verifyTotpCode({ secret: RFC_SECRET, code: '287082', nowMs: 59 * 1000 });
  assert.deepEqual(a, { valid: true, step: 1 });
  const b = await verifyTotpCode({ secret: RFC_SECRET, code: '081804', nowMs: 1111111109 * 1000 });
  assert.deepEqual(b, { valid: true, step: 37037036 });
});

test('a code from the previous or next step is accepted (clock skew), two steps away is not', async () => {
  // 287082 belongs to step 1 (T=30..59). Check it at T=60 (step 2) and T=29 (step 0).
  assert.equal((await verifyTotpCode({ secret: RFC_SECRET, code: '287082', nowMs: 60 * 1000 })).valid, true);
  assert.equal((await verifyTotpCode({ secret: RFC_SECRET, code: '287082', nowMs: 29 * 1000 })).valid, true);
  assert.equal((await verifyTotpCode({ secret: RFC_SECRET, code: '287082', nowMs: 120 * 1000 })).valid, false);
  // The reported step is the code's own step, not the current one.
  assert.equal((await verifyTotpCode({ secret: RFC_SECRET, code: '287082', nowMs: 60 * 1000 })).step, 1);
});

test('replay: a step at or below the last accepted one is refused', () => {
  assert.equal(isReplay(null, 5), false);
  assert.equal(isReplay(undefined, 5), false);
  assert.equal(isReplay(4, 5), false);
  assert.equal(isReplay(5, 5), true);
  assert.equal(isReplay(6, 5), true);
});

test('codes are normalised to six digits or rejected', async () => {
  assert.equal(normalizeTotpCode(' 287 082 '), '287082');
  assert.equal(normalizeTotpCode('28708'), null);
  assert.equal(normalizeTotpCode('2870821'), null);
  assert.equal(normalizeTotpCode('abcdef'), null);
  assert.equal((await verifyTotpCode({ secret: RFC_SECRET, code: 'nope', nowMs: 59 * 1000 })).valid, false);
});

test('secrets are base32, round-trip through encryption, and the otpauth URL carries issuer + label', () => {
  const s = generateTotpSecret();
  assert.match(s, /^[A-Z2-7]+=*$/);
  const enc = encryptTotpSecret(s);
  assert.notEqual(enc, s);
  assert.equal(decryptTotpSecret(enc), s);
  assert.equal(decryptTotpSecret(s), s, 'a legacy plaintext value is returned as-is');
  const url = buildOtpauthUrl({ issuer: 'Acme & Co', label: 'jane', secret: s });
  assert.match(url, /^otpauth:\/\/totp\//);
  assert.match(url, /issuer=Acme(%20|\+)%26(%20|\+)Co/);
  assert.match(url, /secret=/);
  assert.match(url, /^otpauth:\/\/totp\/Acme(%20|\+)%26(%20|\+)Co:jane\?/, 'label is issuer:username');
  // otplib omits digits/period when they are the defaults every app assumes (6, 30).
});
