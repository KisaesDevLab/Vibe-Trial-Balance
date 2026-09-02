// Copyright 2025-2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Use is limited to qualifying small businesses. See LICENSE for terms.

/**
 * Tax auto-assign helpers: the firm-history stage (`taxCodeHistory`) and the
 * lexical shortlist that feeds the AI prompt (`taxCodeShortlist`).
 * Run: npx tsx --test src/lib/__tests__/taxCodeMatching.test.ts
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildHistoryBuckets,
  historyTokens,
  normalizeAccountName,
  rankHistoryMatches,
  tokenSetSimilarity,
} from '../taxCodeHistory';
import {
  codeStatement,
  selectCatalogForBatch,
  shortlistCodes,
  tokenizeForMatch,
} from '../taxCodeShortlist';

// ── Firm history ─────────────────────────────────────────────────────────────

test('normalizeAccountName folds numbering, punctuation, filler and plurals', () => {
  assert.equal(normalizeAccountName('Advertising'), 'advertising');
  assert.equal(normalizeAccountName('Advertising Expense'), 'advertising');
  assert.equal(normalizeAccountName('6100 · Advertising Exp.'), 'advertising');
  assert.equal(normalizeAccountName('6100-Advertising'), 'advertising');
  assert.equal(normalizeAccountName('6100.10 Advertising & Promotions'), 'advertising promotion');
  assert.equal(normalizeAccountName('Office Supplies'), 'office supply');
  assert.equal(normalizeAccountName('Other Expenses'), '');
  assert.equal(normalizeAccountName('Misc. General Account'), '');
  // Not a leading account number: a word that starts with a digit stays.
  assert.equal(normalizeAccountName('2nd Floor Rent'), '2nd floor rent');
  assert.deepEqual(historyTokens('Taxes & Licenses'), ['tax', 'license']);
});

test('tokenSetSimilarity is Dice over sets', () => {
  assert.equal(tokenSetSimilarity(['a', 'b'], ['a', 'b']), 1);
  assert.equal(tokenSetSimilarity(['a', 'b'], ['a', 'c']), 0.5);
  assert.equal(tokenSetSimilarity(['a'], ['b']), 0);
  assert.equal(tokenSetSimilarity([], ['b']), 0);
});

const HISTORY = buildHistoryBuckets([
  { account_name: 'Advertising', tax_code_id: 209, count: 6, client_ids: [1, 2, 3] },
  { account_name: 'Advertising Expense', tax_code_id: 209, count: 4, client_ids: [4, 5] },
  { account_name: '6100 Advertising Exp', tax_code_id: 209, count: 2, client_ids: [1] },
  { account_name: 'Advertising', tax_code_id: 212, count: 1, client_ids: [6] },
  { account_name: 'Interest Income', tax_code_id: 151, count: 9, client_ids: [1, 2, 3, 4] },
  { account_name: 'Interest Expense', tax_code_id: 206, count: 7, client_ids: [1, 2, 3] },
  { account_name: 'Other Expenses', tax_code_id: 212, count: 30, client_ids: [1, 2, 3, 4, 5, 6] },
]);

test('three spellings of one name fold into one bucket and vote together', () => {
  const m = rankHistoryMatches('6100 · Advertising & Promo', HISTORY, { minSimilarity: 0.5 });
  // "advertising promo" vs "advertising" is Dice 0.67 — allowed by the lowered floor here.
  assert.ok(m);
  assert.equal(m.taxCodeId, 209);
  assert.equal(m.count, 12);
  assert.equal(m.clientCount, 5);
  assert.equal(m.matchedName, 'advertising');

  const exact = rankHistoryMatches('Advertising Expenses', HISTORY)!;
  assert.equal(exact.taxCodeId, 209);
  assert.equal(exact.similarity, 1);
  // 1.0 × 5/(5+1)
  assert.equal(exact.confidence, 0.83);
});

test('the default floor keeps "Interest Income" away from "Interest Expense"', () => {
  // Filler strips "expense", so "Interest Expense" is just "interest" — Dice
  // with "interest income" is 0.67, below the 0.8 floor.
  const m = rankHistoryMatches('Interest Income', HISTORY)!;
  assert.equal(m.taxCodeId, 151);
  assert.equal(m.count, 9);
  const e = rankHistoryMatches('Interest Exp', HISTORY)!;
  assert.equal(e.taxCodeId, 206);
});

test('a name that is all filler never matches, and the catalog gate holds', () => {
  assert.equal(rankHistoryMatches('Other Expenses', HISTORY), null);
  assert.equal(rankHistoryMatches('Advertising', HISTORY, { allowedTaxCodeIds: new Set([999]) }), null);
  assert.equal(rankHistoryMatches('Advertising', HISTORY, { allowedTaxCodeIds: new Set([212]) })!.taxCodeId, 212);
});

test('one client, however many rows, tops out at half confidence', () => {
  const b = buildHistoryBuckets([{ account_name: 'Bank Charges', tax_code_id: 212, count: 40, client_ids: [7] }]);
  const m = rankHistoryMatches('Bank Charges', b)!;
  assert.equal(m.clientCount, 1);
  assert.equal(m.confidence, 0.5);
});

// ── Shortlist ────────────────────────────────────────────────────────────────

const CATALOG = [
  { id: 1, tax_code: '100', description: '1120S; L01a - Gross receipts' },
  { id: 2, tax_code: '201', description: '1120S; L08 - Salaries and wages' },
  { id: 3, tax_code: '202', description: '1120S; L09 - Repairs' },
  { id: 4, tax_code: '206', description: '1120S; L13 - Interest' },
  { id: 5, tax_code: '209', description: '1120S; L16 - Advertising' },
  { id: 6, tax_code: '212', description: '1120S; L20 - Other deductions' },
  { id: 7, tax_code: '151', description: 'Sch K; L04 - US interest income' },
  { id: 8, tax_code: '400', description: 'Sch L; L01 - Cash' },
  { id: 9, tax_code: '401', description: 'Sch L; L02a - Accounts receivable' },
  { id: 10, tax_code: '425', description: 'Sch L; L10a - Buildings other deprec assets' },
  { id: 11, tax_code: '426', description: 'Sch L; L10b - Less accumulated depreciation' },
  { id: 12, tax_code: '441', description: 'Sch L; L17 - Mortg notes bonds pay < 1 yr' },
  { id: 13, tax_code: '467', description: 'Sch L; L24 - Retained earnings - unappr' },
  { id: 14, tax_code: '484', description: 'Sch M-1; L03 - Officer life ins. premiums' },
  { id: 15, tax_code: '200', description: '1125-E; L01 - Compensation of officers' },
  { id: 16, tax_code: '88888', description: 'reporting only no mapping' },
];

const codesOf = (list: { tax_code: string }[]) => list.map((c) => c.tax_code);

test('tokenizeForMatch drops line references and folds the crosswalk abbreviations', () => {
  assert.deepEqual(tokenizeForMatch('Mortg notes bonds pay < 1 yr'), ['loan', 'payable']);
  assert.deepEqual(tokenizeForMatch('1065; L21 - Other deductions'), []);
  assert.deepEqual(tokenizeForMatch('Gross receipts or sales'), ['gross', 'sale']);
  assert.deepEqual(tokenizeForMatch('Buildings other deprec assets'), ['fixedasset', 'depreciation', 'asset']);
  assert.deepEqual(tokenizeForMatch('Salaries and wages'), ['wage']);
  assert.deepEqual(tokenizeForMatch('1120S; L08 - Salaries'), ['wage']);
  assert.deepEqual(tokenizeForMatch('Sch K income not on books'), ['income']);
});

test('codeStatement reads the crosswalk prefix', () => {
  assert.equal(codeStatement('Sch L; L01 - Cash'), 'bs');
  assert.equal(codeStatement('Sch M-1; L03 - Fines and penalties'), 'm');
  assert.equal(codeStatement('R/E Wrk; var - Dividend distributions'), 'm');
  assert.equal(codeStatement('1120S; L16 - Advertising'), 'pnl');
  assert.equal(codeStatement('Sch K; L04 - US interest income'), 'pnl');
  assert.equal(codeStatement('reporting only no mapping'), 'other');
});

test('shortlist ranks the obvious line first and respects the statement', () => {
  assert.equal(shortlistCodes({ account_name: 'Advertising & Marketing', category: 'expenses' }, CATALOG)[0].tax_code, '209');
  assert.equal(shortlistCodes({ account_name: 'Wages - Office Staff', category: 'expenses' }, CATALOG)[0].tax_code, '201');
  assert.equal(shortlistCodes({ account_name: 'Repairs and Maintenance', category: 'expenses' }, CATALOG)[0].tax_code, '202');
  assert.equal(shortlistCodes({ account_name: 'Notes Payable - Truck', category: 'liabilities' }, CATALOG)[0].tax_code, '441');
  assert.equal(shortlistCodes({ account_name: 'Accum. Depreciation - Equipment', category: 'assets' }, CATALOG)[0].tax_code, '426');
  assert.equal(shortlistCodes({ account_name: 'Retained Earnings', category: 'equity' }, CATALOG)[0].tax_code, '467');
  assert.equal(shortlistCodes({ account_name: 'Checking - First Bank', category: 'assets' }, CATALOG)[0].tax_code, '400');
  // An expense account named "Interest" prefers page-1 Interest (pnl) over
  // Sch K interest income only because the latter has an extra token; a
  // REVENUE account "Interest Income" lands on Sch K.
  assert.equal(shortlistCodes({ account_name: 'Interest Expense', category: 'expenses' }, CATALOG)[0].tax_code, '206');
  assert.equal(shortlistCodes({ account_name: 'Interest Income', category: 'revenue' }, CATALOG)[0].tax_code, '151');
});

test('shortlist is empty with no overlap and never longer than the limit', () => {
  assert.deepEqual(shortlistCodes({ account_name: 'Telephone', category: 'expenses' }, CATALOG), []);
  assert.ok(shortlistCodes({ account_name: 'Officer wages interest cash', category: 'expenses' }, CATALOG, 2).length <= 2);
});

test('selectCatalogForBatch sends everything under the cap, else hints plus the head', () => {
  const all = selectCatalogForBatch([{ account_name: 'Advertising', category: 'expenses' }], CATALOG, 100);
  assert.equal(all.length, CATALOG.length);

  const trimmed = selectCatalogForBatch(
    [
      { account_name: 'Retained Earnings', category: 'equity' },
      { account_name: 'Officer Life Insurance', category: 'expenses' },
    ],
    CATALOG,
    6,
    2,
  );
  const codes = codesOf(trimmed);
  // Both hinted codes survive even though they sit past the cap in catalog order…
  assert.ok(codes.includes('467'));
  assert.ok(codes.includes('484'));
  // …the head of the catalog fills the remaining slots, and catalog order is kept.
  assert.equal(codes[0], '100');
  assert.equal(trimmed.length, 6);
  const idx = trimmed.map((c) => CATALOG.findIndex((x) => x.id === c.id));
  assert.deepEqual(idx, [...idx].sort((a, b) => a - b));
});
