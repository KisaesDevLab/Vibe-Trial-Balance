// Copyright 2025-2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Use is limited to qualifying small businesses. See LICENSE for terms.

/**
 * QuickBooks → COA matching. Deterministic, never by name.
 * Run: npx tsx --test src/lib/__tests__/qboMatcher.test.ts
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  classificationToCategory,
  findAbsentNonzeroAccounts,
  matchRows,
  placeholderAccountNumber,
  type CoaRowForMatch,
  type QboAccountLite,
} from '../qbo/matcher';
import type { QboReportRow } from '../qbo/reportParser';

function row(qboAccountId: string | null, name: string, debit = 0, credit = 0): QboReportRow {
  return { qboAccountId, name, debitCents: debit, creditCents: credit, path: [] };
}
function acct(Id: string, Name: string, AcctNum: string | null, Classification: string, extra: Partial<QboAccountLite> = {}): QboAccountLite {
  return { Id, Name, FullyQualifiedName: Name, AcctNum, Classification, AccountType: '', Active: true, ...extra };
}
const coa: CoaRowForMatch[] = [
  { id: 1, account_number: '10100', account_name: 'Cash - Operating', qbo_account_id: '35' },
  { id: 2, account_number: '20100', account_name: 'Accounts Payable', qbo_account_id: null },
  { id: 3, account_number: '60100', account_name: 'Utilities', qbo_account_id: '99' },
  { id: 4, account_number: '40100', account_name: 'Sales', qbo_account_id: null },
];

test('qbo_id wins even when AcctNum points at a different row', () => {
  const [m] = matchRows([row('35', 'Checking', 100)], coa, [acct('35', 'Checking', '20100', 'Asset')]);
  assert.equal(m.action, 'match');
  assert.equal(m.matchType, 'qbo_id');
  assert.equal(m.matchedAccountId, 1);
  assert.equal(m.writeQboId, false);
  assert.equal(m.debitCents, 100);
});

test('AcctNum match stamps the id on confirm (writeQboId)', () => {
  const [m] = matchRows([row('33', 'A/P', 0, 500)], coa, [acct('33', 'Accounts Payable (A/P)', '20100', 'Liability')]);
  assert.equal(m.action, 'match');
  assert.equal(m.matchType, 'acct_num');
  assert.equal(m.matchedAccountId, 2);
  assert.equal(m.writeQboId, true);
});

test('unknown account becomes create_new typed from Classification', () => {
  const [m] = matchRows([row('80', 'Interest Income', 0, 1234)], coa, [acct('80', 'Interest Income', '48000', 'Revenue')]);
  assert.equal(m.action, 'create_new');
  assert.equal(m.newAccountNumber, '48000');
  assert.equal(m.newAccountName, 'Interest Income');
  assert.equal(m.newCategory, 'revenue');
  assert.equal(m.newNormalBalance, 'credit');
});

test('no AcctNum → QB<Id> placeholder; unknown Classification → untyped', () => {
  const [m] = matchRows([row('81', 'Mystery', 5)], coa, [acct('81', 'Mystery', null, 'Weird')]);
  assert.equal(m.action, 'create_new');
  assert.equal(m.newAccountNumber, 'QB81');
  assert.equal(m.newCategory, null);
  assert.equal(placeholderAccountNumber('12/3 4'), 'QB1234');
});

test('AcctNum already bound to a different QBO account is an exception, never a silent re-bind', () => {
  const [m] = matchRows([row('70', 'Utilities', 10)], coa, [acct('70', 'Utilities', '60100', 'Expense')]);
  assert.equal(m.action, 'exception');
  assert.equal(m.exceptionReason, 'ACCT_NUM_BOUND_ELSEWHERE');
});

test('two QBO accounts claiming one COA row: the second is DUPLICATE_ACCT_NUM', () => {
  const rows = [row('50', 'Sales A', 0, 1), row('51', 'Sales B', 0, 2)];
  const accts = [acct('50', 'Sales A', '40100', 'Revenue'), acct('51', 'Sales B', '40100', 'Revenue')];
  const [a, b] = matchRows(rows, coa, accts);
  assert.equal(a.action, 'match');
  assert.equal(b.action, 'exception');
  assert.equal(b.exceptionReason, 'DUPLICATE_ACCT_NUM');
});

test('two new accounts with the same AcctNum: the second is DUPLICATE_ACCT_NUM', () => {
  const rows = [row('90', 'New A', 1), row('91', 'New B', 2)];
  const accts = [acct('90', 'New A', '70000', 'Expense'), acct('91', 'New B', '70000', 'Expense')];
  const [a, b] = matchRows(rows, coa, accts);
  assert.equal(a.action, 'create_new');
  assert.equal(b.exceptionReason, 'DUPLICATE_ACCT_NUM');
});

test('an id-less row is an exception even when a COA row has the identical name', () => {
  const [m] = matchRows([row(null, 'Sales', 0, 10)], coa, []);
  assert.equal(m.action, 'exception');
  assert.equal(m.exceptionReason, 'NO_ACCOUNT_ID');
  assert.equal(m.matchedAccountId, null);
});

test('name equality alone never matches', () => {
  const [m] = matchRows([row('500', 'Sales', 0, 10)], coa, [acct('500', 'Sales', null, 'Revenue')]);
  assert.equal(m.action, 'create_new');
  assert.equal(m.matchedAccountId, null);
});

test('classificationToCategory', () => {
  assert.deepEqual(classificationToCategory('Asset'), { category: 'assets', normalBalance: 'debit' });
  assert.deepEqual(classificationToCategory('liability'), { category: 'liabilities', normalBalance: 'credit' });
  assert.deepEqual(classificationToCategory('Expense'), { category: 'expenses', normalBalance: 'debit' });
  assert.equal(classificationToCategory(undefined), null);
});

test('findAbsentNonzeroAccounts: unmatched rows with a balance only', () => {
  const tb = [
    { account_id: 1, account_number: '10100', account_name: 'Cash', unadjusted_debit: '100', unadjusted_credit: '0' },
    { account_id: 2, account_number: '20100', account_name: 'A/P', unadjusted_debit: 0, unadjusted_credit: 0 },
    { account_id: 3, account_number: '60100', account_name: 'Utilities', unadjusted_debit: '0', unadjusted_credit: '250' },
  ];
  const absent = findAbsentNonzeroAccounts(tb, new Set([1]));
  assert.deepEqual(absent, [{ accountId: 3, accountNumber: '60100', accountName: 'Utilities', debitCents: 0, creditCents: 250 }]);
});
