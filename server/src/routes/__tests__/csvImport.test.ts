// Copyright 2025-2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Use is limited to qualifying small businesses. See LICENSE for terms.

/**
 * CSV import row parser — the guarantee under test is that NO line of the file
 * disappears between upload and preview. A row the user cannot see is a row the
 * user cannot tick back in, which is what made imports look like they silently
 * dropped accounts. Run: npx tsx --test src/routes/__tests__/csvImport.test.ts
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

// The route module reads auth config at import time, so the secret has to be
// in place first — hence require() rather than a hoisted import.
process.env.JWT_SECRET ??= 'test'.repeat(16);
const { parseAllRows } = require('../csvImport') as typeof import('../csvImport');

const COLUMNS = { accountNumber: 0, accountName: 1, debit: 2, credit: 3, amount: null };

/** A trial balance with every kind of line that is not an account. */
const MESSY = [
  'ACME Manufacturing LLC',                       // 0  report title
  'Trial Balance 12/31/2025',                     // 1  report subtitle
  'Acct,Name,Debit,Credit',                       // 2  header
  '',                                             // 3  blank
  'Income',                                       // 4  section heading
  '4010,Insurance Commission,97819.00,',          // 5  account
  '4020,Consulting Income,,12500.00',             // 6  account
  'Total Income,,97819.00,12500.00',              // 7  total, label in the number column
  ',Total Revenue,110319.00,',                    // 8  total, label in the name column
  '6010,Charitable Donations,3480.00,',           // 9  account
  'Totally Awesome Co,Prepaid,100.00,',           // 10 NOT a total
];

const rowsOf = (lines: string[], dataStartRow = 3, rowsToSkip: number[] = []) =>
  parseAllRows(lines, COLUMNS, ',', dataStartRow, 'separate_dr_cr', rowsToSkip);

test('every non-blank line reaches the preview', () => {
  const rows = rowsOf(MESSY, 3, [4]);
  const nonBlank = MESSY.filter((l) => l.trim()).length;
  assert.equal(rows.length, nonBlank);
  assert.deepEqual(rows.map((r) => r.csvRow), [0, 1, 2, 4, 5, 6, 7, 8, 9, 10]);
});

test('lines above dataStartRow and lines the model flagged come back skipped, not dropped', () => {
  const rows = rowsOf(MESSY, 3, [4]);
  const byLine = new Map(rows.map((r) => [r.csvRow, r]));
  for (const line of [0, 1, 2, 4]) assert.equal(byLine.get(line)!.action, 'skip', `line ${line}`);
});

test('a "Total" line is pre-skipped from whichever column carries the label', () => {
  const byLine = new Map(rowsOf(MESSY, 3, []).map((r) => [r.csvRow, r]));
  assert.equal(byLine.get(7)!.action, 'skip');  // "Total Income" in the number column
  assert.equal(byLine.get(8)!.action, 'skip');  // "Total Revenue" in the name column
});

test('a word merely starting with "total" is still an account', () => {
  const byLine = new Map(rowsOf(MESSY, 3, []).map((r) => [r.csvRow, r]));
  assert.equal(byLine.get(10)!.action, 'create_new');
});

test('real accounts are parsed to cents on the right side', () => {
  const byLine = new Map(rowsOf(MESSY, 3, []).map((r) => [r.csvRow, r]));
  assert.equal(byLine.get(5)!.action, 'create_new');
  assert.equal(byLine.get(5)!.debitCents, 9781900);
  assert.equal(byLine.get(5)!.creditCents, 0);
  assert.equal(byLine.get(6)!.creditCents, 1250000);
  assert.equal(byLine.get(6)!.debitCents, 0);
});

test('a skip index the model invented for an account still shows the account', () => {
  // The model can only see the head of the file; a wrong index must cost the
  // user a tick, never the row.
  const rows = rowsOf(MESSY, 3, [9]);
  const row = rows.find((r) => r.csvRow === 9)!;
  assert.equal(row.action, 'skip');
  assert.equal(row.csvAccountName, 'Charitable Donations');
  assert.equal(row.debitCents, 348000);
});
