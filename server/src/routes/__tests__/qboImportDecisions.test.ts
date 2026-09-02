// Copyright 2025-2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Use is limited to qualifying small businesses. See LICENSE for terms.

/**
 * QuickBooks import confirm: decisions route rows, they never carry amounts.
 * Run: npx tsx --test src/routes/__tests__/qboImportDecisions.test.ts
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyDecisions, DecisionError, type ImportDecision } from '../../lib/qbo/decisions';
import type { MatchedRow } from '../../lib/qbo/matcher';

function matched(over: Partial<MatchedRow>): MatchedRow {
  return {
    rowKey: '0',
    qboAccountId: '35',
    qboName: 'Checking',
    qboFullName: 'Checking',
    qboAcctNum: '10100',
    classification: 'Asset',
    debitCents: 500000,
    creditCents: 0,
    action: 'match',
    matchType: 'qbo_id',
    matchedAccountId: 1,
    matchedAccountNumber: '10100',
    matchedAccountName: 'Cash',
    writeQboId: false,
    newAccountNumber: null,
    newAccountName: null,
    newCategory: null,
    newNormalBalance: null,
    exceptionReason: null,
    ...over,
  };
}

test('cents always come from the stored row, whatever the decision says', () => {
  const rows = [matched({ rowKey: '0', debitCents: 123, creditCents: 0 })];
  const decisions = [
    { rowKey: '0', action: 'match', matchedAccountId: 1, debitCents: 999999, creditCents: 5 } as unknown as ImportDecision,
  ];
  const [r] = applyDecisions(rows, decisions);
  assert.equal(r.debitCents, 123);
  assert.equal(r.creditCents, 0);
});

test('no decision: computed action stands; exceptions become skips', () => {
  const rows = [
    matched({ rowKey: '0' }),
    matched({ rowKey: '1', action: 'create_new', matchedAccountId: null, newAccountNumber: '48000', newAccountName: 'Interest', newCategory: 'revenue', newNormalBalance: 'credit' }),
    matched({ rowKey: '2', action: 'exception', matchedAccountId: null, exceptionReason: 'NO_ACCOUNT_ID', qboAccountId: null }),
  ];
  const out = applyDecisions(rows, []);
  assert.deepEqual(out.map((r) => r.action), ['match', 'create_new', 'skip']);
  assert.equal(out[0].matchedAccountId, 1);
  assert.equal(out[1].newAccountNumber, '48000');
  assert.equal(out[1].newCategory, 'revenue');
  assert.equal(out[1].newNormalBalance, 'credit');
});

test('a decision can re-route an exception to a hand-picked account or a new account', () => {
  const rows = [matched({ rowKey: '0', action: 'exception', matchedAccountId: null, exceptionReason: 'ACCT_NUM_BOUND_ELSEWHERE' })];
  const [m] = applyDecisions(rows, [{ rowKey: '0', action: 'match', matchedAccountId: 42 }]);
  assert.equal(m.action, 'match');
  assert.equal(m.matchedAccountId, 42);

  const [c] = applyDecisions(rows, [{ rowKey: '0', action: 'create_new', newAccountNumber: ' 10150 ', newAccountName: 'Petty Cash', newCategory: 'assets' }]);
  assert.equal(c.action, 'create_new');
  assert.equal(c.newAccountNumber, '10150');
  assert.equal(c.newAccountName, 'Petty Cash');
  assert.equal(c.newCategory, 'assets');
  assert.equal(c.newNormalBalance, 'debit');
});

test('create_new falls back to the row, then to a QB<Id> placeholder; bad category is ignored', () => {
  const rows = [matched({ rowKey: '3', action: 'create_new', matchedAccountId: null, qboAccountId: '77', newAccountNumber: null, newAccountName: null, newCategory: 'expenses', newNormalBalance: 'debit' })];
  const [c] = applyDecisions(rows, [{ rowKey: '3', action: 'create_new', newCategory: 'bogus', newNormalBalance: 'sideways' }]);
  assert.equal(c.newAccountNumber, 'QB77');
  assert.equal(c.newAccountName, 'Checking');
  assert.equal(c.newCategory, 'expenses');
  assert.equal(c.newNormalBalance, 'debit');
});

test('match with no account anywhere is a DecisionError', () => {
  const rows = [matched({ rowKey: '0', action: 'exception', matchedAccountId: null })];
  assert.throws(() => applyDecisions(rows, [{ rowKey: '0', action: 'match' }]), DecisionError);
  assert.throws(() => applyDecisions(rows, [{ rowKey: '0', action: 'match', matchedAccountId: 0 }]), DecisionError);
});

test('skip decision drops a computed match', () => {
  const [r] = applyDecisions([matched({ rowKey: '0' })], [{ rowKey: '0', action: 'skip' }]);
  assert.equal(r.action, 'skip');
  assert.equal(r.matchedAccountId, null);
});
