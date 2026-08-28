// Copyright 2025-2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Use is limited to qualifying small businesses. See LICENSE for terms.

/**
 * Export unit number. Run: npx tsx --test src/lib/__tests__/exportUnit.test.ts
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseUnitParam, unitAccountNumber, withUnitColumn } from '../exportUnit';

const COLS = [
  { header: 'AccountNumber', key: 'acct', width: 18 },
  { header: 'AccountName', key: 'name', width: 40 },
];

test('a numeric unit parses, with column as the default mode', () => {
  assert.deepEqual(parseUnitParam({ unit: '3' }), { unit: '3', mode: 'column' });
  assert.deepEqual(parseUnitParam({ unit: ' 12 ', unitMode: 'prefix' }), { unit: '12', mode: 'prefix' });
  assert.deepEqual(parseUnitParam({ unit: '7', unitMode: 'suffix' }), { unit: '7', mode: 'suffix' });
});

test('an unrecognised mode falls back to column rather than rewriting numbers', () => {
  assert.deepEqual(parseUnitParam({ unit: '4', unitMode: 'append' }), { unit: '4', mode: 'column' });
});

test('anything but digits yields no unit, so the export is unchanged', () => {
  for (const unit of ['', '  ', 'A1', '1A', '1.5', '-1', '1234567890', undefined, 5 as unknown]) {
    assert.equal(parseUnitParam({ unit } as Record<string, unknown>), null, `expected null for ${String(unit)}`);
  }
});

test('prepend gives unit#-coa#, append gives coa#-unit#', () => {
  assert.equal(unitAccountNumber('1000', { unit: '3', mode: 'prefix' }), '3-1000');
  assert.equal(unitAccountNumber('1000', { unit: '3', mode: 'suffix' }), '1000-3');
});

test('column mode and no unit both leave the account number alone', () => {
  assert.equal(unitAccountNumber('1000', { unit: '3', mode: 'column' }), '1000');
  assert.equal(unitAccountNumber('1000', null), '1000');
});

test('an account with no number gets the unit alone, never a dangling separator', () => {
  assert.equal(unitAccountNumber('', { unit: '3', mode: 'prefix' }), '3');
  assert.equal(unitAccountNumber(null, { unit: '3', mode: 'suffix' }), '3');
});

test('the Unit column leads, and is absent entirely without a unit', () => {
  assert.deepEqual(withUnitColumn(COLS, null), COLS);
  const withUnit = withUnitColumn(COLS, { unit: '3', mode: 'column' });
  assert.equal(withUnit.length, 3);
  assert.deepEqual(withUnit[0], { header: 'Unit', key: 'unit', width: 8 });
  assert.equal(withUnit[1].header, 'AccountNumber');
});
