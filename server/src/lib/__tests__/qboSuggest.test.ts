// Copyright 2025-2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Use is limited to qualifying small businesses. See LICENSE for terms.

/**
 * The AI match-suggestion pass: what goes out and what is allowed back in.
 * Run: npx tsx --test src/lib/__tests__/qboSuggest.test.ts
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildSuggestPrompt, sanitizeSuggestions, type SuggestCandidate } from '../qbo/suggest';
import type { MatchedRow } from '../qbo/matcher';

function unresolved(rowKey: string, qboFullName: string, classification: string | null): MatchedRow {
  return {
    rowKey, qboAccountId: `q${rowKey}`, qboName: qboFullName, qboFullName, qboAcctNum: null, classification,
    debitCents: 12345, creditCents: 0, action: 'create_new', matchType: null, matchedAccountId: null,
    matchedAccountNumber: null, matchedAccountName: null, writeQboId: false,
    newAccountNumber: `QBq${rowKey}`, newAccountName: qboFullName, newCategory: null, newNormalBalance: null, exceptionReason: null,
  };
}
const rows = [unresolved('3', 'Bank Service Charges', 'Expense'), unresolved('4', 'Checking', 'Asset'), unresolved('5', 'Owner Draw', 'Equity')];
const candidates: SuggestCandidate[] = [
  { id: 11, account_number: '60100', account_name: 'Bank Charges', category: 'expenses' },
  { id: 12, account_number: '10100', account_name: 'Cash - Operating', category: 'assets' },
  { id: 13, account_number: '30200', account_name: 'Distributions', category: 'equity' },
];

test('prompt carries names, classifications and candidate ordinals — never amounts or database ids', () => {
  const p = buildSuggestPrompt(rows, candidates);
  assert.match(p, /3\|Bank Service Charges\|Expense/);
  assert.match(p, /1\|60100\|Bank Charges\|expenses/);
  assert.doesNotMatch(p, /12345/);
  assert.doesNotMatch(p, /\b11\|60100/);
});

test('valid reply maps ordinals back to accounts in row order', () => {
  const out = sanitizeSuggestions(
    [{ key: '4', candidate: 2, confidence: 'high' }, { key: '3', candidate: 1, confidence: 'medium' }, { key: '5', candidate: null, confidence: 'low' }],
    rows, candidates,
  );
  assert.deepEqual(out.map((s) => [s.rowKey, s.accountId, s.confidence]), [['3', 11, 'medium'], ['4', 12, 'high']]);
  assert.equal(out[0].accountNumber, '60100');
});

test('an ordinal that was not offered, an unknown key and a non-array are all dropped', () => {
  assert.deepEqual(sanitizeSuggestions([{ key: '3', candidate: 9, confidence: 'high' }], rows, candidates), []);
  assert.deepEqual(sanitizeSuggestions([{ key: '99', candidate: 1, confidence: 'high' }], rows, candidates), []);
  assert.deepEqual(sanitizeSuggestions({ key: '3', candidate: 1 }, rows, candidates), []);
});

test('a category contradiction is dropped even at high confidence', () => {
  // Owner Draw (Equity) → Bank Charges (expenses)
  assert.deepEqual(sanitizeSuggestions([{ key: '5', candidate: 1, confidence: 'high' }], rows, candidates), []);
});

test('one candidate claimed twice keeps the better claim only', () => {
  const more = [...rows, unresolved('6', 'Service Fees', 'Expense')];
  const out = sanitizeSuggestions(
    [{ key: '3', candidate: 1, confidence: 'low' }, { key: '6', candidate: 1, confidence: 'high' }],
    more,
    candidates,
  );
  assert.deepEqual(out.map((s) => [s.rowKey, s.confidence]), [['6', 'high']]);
});

test('unknown confidence reads as low; numeric keys are accepted', () => {
  const out = sanitizeSuggestions([{ key: 4, candidate: '2', confidence: 'certain' }], rows, candidates);
  assert.deepEqual(out.map((s) => [s.rowKey, s.confidence]), [['4', 'low']]);
});
