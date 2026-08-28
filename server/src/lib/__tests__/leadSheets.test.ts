// Copyright 2025-2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Use is limited to qualifying small businesses. See LICENSE for terms.

/**
 * Lead sheet assignment + sign-off staleness.
 * Run: npx tsx --test src/lib/__tests__/leadSheets.test.ts
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_LEAD_SHEETS,
  suggestLeadSheet,
  leadSheetBalanceStamp,
  signoffStatus,
  type LeadSheetMatchInput,
  type StampRow,
} from '../leadSheets';

function acct(
  accountNumber: string,
  accountName: string,
  category: string,
  subcategory: string | null = null,
): LeadSheetMatchInput {
  return { accountNumber, accountName, category, subcategory };
}

const codeOf = (a: LeadSheetMatchInput): string | null => suggestLeadSheet(a)?.code ?? null;

// ── The real data ────────────────────────────────────────────────────────────
// Every row below is copied from server/seeds/004_comprehensive_demo.js or the
// system COA templates, so a regression here is a regression against a chart a
// user will actually load.

test('demo-seed accounts land on the right lead sheet', () => {
  const cases: Array<[LeadSheetMatchInput, string]> = [
    [acct('1000', 'Cash - Operating Checking', 'assets'), 'A'],
    [acct('1020', 'Petty Cash', 'assets'), 'A'],
    [acct('1100', 'Accounts Receivable', 'assets'), 'B'],
    [acct('10700', 'Inventory', 'assets'), 'C'],
    [acct('1500', 'Furniture & Equipment', 'assets'), 'D'],
    [acct('1550', 'Accum Depr - Furniture & Equip', 'assets'), 'D'],
    [acct('1300', 'Prepaid Insurance', 'assets'), 'E'],
    [acct('1600', 'Security Deposits', 'assets'), 'E'],
    [acct('2000', 'Accounts Payable', 'liabilities'), 'F'],
    [acct('2200', 'Accrued Wages', 'liabilities'), 'G'],
    [acct('2210', 'Accrued Payroll Taxes', 'liabilities'), 'G'],
    [acct('2100', 'Credit Card Payable', 'liabilities'), 'H'],
    [acct('2400', 'Current Portion - LTD', 'liabilities'), 'H'],
    [acct('2600', 'Vehicle Loan', 'liabilities'), 'H'],
    [acct('3200', 'Retained Earnings', 'equity'), 'J'],
    [acct('4000', 'Consulting Revenue', 'revenue'), 'K'],
    [acct('4500', 'Interest Income', 'revenue'), 'N'],
    [acct('4600', 'Other Income', 'revenue'), 'N'],
    [acct('5000', 'Contract Labor', 'expenses'), 'L'],
    [acct('5100', 'Project Materials', 'expenses'), 'L'],
    [acct('5200', 'Subcontractor Costs', 'expenses'), 'L'],
    [acct('6000', 'Salaries & Wages', 'expenses'), 'M'],
    [acct('6100', 'Rent Expense', 'expenses'), 'M'],
    [acct('6110', 'Utilities', 'expenses'), 'M'],
  ];
  for (const [input, expected] of cases) {
    assert.equal(codeOf(input), expected, `${input.accountNumber} ${input.accountName}`);
  }
});

// ── The traps ────────────────────────────────────────────────────────────────

test('"Other Expenses" as a subcategory does not drag an operating expense into O', () => {
  // Hundreds of system-template accounts carry this subcategory while being
  // ordinary deductible operating expenses. Reading subcategory in rule O would
  // sweep every one of them out of M.
  assert.equal(codeOf(acct('60200', 'Office Supplies', 'expenses', 'Other Expenses')), 'M');
  assert.equal(codeOf(acct('60400', 'Advertising', 'expenses', 'Other Expenses')), 'M');
});

test('"Other Expenses" inside a longer account name does not drag it into O either', () => {
  // Both of these are real rows in 20260321000005_replace_system_coa_templates.
  // Only the one actually NAMED "Other Expenses" belongs in O; an unanchored
  // /other expense/ test misfiles the Car & Truck row.
  assert.equal(codeOf(acct('60380', 'Car & Truck Other Expenses', 'expenses')), 'M');
  assert.equal(codeOf(acct('61700', 'Other Expenses', 'expenses')), 'O');
});

test('the accrual keywords are scoped to liabilities, so the expense twin stays in M', () => {
  assert.equal(codeOf(acct('2210', 'Accrued Payroll Taxes', 'liabilities')), 'G');
  assert.equal(codeOf(acct('6010', 'Payroll Taxes', 'expenses')), 'M');
});

test('depreciation is a fixed asset only on the asset side', () => {
  assert.equal(codeOf(acct('1550', 'Accumulated Depreciation', 'assets')), 'D');
  assert.equal(codeOf(acct('6700', 'Depreciation Expense', 'expenses')), 'M');
});

test('the account-number series is read as a leading digit, not a range', () => {
  // 4-digit and 5-digit charts must behave identically.
  assert.equal(codeOf(acct('5900', 'Widget Costs', 'expenses')), 'L');
  assert.equal(codeOf(acct('50900', 'Widget Costs', 'expenses')), 'L');
  assert.equal(codeOf(acct('8100', 'Sundry Receipts', 'revenue')), 'N');
  assert.equal(codeOf(acct('80100', 'Sundry Receipts', 'revenue')), 'N');
});

test('a series-only hit reports lower confidence than a name hit', () => {
  const byName = suggestLeadSheet(acct('5000', 'Cost of Goods Sold', 'expenses'));
  const bySeries = suggestLeadSheet(acct('5900', 'Widget Costs', 'expenses'));
  assert.equal(byName?.code, 'L');
  assert.equal(bySeries?.code, 'L');
  assert.ok(byName!.confidence > bySeries!.confidence);
});

test('a specific rule beats the catch-all in the same category', () => {
  // Both A and E match an asset; specificity, not array order, decides.
  assert.equal(codeOf(acct('1000', 'Cash', 'assets')), 'A');
  assert.equal(codeOf(acct('1999', 'Miscellaneous', 'assets')), 'E');
});

test('every category falls through to a catch-all rather than returning null', () => {
  assert.equal(codeOf(acct('1999', 'Zzz', 'assets')), 'E');
  assert.equal(codeOf(acct('2999', 'Zzz', 'liabilities')), 'I');
  assert.equal(codeOf(acct('3999', 'Zzz', 'equity')), 'J');
  assert.equal(codeOf(acct('4999', 'Zzz', 'revenue')), 'K');
  assert.equal(codeOf(acct('6999', 'Zzz', 'expenses')), 'M');
});

test('an unknown category yields no suggestion instead of a wrong one', () => {
  assert.equal(codeOf(acct('9999', 'Suspense', 'memo')), null);
});

test('missing and oddly-cased inputs do not throw', () => {
  assert.equal(codeOf(acct('', 'Cash', 'ASSETS')), 'A');
  assert.equal(codeOf(acct('  1000  ', 'CASH - OPERATING', 'assets')), 'A');
});

// ── The constant's own invariants ────────────────────────────────────────────

test('DEFAULT_LEAD_SHEETS is internally consistent', () => {
  const codes = DEFAULT_LEAD_SHEETS.map((d) => d.code);
  assert.equal(new Set(codes).size, codes.length, 'codes are unique');

  const specs = DEFAULT_LEAD_SHEETS.map((d) => d.specificity);
  assert.equal(new Set(specs).size, specs.length, 'specificity values are unique');

  // sortOrder is display order and must follow the letters A..O.
  const sorted = [...DEFAULT_LEAD_SHEETS].sort((a, b) => a.sortOrder - b.sortOrder);
  assert.deepEqual(sorted.map((d) => d.code), codes, 'sortOrder follows letter order');
  assert.deepEqual(codes, 'ABCDEFGHIJKLMNO'.split(''));
});

// ── Balance stamp ────────────────────────────────────────────────────────────

function row(account_id: number, unadjusted_debit = 0): StampRow {
  return {
    account_id,
    unadjusted_debit,
    unadjusted_credit: 0,
    prior_year_debit: 0,
    prior_year_credit: 0,
    trans_adj_debit: 0,
    trans_adj_credit: 0,
    book_adj_debit: 0,
    book_adj_credit: 0,
    tax_adj_debit: 0,
    tax_adj_credit: 0,
  };
}

test('the stamp is stable under row reordering', () => {
  const a = leadSheetBalanceStamp([row(1, 100), row(2, 200)]);
  const b = leadSheetBalanceStamp([row(2, 200), row(1, 100)]);
  assert.equal(a, b);
});

test('the stamp moves when an amount changes', () => {
  assert.notEqual(
    leadSheetBalanceStamp([row(1, 100)]),
    leadSheetBalanceStamp([row(1, 101)]),
  );
});

test('the stamp moves when membership changes', () => {
  // This is why account_id is part of each line — adding or removing an
  // account from the lead sheet has to invalidate a signature even when no
  // individual amount moved.
  assert.notEqual(
    leadSheetBalanceStamp([row(1, 100)]),
    leadSheetBalanceStamp([row(1, 100), row(2, 0)]),
  );
});

test('pg bigint strings and nulls hash the same as numbers', () => {
  const asNumbers = leadSheetBalanceStamp([row(1, 100)]);
  const asStrings = leadSheetBalanceStamp([{ ...row(1), unadjusted_debit: '100', tax_adj_credit: null }]);
  assert.equal(asNumbers, asStrings);
});

test('an empty lead sheet still produces a stable stamp', () => {
  assert.equal(leadSheetBalanceStamp([]), leadSheetBalanceStamp([]));
  assert.match(leadSheetBalanceStamp([]), /^[0-9a-f]{64}$/);
});

// ── Sign-off status ──────────────────────────────────────────────────────────

test('signoffStatus reports unsigned, signed and stale', () => {
  const stamp = leadSheetBalanceStamp([row(1, 100)]);
  const moved = leadSheetBalanceStamp([row(1, 200)]);
  assert.equal(signoffStatus(null, stamp), 'unsigned');
  assert.equal(signoffStatus(undefined, stamp), 'unsigned');
  assert.equal(signoffStatus({ balance_stamp: stamp }, stamp), 'signed');
  assert.equal(signoffStatus({ balance_stamp: stamp }, moved), 'stale');
});
