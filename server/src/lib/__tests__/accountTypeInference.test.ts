// Copyright 2025-2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Use is limited to qualifying small businesses. See LICENSE for terms.

/**
 * Account type inference for imported accounts — the guarantee under test is
 * that the preview and the confirm agree, which they do by both calling this.
 * Run: npx tsx --test src/lib/__tests__/accountTypeInference.test.ts
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { inferAccountType, fillNewAccountType } from '../accountTypeInference';

test('leading digit decides the type, for 4- and 5-digit numbers alike', () => {
  assert.deepEqual(inferAccountType('1010', 'Cash'), { category: 'assets', normalBalance: 'debit' });
  assert.deepEqual(inferAccountType('10100', 'Cash'), { category: 'assets', normalBalance: 'debit' });
  assert.deepEqual(inferAccountType('2100', 'Accounts Payable'), { category: 'liabilities', normalBalance: 'credit' });
  assert.deepEqual(inferAccountType('30000', 'Owner Equity'), { category: 'equity', normalBalance: 'credit' });
  assert.deepEqual(inferAccountType('4000', 'Sales'), { category: 'revenue', normalBalance: 'credit' });
  assert.deepEqual(inferAccountType('5000', 'COGS'), { category: 'expenses', normalBalance: 'debit' });
  assert.deepEqual(inferAccountType('6100', 'Rent'), { category: 'expenses', normalBalance: 'debit' });
  assert.deepEqual(inferAccountType('9999', 'Income Taxes'), { category: 'expenses', normalBalance: 'debit' });
});

test('the number wins over the name — a numbered "income" account in the 1s is an asset', () => {
  assert.equal(inferAccountType('1200', 'Interest Income Receivable').category, 'assets');
  assert.equal(inferAccountType('A-1200', 'Whatever').category, 'assets');
});

test('without a number the name decides; unknown names are expenses', () => {
  assert.equal(inferAccountType(null, 'Petty Cash').category, 'assets');
  assert.equal(inferAccountType('', 'Accounts Payable').category, 'liabilities');
  assert.equal(inferAccountType(null, 'Retained Earnings').category, 'equity');
  assert.equal(inferAccountType(null, 'Consulting Income').category, 'revenue');
  assert.equal(inferAccountType(null, 'Office Supplies').category, 'expenses');
  assert.equal(inferAccountType(null, null).category, 'expenses');
});

test('fillNewAccountType never overwrites a value already set', () => {
  const row = fillNewAccountType({ newCategory: 'expenses' as const }, '1010', 'Cash');
  assert.equal(row.newCategory, 'expenses');
  assert.equal(row.newNormalBalance, 'debit');

  const contra = fillNewAccountType({ newCategory: 'assets' as const, newNormalBalance: 'credit' as const }, '1510', 'Accum. Depreciation');
  assert.deepEqual(contra, { newCategory: 'assets', newNormalBalance: 'credit' });
});

test('fillNewAccountType prefers the extractor\'s detected category, but not garbage', () => {
  assert.equal(fillNewAccountType({ category: 'revenue' }, '1010', 'Cash').newCategory, 'revenue');
  assert.equal(fillNewAccountType({ category: 'Income' }, '1010', 'Cash').newCategory, 'assets');
  assert.equal(fillNewAccountType({}, '1010', 'Cash').newNormalBalance, 'debit');
});
