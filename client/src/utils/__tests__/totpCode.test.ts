// Copyright 2025-2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Use is limited to qualifying small businesses. See LICENSE for terms.

// Run with: npm run test:totpcode (from the repo root)

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatSecretForDisplay, isCompleteTotpCode, normalizeTotpCode } from '../totpCode';

test('typing and pasting are normalised to at most six digits', () => {
  assert.equal(normalizeTotpCode('12'), '12');
  assert.equal(normalizeTotpCode('123 456'), '123456');
  assert.equal(normalizeTotpCode('1234567'), '123456');
  assert.equal(normalizeTotpCode('ab12-34'), '1234');
  assert.equal(normalizeTotpCode(''), '');
});

test('only exactly six digits is a complete code', () => {
  assert.equal(isCompleteTotpCode('123456'), true);
  assert.equal(isCompleteTotpCode('12345'), false);
  assert.equal(isCompleteTotpCode('12345a'), false);
});

test('the manual key is grouped in fours and upper-cased', () => {
  assert.equal(formatSecretForDisplay('gezdgnbvgy3tqojq'), 'GEZD GNBV GY3T QOJQ');
  assert.equal(formatSecretForDisplay('ABCDE'), 'ABCD E');
  assert.equal(formatSecretForDisplay('ABC='), 'ABC');
});
