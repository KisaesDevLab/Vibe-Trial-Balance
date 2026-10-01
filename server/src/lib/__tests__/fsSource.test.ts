// Copyright 2025-2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Use is limited to qualifying small businesses. See LICENSE for terms.

/**
 * The Statement Writer's source loader (pure half) and its stamps.
 * Run: npx tsx --test src/lib/__tests__/fsSource.test.ts
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildFsSource, defaultEquityRole, type FsSourceInput, type FsTbRow } from '../fs/fsSource';
import { canonicalJson, fsNumbersHash, fsSourceStamp } from '../fs/fsStamp';
import { buildDefaultLayout, computeFsReport, FS_DEFAULT_STYLE, type FsReportSettings } from '../fs/engine';

interface RowOpts {
  ls?: number | null; cf?: string | null;
  /** book-adjusted, prior year, tax AJE — signed cents, + = debit */
  book?: number; py?: number; taxAdj?: number;
}
let nextId = 1;
function row(number: string, name: string, category: string, o: RowOpts = {}): FsTbRow {
  const split = (v: number) => (v >= 0 ? [v, 0] : [0, -v]);
  const [bd, bc] = split(o.book ?? 0);
  const [pd, pc] = split(o.py ?? 0);
  const [td, tc] = split(o.taxAdj ?? 0);
  return {
    account_id: nextId++, account_number: number, account_name: name, category,
    lead_sheet_id: o.ls ?? null, cash_flow_category: o.cf ?? null,
    prior_year_debit: pd, prior_year_credit: pc,
    // Strings, as pg returns BIGINT.
    unadjusted_debit: String(bd), unadjusted_credit: String(bc),
    trans_adj_debit: 0, trans_adj_credit: 0, book_adj_debit: 0, book_adj_credit: 0,
    tax_adj_debit: td, tax_adj_credit: tc,
    book_adjusted_debit: String(bd), book_adjusted_credit: String(bc),
    tax_adjusted_debit: String(bd + td), tax_adjusted_credit: String(bc + tc),
  };
}

const LS = (id: number, code: string, name: string) => ({ id, code, name, sort_order: id });
// The seeded A–O set; ids follow the letters (A = 1 … O = 15).
const LEAD_SHEETS = ['Cash', 'Accounts Receivable', 'Inventory', 'Fixed Assets', 'Other Assets', 'Accounts Payable', 'Accrued Liabilities',
  'Debt', 'Other Liabilities', 'Equity', 'Revenue', 'Cost of Goods Sold', 'Operating Expenses', 'Other Income', 'Other Expenses']
  .map((name, i) => LS(i + 1, String.fromCharCode(65 + i), name));

function fixture() {
  nextId = 1;
  const rows = [
    row('1000', 'Checking', 'assets', { ls: 1, book: 500000, py: 300000 }),                    // 1
    row('1500', 'Equipment', 'assets', { ls: 4, book: 1000000, py: 1000000 }),                  // 2
    row('1510', 'Accumulated Depreciation', 'assets', { ls: 4, book: -300000, py: -200000, taxAdj: -50000 }), // 3
    row('2000', 'Accounts Payable', 'liabilities', { ls: 6, book: -100000, py: -150000 }),      // 4
    row('3000', 'Common Stock', 'equity', { ls: 10, book: -100000, py: -100000 }),              // 5
    row('3100', 'Retained Earnings', 'equity', { ls: 10, book: -850000, py: -600000 }),         // 6
    row('4000', 'Sales', 'revenue', { ls: 11, book: -900000, py: -800000 }),                    // 7
    row('6000', 'Rent', 'expenses', { ls: 13, book: 650000, py: 550000 }),                      // 8
    row('6100', 'Depreciation', 'expenses', { ls: 13, book: 100000, py: 0, taxAdj: 50000 }),    // 9
    row('6900', 'Never Used', 'expenses', { ls: 13 }),                                          // 10 — dormant
  ];
  const input: FsSourceInput = {
    clientName: 'Acme LLC', entityType: '1120S', settings: { framework: 'gaap' },
    periodStart: '2025-01-01', periodEnd: '2025-12-31', priorPeriod: null,
    rows, leadSheets: LEAD_SHEETS, equityRoles: [], cashFlowOverrides: [],
  };
  return { rows, input };
}

const SETTINGS: FsReportSettings = { framework: 'gaap', columns: { mode: 'single', pctOfRevenue: false, varianceAmt: false, variancePct: false } };

test('balances are signed cents (debit positive) read from the BIGINT strings', () => {
  const s = buildFsSource(fixture().input);
  const cy = s.snapshots['2025-12-31']!;
  assert.equal(cy.balances['1'], 500000);
  assert.equal(cy.balances['3'], -300000);
  assert.equal(cy.balances['7'], -900000);
  assert.equal(Object.values(cy.balances).reduce((a, b) => a + b, 0), 0, 'the fixture balances');
  assert.equal(s.snapshots['2024-12-31']!.balances['1'], 300000);
});

test('categories map to account types; signing never reads normal_balance', () => {
  const s = buildFsSource(fixture().input);
  const type = (id: string) => s.accounts.find((a) => a.id === id)!.accountType;
  assert.equal(type('1'), 'asset');
  assert.equal(type('3'), 'asset', 'a contra asset is still an asset');
  assert.equal(type('4'), 'liability');
  assert.equal(type('8'), 'expense');
});

test('a dormant account is left out of accounts and lead sheets', () => {
  const s = buildFsSource(fixture().input);
  assert.equal(s.accounts.find((a) => a.name === 'Never Used'), undefined);
  assert.ok(!s.groupings.find((g) => g.code === 'M')!.accountIds.includes('10'));
});

test('the prior year ends the day before the period starts; no prior period means no opening snapshot', () => {
  const s = buildFsSource(fixture().input);
  assert.equal(s.priorEnd, '2024-12-31');
  assert.equal(s.priorStart, '2024-01-01');
  assert.deepEqual(Object.keys(s.snapshots).sort(), ['2024-12-31', '2025-12-31']);
});

test('a first-year client keeps an EMPTY prior snapshot, which is a known zero opening', () => {
  const { input } = fixture();
  for (const r of input.rows) { r.prior_year_debit = 0; r.prior_year_credit = 0; }
  const s = buildFsSource(input);
  assert.ok(Object.prototype.hasOwnProperty.call(s.snapshots, '2024-12-31'));
  assert.equal(s.snapshots['2024-12-31']!.hasData, false);
});

test('with the prior period in the app: its dates, its opening, and its tax AJEs', () => {
  const { input, rows } = fixture();
  // The prior period's own rows: prior_year_* there is the opening of the prior year.
  const priorRows: FsTbRow[] = rows.map((r) => ({
    ...r, prior_year_debit: r.account_id === 1 ? 120000 : 0, prior_year_credit: r.account_id === 6 ? 120000 : 0,
    tax_adj_debit: r.account_id === 9 ? 20000 : 0, tax_adj_credit: r.account_id === 3 ? 20000 : 0,
  }));
  const s = buildFsSource({ ...input, settings: { framework: 'tax' }, priorPeriod: { startDate: '2024-04-01', rows: priorRows } });
  assert.equal(s.priorStart, '2024-04-01', 'a short prior year keeps its own start');
  assert.equal(s.snapshots['2024-03-31']!.balances['1'], 120000);
  // Prior-year tax = the stored prior-year (book) balance + the prior period's tax AJEs.
  assert.equal(s.snapshots['2024-12-31']!.taxBalances!['3'], -200000 - 20000);
  assert.equal(s.snapshots['2024-12-31']!.taxBalances!['9'], 20000);
  // This year's tax column comes straight from tax_adjusted_*.
  assert.equal(s.snapshots['2025-12-31']!.taxBalances!['3'], -350000);
  assert.equal(s.taxPriorIsBook, undefined);
  assert.equal(buildFsSource({ ...input, settings: { framework: 'tax' } }).taxPriorIsBook, true);
});

test('an account dormant now but open at the start of the prior year is kept', () => {
  const { input, rows } = fixture();
  const priorRows = rows.map((r) => ({ ...r, prior_year_debit: r.account_id === 10 ? 5000 : 0, prior_year_credit: 0 }));
  const s = buildFsSource({ ...input, priorPeriod: { startDate: '2024-01-01', rows: priorRows } });
  assert.ok(s.accounts.find((a) => a.id === '10'));
});

test('equity roles: a stored row beats the name, and the fold is the chosen account', () => {
  const { input } = fixture();
  let s = buildFsSource(input);
  assert.equal(s.equityRoles['5'], 'contributions');
  assert.equal(s.equityRoles['6'], 'retained');
  assert.equal(s.reAccountId, '6', 'the lowest-numbered retained-earnings account');
  s = buildFsSource({ ...input, equityRoles: [{ account_id: 5, role: 'retained', is_fold: true }] });
  assert.equal(s.equityRoles['5'], 'retained');
  assert.equal(s.reAccountId, '5');
  // No retained-earnings account at all → the virtual one.
  const none = fixture().input;
  none.rows.find((r) => r.account_id === 6)!.account_name = 'Opening Balance';
  assert.equal(buildFsSource(none).reAccountId, '-1');
});

test('default equity roles read the account name', () => {
  assert.equal(defaultEquityRole('Shareholder Distributions'), 'distributions');
  assert.equal(defaultEquityRole("Owner's Draw"), 'distributions');
  assert.equal(defaultEquityRole('Additional Paid-in Capital'), 'contributions');
  assert.equal(defaultEquityRole("Partners' Capital"), 'retained');
  assert.equal(defaultEquityRole('Treasury Stock'), 'other');
});

test('cash-flow classes: writer override, then the chart of accounts category, then lead sheet override', () => {
  const { input } = fixture();
  input.rows[1]!.cash_flow_category = 'investing';   // Equipment, set on the Cash Flow page
  input.rows[2]!.cash_flow_category = 'non_cash';    // Accumulated depreciation
  input.rows[7]!.cash_flow_category = 'operating';   // an EXPENSE account: not a balance sheet account, ignored
  const s = buildFsSource({
    ...input,
    cashFlowOverrides: [
      { account_id: 2, lead_sheet_id: null, classification: 'operating' },
      { account_id: null, lead_sheet_id: 6, classification: 'financing' },
    ],
  });
  const byAcct = (id: string) => s.cashFlowOverrides.find((o) => o.accountId === id)?.classification;
  assert.equal(byAcct('2'), 'operating', 'the Statement Writer override wins');
  assert.equal(byAcct('3'), 'noncash_adjustment');
  assert.equal(byAcct('8'), undefined);
  assert.deepEqual(s.cashFlowOverrides.find((o) => o.groupingId === '6'), { accountId: null, groupingId: '6', classification: 'financing' });
});

test('entity kind follows the tax form unless the statement set overrides it', () => {
  const { input } = fixture();
  assert.equal(buildFsSource(input).entityKind, 'corporation');
  assert.equal(buildFsSource({ ...input, entityType: '1065' }).entityKind, 'partnership');
  assert.equal(buildFsSource({ ...input, entityType: '1040_C' }).entityKind, 'sole_prop');
  assert.equal(buildFsSource({ ...input, settings: { framework: 'gaap', entityKind: 'llc' } }).entityKind, 'llc');
});

test('the loaded source computes: balanced, net income ties, no errors', () => {
  const s = buildFsSource(fixture().input);
  const rep = computeFsReport(SETTINGS, buildDefaultLayout(s.entityKind), FS_DEFAULT_STYLE, s);
  assert.deepEqual(rep.checks.filter((c) => c.severity === 'error'), []);
  const is = rep.statements.find((x) => x.kind === 'income_statement')!;
  assert.equal(is.rows.find((r) => r.caption === 'NET INCOME')!.values[0], 1500);
  const bs = rep.statements.find((x) => x.kind === 'balance_sheet')!;
  assert.equal(bs.rows.find((r) => r.caption === 'TOTAL ASSETS')!.values[0], 12000);
});

test('the source stamp moves with a balance and not with row order', () => {
  const a = buildFsSource(fixture().input);
  const reordered = fixture().input;
  reordered.rows.reverse();
  reordered.leadSheets = [...reordered.leadSheets].reverse();
  assert.equal(buildFsSource(reordered).sourceStamp, a.sourceStamp);
  const moved = fixture().input;
  moved.rows[0]!.book_adjusted_debit = '500001';
  assert.notEqual(buildFsSource(moved).sourceStamp, a.sourceStamp);
  const reassigned = fixture().input;
  reassigned.rows[8]!.lead_sheet_id = 11;
  assert.notEqual(buildFsSource(reassigned).sourceStamp, a.sourceStamp, 'lead sheet membership is content');
  // The stamp does not hash itself.
  assert.equal(fsSourceStamp(a), a.sourceStamp);
});

test('the numbers hash ignores what does not print', () => {
  const s = buildFsSource(fixture().input);
  const rep = computeFsReport(SETTINGS, buildDefaultLayout(s.entityKind), FS_DEFAULT_STYLE, s);
  const again = computeFsReport(SETTINGS, buildDefaultLayout(s.entityKind), FS_DEFAULT_STYLE, { ...s, sourceStamp: 'other' });
  assert.equal(fsNumbersHash(again), fsNumbersHash(rep));
  const changed = fixture().input;
  changed.rows[7]!.book_adjusted_debit = '660000';
  changed.rows[0]!.book_adjusted_debit = '490000';
  const rep2 = computeFsReport(SETTINGS, buildDefaultLayout(s.entityKind), FS_DEFAULT_STYLE, buildFsSource(changed));
  assert.notEqual(fsNumbersHash(rep2), fsNumbersHash(rep));
});

test('canonicalJson sorts keys at every level and drops undefined', () => {
  assert.equal(canonicalJson({ b: 1, a: { d: [2, { z: 1, y: undefined }], c: null } }), '{"a":{"c":null,"d":[2,{"z":1}]},"b":1}');
});
