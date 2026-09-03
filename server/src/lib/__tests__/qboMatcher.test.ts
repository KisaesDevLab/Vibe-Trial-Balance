// Copyright 2025-2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Use is limited to qualifying small businesses. See LICENSE for terms.

/**
 * QuickBooks → COA matching. Deterministic: id, number, then EXACT name only.
 * Run: npx tsx --test src/lib/__tests__/qboMatcher.test.ts
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  classificationToCategory,
  findAbsentNonzeroAccounts,
  matchRows,
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

test('no AcctNum → no number at all (never a QB placeholder); unknown Classification → untyped', () => {
  const [m] = matchRows([row('81', 'Mystery', 5)], coa, [acct('81', 'Mystery', null, 'Weird')]);
  assert.equal(m.action, 'create_new');
  assert.equal(m.newAccountNumber, null);
  assert.equal(m.newCategory, null);
});

test('an AcctNum held by an INACTIVE account is ACCT_NUM_INACTIVE, never a create_new that would hit the unique index', () => {
  const [m] = matchRows([row('90', 'Revived Thing', 5)], coa, [acct('90', 'Revived Thing', '7777', 'Expense')], { inactiveNumbers: new Set(['7777']) });
  assert.equal(m.action, 'exception');
  assert.equal(m.exceptionReason, 'ACCT_NUM_INACTIVE');
  // Without the option the same row is an ordinary create_new.
  const [n] = matchRows([row('90', 'Revived Thing', 5)], coa, [acct('90', 'Revived Thing', '7777', 'Expense')]);
  assert.equal(n.action, 'create_new');
  assert.equal(n.newAccountNumber, '7777');
});

test('two unnumbered QBO accounts are both create_new — a missing number is not a duplicate of another missing number', () => {
  const out = matchRows(
    [row('81', 'Mystery', 5), row('82', 'Enigma', 7)],
    coa,
    [acct('81', 'Mystery', null, 'Expense'), acct('82', 'Enigma', null, 'Expense')],
  );
  assert.deepEqual(out.map((m) => [m.action, m.newAccountNumber, m.exceptionReason]), [
    ['create_new', null, null],
    ['create_new', null, null],
  ]);
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

test('exact name matches when nothing stronger does, badged name, id stamped on confirm', () => {
  const [m] = matchRows([row('500', 'Sales', 0, 10)], coa, [acct('500', 'Sales', null, 'Revenue')]);
  assert.equal(m.action, 'match');
  assert.equal(m.matchType, 'name');
  assert.equal(m.matchedAccountId, 4);
  assert.equal(m.writeQboId, true);
  assert.equal(m.newAccountNumber, null);
});

test('name match ignores case and runs of whitespace', () => {
  const [m] = matchRows([row('500', 'accounts  PAYABLE', 0, 10)], coa, [acct('500', 'accounts  PAYABLE', null, 'Liability')]);
  assert.equal(m.matchType, 'name');
  assert.equal(m.matchedAccountId, 2);
});

test('sub-account leaf name matches when the full Parent:Child name does not', () => {
  const [m] = matchRows([row('500', 'Sales', 0, 10)], coa, [acct('500', 'Sales', null, 'Revenue', { FullyQualifiedName: 'Income:Sales' })]);
  assert.equal(m.matchType, 'name');
  assert.equal(m.matchedAccountId, 4);
  assert.equal(m.qboFullName, 'Income:Sales');
});

test('name match refuses a category contradiction', () => {
  const withCat = coa.map((c) => ({ ...c, category: c.id === 4 ? 'revenue' : 'assets' }));
  const [m] = matchRows([row('500', 'Sales', 10)], withCat, [acct('500', 'Sales', null, 'Expense')]);
  assert.equal(m.action, 'create_new');
  assert.equal(m.matchedAccountId, null);
});

test('name match is never ambiguous: two COA rows with one name match neither', () => {
  const twins = [...coa, { id: 5, account_number: '40200', account_name: 'sales', qbo_account_id: null }];
  const [m] = matchRows([row('500', 'Sales', 0, 10)], twins, [acct('500', 'Sales', null, 'Revenue')]);
  assert.equal(m.action, 'create_new');
});

test('name match skips a COA row bound to a different QBO account', () => {
  // COA 3 "Utilities" is bound to QBO 99; QBO 77 with the same name gets nothing.
  const [m] = matchRows([row('77', 'Utilities', 10)], coa, [acct('77', 'Utilities', null, 'Expense')]);
  assert.equal(m.action, 'create_new');
  assert.equal(m.matchedAccountId, null);
});

test('a name never steals a row that an AcctNum claims later in the report', () => {
  const rows = [row('500', 'Accounts Payable', 0, 10), row('501', 'Trade Payables', 0, 20)];
  const accts = [acct('500', 'Accounts Payable', null, 'Liability'), acct('501', 'Trade Payables', '20100', 'Liability')];
  const [byName, byNum] = matchRows(rows, coa, accts);
  assert.equal(byNum.matchType, 'acct_num');
  assert.equal(byNum.matchedAccountId, 2);
  assert.equal(byName.action, 'create_new');
});

test('two QBO accounts with one name: the first takes the COA row, the second is created', () => {
  const rows = [row('500', 'Sales', 0, 10), row('501', 'Sales', 0, 20)];
  const accts = [acct('500', 'Sales', null, 'Revenue', { FullyQualifiedName: 'Retail:Sales' }), acct('501', 'Sales', null, 'Revenue', { FullyQualifiedName: 'Online:Sales' })];
  const [a, b] = matchRows(rows, coa, accts);
  assert.equal(a.matchType, 'name');
  assert.equal(b.action, 'create_new');
  assert.equal(b.exceptionReason, null);
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

test('qbo_name: the QuickBooks name a CSV import recorded places the row before the COA-name pass', () => {
  const rows: CoaRowForMatch[] = [
    // Numbered like the export writes it; QBO's API name has no numbers and no AcctNum.
    { id: 10, account_number: '6045', account_name: 'Overdraft Fees', qbo_account_id: null, category: 'expenses', qbo_account_name: '60400 Bank Service Charges:60450 Overdraft Fees' },
    // A COA row whose OWN name equals the QBO name — the recorded QBO name must win over it.
    { id: 11, account_number: '6070', account_name: 'Bank Service Charges:Overdraft Fees', qbo_account_id: null, category: 'expenses', qbo_account_name: null },
  ];
  const [m] = matchRows(
    [row('91', 'Overdraft Fees', 350)],
    rows,
    [acct('91', 'Overdraft Fees', null, 'Expense', { FullyQualifiedName: 'Bank Service Charges:Overdraft Fees' })],
  );
  assert.equal(m.action, 'match');
  assert.equal(m.matchType, 'qbo_name');
  assert.equal(m.matchedAccountId, 10);
  assert.equal(m.writeQboId, true);
});

test('qbo_name: refused when two COA rows recorded the same QBO name, when the type contradicts, or when the row is bound elsewhere', () => {
  const twice: CoaRowForMatch[] = [
    { id: 1, account_number: '2710', account_name: 'Due To/From Tolson', qbo_account_id: null, qbo_account_name: '160000 Due to Tolson Drug' },
    { id: 2, account_number: '1600', account_name: 'Due to Tolson Drug', qbo_account_id: null, qbo_account_name: '160000 Due to Tolson Drug' },
  ];
  const [dup] = matchRows([row('72', 'Due to Tolson Drug', 5)], twice, [acct('72', 'Due to Tolson Drug', null, 'Asset')]);
  // Falls through to the COA-name pass, which finds exactly one row with that name.
  assert.equal(dup.matchType, 'name');
  assert.equal(dup.matchedAccountId, 2);

  const wrongType: CoaRowForMatch[] = [{ id: 3, account_number: '4100', account_name: 'Rent', qbo_account_id: null, category: 'revenue', qbo_account_name: '63300 Insurance Expense' }];
  const [t] = matchRows([row('43', 'Insurance Expense', 5)], wrongType, [acct('43', 'Insurance Expense', null, 'Expense')]);
  assert.equal(t.action, 'create_new');

  const bound: CoaRowForMatch[] = [{ id: 4, account_number: '6330', account_name: 'Insurance', qbo_account_id: '999', qbo_account_name: 'Insurance Expense' }];
  const [b] = matchRows([row('43', 'Insurance Expense', 5)], bound, [acct('43', 'Insurance Expense', null, 'Expense')]);
  assert.equal(b.action, 'create_new');
});
