// Copyright 2025-2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Use is limited to qualifying small businesses. See LICENSE for terms.

/**
 * QuickBooks TrialBalance report parser.
 * Run: npx tsx --test src/lib/__tests__/qboReportParser.test.ts
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  extractSummaryTotals,
  flattenTrialBalanceRows,
  parseMoneyCents,
  parseReportHeader,
  validateTotals,
} from '../qbo/reportParser';

const COLUMNS = {
  Column: [
    { ColTitle: '', ColType: 'Account' },
    { ColTitle: 'Debit', ColType: 'Money' },
    { ColTitle: 'Credit', ColType: 'Money' },
  ],
};

/** Fixture A: flat rows + a nested section whose sub-account row has no id. */
const FIXTURE_A = {
  Header: { ReportName: 'TrialBalance', ReportBasis: 'Accrual', StartPeriod: '2025-01-01', EndPeriod: '2025-12-31', Currency: 'USD', Time: '2026-01-05T10:00:00-08:00' },
  Columns: COLUMNS,
  Rows: {
    Row: [
      { type: 'Data', ColData: [{ value: 'Checking', id: '35' }, { value: '5000.00' }, { value: '' }] },
      { type: 'Data', ColData: [{ value: 'Accounts Payable (A/P)', id: '33' }, { value: '' }, { value: '1,201.00' }] },
      {
        type: 'Section',
        Header: { ColData: [{ value: 'Utilities', id: '70' }, { value: '' }, { value: '' }] },
        Rows: {
          Row: [
            { type: 'Data', ColData: [{ value: 'Gas and Electric' }, { value: '1,201.00' }, { value: '' }] },
            { type: 'Data', ColData: [{ value: 'Telephone', id: '72' }, { value: '' }, { value: '5000.00' }] },
          ],
        },
        Summary: { ColData: [{ value: 'Total Utilities' }, { value: '1201.00' }, { value: '5000.00' }] },
      },
      { group: 'GrandTotal', Summary: { ColData: [{ value: 'TOTAL' }, { value: '6201.00' }, { value: '6,201.00' }] } },
    ],
  },
};

test('parseMoneyCents: string arithmetic, never floats', () => {
  assert.equal(parseMoneyCents(''), 0);
  assert.equal(parseMoneyCents(undefined), 0);
  assert.equal(parseMoneyCents('1,234.56'), 123456);
  assert.equal(parseMoneyCents('-45.10'), -4510);
  assert.equal(parseMoneyCents('(45.10)'), -4510);
  assert.equal(parseMoneyCents('0.1'), 10);
  assert.equal(parseMoneyCents('7'), 700);
  assert.equal(parseMoneyCents('0.07'), 7);
  assert.throws(() => parseMoneyCents('N/A'));
  assert.throws(() => parseMoneyCents('1.2.3'));
});

test('flatten: Data rows in document order, sections never become accounts, id-less row keeps null', () => {
  const rows = flattenTrialBalanceRows(FIXTURE_A);
  assert.deepEqual(
    rows.map((r) => [r.qboAccountId, r.name, r.debitCents, r.creditCents, r.path.join('>')]),
    [
      ['35', 'Checking', 500000, 0, ''],
      ['33', 'Accounts Payable (A/P)', 0, 120100, ''],
      [null, 'Gas and Electric', 120100, 0, 'Utilities'],
      ['72', 'Telephone', 0, 500000, 'Utilities'],
    ],
  );
});

test('header + summary + totals for a balanced report', () => {
  const header = parseReportHeader(FIXTURE_A);
  assert.equal(header.reportBasis, 'Accrual');
  assert.equal(header.startPeriod, '2025-01-01');
  assert.equal(header.endPeriod, '2025-12-31');
  assert.equal(header.noReportData, false);

  const summary = extractSummaryTotals(FIXTURE_A);
  assert.deepEqual(summary, { debitCents: 620100, creditCents: 620100 });

  const v = validateTotals(flattenTrialBalanceRows(FIXTURE_A), summary);
  assert.equal(v.balanced, true);
  assert.equal(v.summaryMatches, true);
  assert.equal(v.summaryMissing, false);
  assert.equal(v.imbalanceCents, 0);
});

test('fixture B: an unbalanced report is reported, not hidden', () => {
  const b = {
    Columns: COLUMNS,
    Rows: {
      Row: [
        { type: 'Data', ColData: [{ value: 'Checking', id: '35' }, { value: '100.00' }, { value: '' }] },
        { type: 'Data', ColData: [{ value: 'Sales', id: '40' }, { value: '' }, { value: '99.50' }] },
        { group: 'GrandTotal', Summary: { ColData: [{ value: 'TOTAL' }, { value: '100.00' }, { value: '99.50' }] } },
      ],
    },
  };
  const v = validateTotals(flattenTrialBalanceRows(b), extractSummaryTotals(b));
  assert.equal(v.balanced, false);
  assert.equal(v.imbalanceCents, 50);
  assert.equal(v.summaryMatches, true);
});

test('fixture C: summary that disagrees with the rows flags a parse mismatch', () => {
  const c = {
    Columns: COLUMNS,
    Rows: {
      Row: [
        { type: 'Data', ColData: [{ value: 'Checking', id: '35' }, { value: '100.00' }, { value: '' }] },
        { type: 'Data', ColData: [{ value: 'Sales', id: '40' }, { value: '' }, { value: '100.00' }] },
        { group: 'GrandTotal', Summary: { ColData: [{ value: 'TOTAL' }, { value: '250.00' }, { value: '250.00' }] } },
      ],
    },
  };
  const v = validateTotals(flattenTrialBalanceRows(c), extractSummaryTotals(c));
  assert.equal(v.balanced, true);
  assert.equal(v.summaryMatches, false);
});

test('missing summary is tolerated and reported', () => {
  const d = { Columns: COLUMNS, Rows: { Row: [{ type: 'Data', ColData: [{ value: 'X', id: '1' }, { value: '1.00' }, { value: '1.00' }] }] } };
  assert.equal(extractSummaryTotals(d), null);
  const v = validateTotals(flattenTrialBalanceRows(d), null);
  assert.equal(v.summaryMissing, true);
  assert.equal(v.summaryMatches, true);
});

test('NoReportData → no rows', () => {
  const empty = { Header: { Option: [{ Name: 'NoReportData', Value: 'true' }] }, Columns: COLUMNS, Rows: {} };
  assert.equal(parseReportHeader(empty).noReportData, true);
  assert.deepEqual(flattenTrialBalanceRows(empty), []);
});

test('columns are located by title, not position', () => {
  const swapped = {
    Columns: { Column: [{ ColTitle: '' }, { ColTitle: 'Credit' }, { ColTitle: 'Debit' }] },
    Rows: { Row: [{ type: 'Data', ColData: [{ value: 'X', id: '1' }, { value: '2.00' }, { value: '3.00' }] }] },
  };
  const [row] = flattenTrialBalanceRows(swapped);
  assert.equal(row.debitCents, 300);
  assert.equal(row.creditCents, 200);
});
