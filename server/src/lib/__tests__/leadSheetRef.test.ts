// Copyright 2025-2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Use is limited to qualifying small businesses. See LICENSE for terms.

/**
 * Lead sheet attachment ref codes.
 * Run: npx tsx --test src/lib/__tests__/leadSheetRef.test.ts
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { refPrefix, parseRefCode, nextRefCode } from '../leadSheetRef';

test('refPrefix uppercases and keeps letters only', () => {
  assert.equal(refPrefix('a'), 'A');
  assert.equal(refPrefix('B'), 'B');
  assert.equal(refPrefix('  c  '), 'C');
  assert.equal(refPrefix('A1'), 'A');
  assert.equal(refPrefix('AA'), 'AA');
});

test('refPrefix falls back to LS for an uncoded lead sheet', () => {
  assert.equal(refPrefix(null), 'LS');
  assert.equal(refPrefix(undefined), 'LS');
  assert.equal(refPrefix(''), 'LS');
  assert.equal(refPrefix('123'), 'LS');
});

test('parseRefCode splits prefix and sequence, rejecting junk', () => {
  assert.deepEqual(parseRefCode('A001'), { prefix: 'A', seq: 1 });
  assert.deepEqual(parseRefCode('LS042'), { prefix: 'LS', seq: 42 });
  assert.deepEqual(parseRefCode('a007'), { prefix: 'A', seq: 7 });
  assert.equal(parseRefCode('A'), null);
  assert.equal(parseRefCode('001'), null);
  assert.equal(parseRefCode('A-1'), null);
  assert.equal(parseRefCode(''), null);
});

test('the first attachment for a lead sheet is 001', () => {
  assert.equal(nextRefCode('A', []), 'A001');
  assert.equal(nextRefCode('B', []), 'B001');
  assert.equal(nextRefCode(null as unknown as string, []), 'LS001');
});

test('numbering continues within a prefix and is independent across prefixes', () => {
  assert.equal(nextRefCode('A', ['A001', 'A002']), 'A003');
  // B's sequence must not be pushed along by A's.
  assert.equal(nextRefCode('B', ['A001', 'A002', 'A003']), 'B001');
});

test('a deleted code is never reissued', () => {
  // The bug in the reference implementation: it reads only the most recent row
  // by created_at and parses its suffix, so deleting A003 when A002 was created
  // later hands out A003 again — colliding with a code that may already appear
  // in a printed binder. max+1 over all known codes avoids that.
  assert.equal(nextRefCode('A', ['A001', 'A002', 'A004']), 'A005');
  assert.equal(nextRefCode('A', ['A004', 'A001']), 'A005', 'order must not matter');
});

test('unrelated or malformed codes are ignored', () => {
  assert.equal(nextRefCode('A', ['B009', 'garbage', '', 'A002']), 'A003');
});

test('the sequence grows past 999 rather than wrapping into a collision', () => {
  assert.equal(nextRefCode('A', ['A999']), 'A1000');
});

test('lowercase stored codes still count', () => {
  assert.equal(nextRefCode('a', ['a001', 'A002']), 'A003');
});
