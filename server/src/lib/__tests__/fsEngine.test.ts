// Copyright 2025-2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Use is limited to qualifying small businesses. See LICENSE for terms.

/**
 * The Statement Writer engine (ported from Vibe MyBooks).
 * Run: npx tsx --test src/lib/__tests__/fsEngine.test.ts
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildDefaultLayout, computeFsReport, FS_DEFAULT_STYLE, fsClientLayoutSchema, fsTemplateLayoutSchema,
  bindLayout, toPortableLayout, fsStatementTitle, fsIncludedTitlesPhrase, fsDocumentCss, fsDefaultCashFlowClass,
  fsPlanColumns, fsPlanFlowDateLine, fsReportSettingsSchema,
  type FsLayout, type FsReportSettings, type FsRenderedStatement, type FsSourceData, type FsSourcePeriod, type FsStyle,
} from '../fs/engine';

// ── Fixture: a small corporation, FY = calendar 2025. Balances in CENTS. ──
const A = (id: string, number: string, name: string, accountType: string) =>
  ({ id, number, name, accountType, detailType: null, isVirtual: false });

const ACCOUNTS = [
  A('cash', '1000', 'Checking', 'asset'),
  A('ar', '1100', 'Accounts Receivable', 'asset'),
  A('equip', '1500', 'Equipment', 'asset'),
  A('accdep', '1510', 'Accumulated Depreciation', 'asset'),
  A('ap', '2000', 'Accounts Payable', 'liability'),
  A('loan', '2500', 'Bank Loan', 'liability'),
  A('cs', '3000', 'Common Stock', 'equity'),
  A('re', '3100', 'Retained Earnings', 'equity'),
  A('dist', '3200', 'Distributions', 'equity'),
  A('sales', '4000', 'Sales', 'revenue'),
  A('cogs', '5000', 'Cost of Goods Sold', 'expense'),
  A('rent', '6000', 'Rent', 'expense'),
  A('depr', '6100', 'Depreciation Expense', 'expense'),
  A('office', '6200', 'Office Supplies', 'expense'),
  A('int', '7000', 'Interest Income', 'revenue'),
];

const G = (id: string, code: string, name: string, accountIds: string[], sortOrder: number) => ({ id, code, name, sortOrder, accountIds });
const GROUPINGS = [
  G('gA', 'A', 'Cash', ['cash'], 0), G('gB', 'B', 'Accounts Receivable', ['ar'], 10), G('gC', 'C', 'Inventory', [], 20),
  G('gD', 'D', 'Fixed Assets', ['equip', 'accdep'], 30), G('gE', 'E', 'Other Assets', [], 40),
  G('gF', 'F', 'Accounts Payable', ['ap'], 50), G('gG', 'G', 'Accrued Liabilities', [], 60), G('gH', 'H', 'Debt', ['loan'], 70),
  G('gI', 'I', 'Other Liabilities', [], 80), G('gJ', 'J', 'Equity', ['cs', 're', 'dist'], 90),
  G('gK', 'K', 'Revenue', ['sales'], 100), G('gL', 'L', 'Cost of Goods Sold', ['cogs'], 110),
  G('gM', 'M', 'Operating Expenses', ['rent', 'depr', 'office'], 120), G('gN', 'N', 'Other Income', ['int'], 130), G('gO', 'O', 'Other Expenses', [], 140),
];

const OPEN_2024 = { cash: 1000040, ar: 500030, equip: 2000000, accdep: -400000, ap: -300025, loan: -1000000, cs: -100000, re: -900000, sales: -3000045, cogs: 1000000, rent: 1200000 };
const CY_2025 = {
  cash: 1310081, ar: 620010, equip: 2500000, accdep: -600000, ap: -250033, loan: -800000, cs: -100000, re: -1700045, dist: 300000,
  sales: -5000049, cogs: 2000011, rent: 1200000, depr: 200000, office: 330025, int: -10000,
};

const snap = (date: string, balances: Record<string, number>): FsSourcePeriod =>
  ({ date, balances, hasData: Object.values(balances).some((v) => v !== 0) });

function source(over: Partial<FsSourceData> = {}): FsSourceData {
  return {
    companyName: 'Acme Widgets, Inc.', entityKind: 'corporation', framework: 'gaap', sourceStamp: 'stamp',
    periodStart: '2025-01-01', periodEnd: '2025-12-31', priorStart: '2024-01-01', priorEnd: '2024-12-31',
    accounts: ACCOUNTS, groupings: GROUPINGS.map((g) => ({ ...g, accountIds: [...g.accountIds] })),
    snapshots: {
      '2025-12-31': snap('2025-12-31', CY_2025),
      '2024-12-31': snap('2024-12-31', OPEN_2024),
    },
    reAccountId: 're',
    equityRoles: { cs: 'contributions', re: 'retained', dist: 'distributions' },
    cashFlowOverrides: [],
    ...over,
  };
}

const SETTINGS: FsReportSettings = {
  framework: 'gaap',
  columns: { mode: 'single', pctOfRevenue: false, varianceAmt: false, variancePct: false },
};
const CY_PY = { mode: 'cy_py' as const, pctOfRevenue: false, varianceAmt: true, variancePct: true };

const run = (o: { settings?: Partial<FsReportSettings>; layout?: FsLayout; style?: FsStyle; source?: FsSourceData } = {}) =>
  computeFsReport({ ...SETTINGS, ...o.settings }, o.layout ?? buildDefaultLayout('corporation'), o.style ?? FS_DEFAULT_STYLE, o.source ?? source());

const rowBy = (st: FsRenderedStatement, caption: string) => {
  const r = st.rows.find((x) => x.caption === caption);
  if (!r) throw new Error(`row "${caption}" not found in ${st.kind}: ${st.rows.map((x) => x.caption).join(' | ')}`);
  return r;
};
const stmt = (rep: ReturnType<typeof run>, kind: string) => rep.statements.find((s) => s.kind === kind)!;
const errors = (rep: ReturnType<typeof run>) => rep.checks.filter((c) => c.severity === 'error');

// Every row carrying a formula must equal its formula evaluated on the
// displayed (rounded, plugged) values — i.e. the statements foot.
function assertFoots(st: FsRenderedStatement) {
  st.columns.forEach((c, ci) => {
    if (c.kind !== 'amount') return;
    for (const r of st.rows) {
      if (!r.formula || r.values[ci] === null) continue;
      const terms = r.formula.kind === 'sum' ? r.formula.rows.map((row) => ({ row, sign: 1 })) : r.formula.terms;
      const s = terms.reduce((acc, t) => acc + t.sign * (st.rows[t.row]!.values[ci] ?? 0), 0);
      assert.equal(Math.round(s * 100) / 100, r.values[ci], `${st.kind} "${r.caption}" col ${c.key}`);
    }
  });
}

// ── Default corporate layout ──

const rep0 = run();
const bs0 = stmt(rep0, 'balance_sheet');
const is0 = stmt(rep0, 'income_statement');
const eq0 = stmt(rep0, 'equity');
const cf0 = stmt(rep0, 'cash_flows');

test('default layout has no blocking errors', () => {
  assert.deepEqual(errors(rep0), []);
});

test('balances and rounds cents to whole dollars', () => {
  assert.equal(rowBy(bs0, 'TOTAL ASSETS').values[0], 38301);
  assert.equal(rowBy(bs0, "TOTAL LIABILITIES AND STOCKHOLDERS' EQUITY").values[0], 38301);
  assert.equal(rowBy(bs0, 'Cash').values[0], 13101);
  // RE on the balance sheet is closed: prior RE + current income.
  assert.equal(rowBy(bs0, 'Retained Earnings').values[0], 29801);
  for (const r of bs0.rows) for (const v of r.values) if (v !== null) assert.ok(Number.isInteger(v), `${r.caption}: ${v}`);
});

test('cents style shows the unrounded figures', () => {
  const style: FsStyle = { ...FS_DEFAULT_STYLE, number: { ...FS_DEFAULT_STYLE.number, decimals: 2 } };
  const rep = run({ style });
  assert.equal(rowBy(stmt(rep, 'balance_sheet'), 'Cash').values[0], 13100.81);
  assert.equal(rowBy(stmt(rep, 'income_statement'), 'NET INCOME').values[0], 12800.13);
  assert.deepEqual(errors(rep), []);
});

test('income statement ties to the ledger and schedules operating expenses', () => {
  assert.equal(rowBy(is0, 'NET INCOME').values[0], 12801);
  // The $0.58 lost rounding beginning RE and income lands on the largest IS line.
  assert.equal(rowBy(is0, 'Revenue').values[0], 50001);
  const opex = rowBy(is0, 'Operating expenses');
  assert.equal(opex.scheduleRef, 'Schedule 1');
  assert.equal(rep0.schedules.length, 1);
  const sched = rep0.schedules[0]!;
  assert.equal(sched.title, 'Schedule of Operating Expenses');
  assert.equal(rowBy(sched, 'Total operating expenses').values[0], opex.values[0]);
  assert.deepEqual(sched.rows.map((r) => r.caption), ['Rent', 'Depreciation Expense', 'Office Supplies', 'Total operating expenses']);
});

test('every statement and schedule foots', () => {
  for (const s of [...rep0.statements, ...rep0.schedules]) assertFoots(s);
});

test('equity statement rolls forward by account and ties to the balance sheet', () => {
  assert.equal(eq0.title, "Statement of Changes in Stockholders' Equity");
  assert.deepEqual(eq0.columns.map((c) => c.label), ['Common Stock', 'Retained Earnings', 'Total']);
  assert.deepEqual(rowBy(eq0, 'Balance, December 31, 2024').values, [1000, 17000, 18000]);
  assert.deepEqual(rowBy(eq0, 'Net income').values, [0, 12801, 12801]);
  assert.deepEqual(rowBy(eq0, 'Distributions to shareholders').values, [0, -3000, -3000]);
  assert.equal(rowBy(eq0, 'Balance, December 31, 2025').values[2], rowBy(bs0, "Total stockholders' equity").values[0]);
});

test('cash flows reconcile to the balance sheet cash (indirect method)', () => {
  assert.equal(rowBy(cf0, 'Net income').values[0], 12801);
  assert.equal(rowBy(cf0, 'Depreciation and amortization').values[0], 2000);
  assert.equal(rowBy(cf0, '(Increase) decrease in accounts receivable').values[0], -1200);
  assert.equal(rowBy(cf0, 'Purchase of fixed assets').values[0], -5000);
  assert.equal(rowBy(cf0, 'Repayment of debt').values[0], -2000);
  assert.equal(rowBy(cf0, 'Distributions paid').values[0], -3000);
  assert.equal(rowBy(cf0, 'CASH, END OF YEAR').values[0], rowBy(bs0, 'Cash').values[0]);
  assert.equal(rowBy(cf0, 'Cash, beginning of year').values[0], 10000);
  assert.equal(rep0.checks.find((c) => c.code === 'TB_FS_CF_UNRECONCILED'), undefined);
});

test('dollar signs go on the first line and double-ruled totals', () => {
  const first = bs0.rows.find((r) => r.values.some((v) => v !== null))!;
  assert.equal(first.dollarSign, true);
  assert.equal(rowBy(bs0, 'TOTAL ASSETS').dollarSign, true);
  assert.equal(rowBy(bs0, 'Accounts receivable').dollarSign, false);
});

test('zero lines are hidden', () => {
  assert.equal(bs0.rows.find((r) => r.caption === 'Inventory'), undefined);
  assert.equal(bs0.rows.find((r) => r.caption === 'Accrued liabilities'), undefined);
  assert.equal(rowBy(is0, 'Other income').values[0], 100);
});

// ── Checks ──

test('an account with a balance that is on no lead sheet is flagged', () => {
  const s = source({
    accounts: [...ACCOUNTS, A('stray', '1900', 'Suspense', 'asset')],
    snapshots: {
      '2025-12-31': snap('2025-12-31', { ...CY_2025, stray: 500, cash: CY_2025.cash - 500 }),
      '2024-12-31': snap('2024-12-31', OPEN_2024),
    },
  });
  const rep = run({ source: s });
  const c = rep.checks.find((x) => x.code === 'TB_FS_UNASSIGNED');
  assert.deepEqual(c?.accountIds, ['stray']);
  assert.ok(c?.message.includes('1900 Suspense'));
  assert.ok(rep.checks.find((x) => x.code === 'TB_FS_BS_UNBALANCED'));
});

test('a lead sheet the client does not have is flagged', () => {
  const layout = buildDefaultLayout('corporation');
  const is = layout.statements.find((s) => s.kind === 'income_statement')!;
  is.body.push({ type: 'leadsheet', id: 'x', ref: { leadsheetCode: 'ZZ' }, caption: 'Mystery', display: 'single_line' });
  assert.equal(run({ layout }).checks.find((c) => c.code === 'TB_FS_UNBOUND_LEADSHEET')?.nodeId, 'x');
});

test('pulling an account out removes it from its lead sheet line', () => {
  const layout = buildDefaultLayout('corporation');
  const is = layout.statements.find((s) => s.kind === 'income_statement')!;
  is.body.splice(5, 0, { type: 'account', id: 'rent_line', refs: [{ accountId: 'rent' }], caption: 'Rent expense', polarity: 'debit' });
  const ni = is.body.find((n) => n.id === 'is_operating_income');
  if (ni && ni.type === 'total') ni.terms.push({ nodeId: 'rent_line', sign: -1 });
  const rep = run({ layout });
  const st = stmt(rep, 'income_statement');
  assert.equal(rowBy(st, 'Rent expense').values[0], 12000);
  assert.ok(!rep.schedules[0]!.rows.map((r) => r.caption).includes('Rent'));
  assert.equal(rowBy(st, 'NET INCOME').values[0], 12801);
  assert.deepEqual(errors(rep), []);
});

test('accounts combine into one captioned schedule line', () => {
  const layout = buildDefaultLayout('corporation');
  const is = layout.statements.find((s) => s.kind === 'income_statement')!;
  const opex = is.body.find((n) => n.id === 'is_opex');
  if (opex?.type === 'leadsheet') opex.scheduleLines = [{ id: 'occ', caption: 'Occupancy and office', accountRefs: [{ accountId: 'office' }, { accountId: 'rent' }] }];
  const rep = run({ layout });
  assert.deepEqual(rep.schedules[0]!.rows.map((r) => r.caption), ['Occupancy and office', 'Depreciation Expense', 'Total operating expenses']);
  assert.equal(rowBy(rep.schedules[0]!, 'Occupancy and office').values[0], 15300);
});

// ── Columns: this period, or this period beside its prior year ──

test('a first-year client: the prior-year column is blank, equity opens at zero', () => {
  // prior_year_* all zero → the snapshot is PRESENT and empty.
  const s = source({ snapshots: { '2025-12-31': snap('2025-12-31', CY_2025), '2024-12-31': snap('2024-12-31', {}) } });
  const rep = run({ source: s, settings: { columns: CY_PY } });
  const bs = stmt(rep, 'balance_sheet');
  assert.equal(bs.title, 'Balance Sheets');
  assert.deepEqual(rowBy(bs, 'TOTAL ASSETS').values, [38301, null, null, null]);
  assert.ok(rep.checks.find((c) => c.code === 'TB_FS_PY_NO_DATA'));
  // The current year still gets its equity statement, opening at zero.
  assert.ok(stmt(rep, 'equity'));
  assert.ok(stmt(rep, 'cash_flows'));
});

test('cy_py without the prior year\'s opening: BS and IS show two years, equity and cash flows one', () => {
  const rep = run({ settings: { columns: CY_PY } });
  assert.deepEqual(errors(rep), []);
  const bs = stmt(rep, 'balance_sheet');
  const is = stmt(rep, 'income_statement');
  assert.deepEqual(bs.columns.filter((c) => c.kind === 'amount').map((c) => c.label), ['2025', '2024']);
  assert.equal(bs.dateLine, 'December 31, 2025 and 2024');
  assert.equal(is.dateLine, 'For the Years Ended December 31, 2025 and 2024');
  assert.equal(rowBy(is, 'NET INCOME').values[1], 8000);
  const eq = stmt(rep, 'equity');
  const cf = stmt(rep, 'cash_flows');
  assert.equal(cf.columns.length, 1, 'the prior year has no opening balance sheet, so no prior-year cash flows');
  assert.equal(cf.dateLine, 'For the Year Ended December 31, 2025');
  assert.equal(eq.dateLine, 'For the Year Ended December 31, 2025');
  assert.equal(eq.rows.filter((r) => r.caption === 'Net income').length, 1);
  // …and it says so, rather than reading the missing opening as zero.
  assert.ok(rep.checks.find((c) => c.code === 'TB_FS_PY_OPENING_UNAVAILABLE'));
  for (const st of [...rep.statements, ...rep.schedules]) assertFoots(st);
});

test('a short period is labelled by its dates, not by a year', () => {
  const dates = { periodStart: '2025-07-01', periodEnd: '2025-09-30', priorStart: '2025-04-01', priorEnd: '2025-06-30' };
  const plan = fsPlanColumns({ ...SETTINGS, columns: CY_PY }, dates);
  assert.deepEqual(plan.bsPoints.map((p) => p.label), ['Sep 30, 2025', 'Jun 30, 2025']);
  assert.equal(fsPlanFlowDateLine(plan, plan.isRanges), 'For the Three Months Ended September 30, 2025 and June 30, 2025');
  const single = fsPlanColumns(SETTINGS, dates);
  assert.equal(fsPlanFlowDateLine(single, single.isRanges), 'For the Three Months Ended September 30, 2025');
  const odd = fsPlanColumns(SETTINGS, { ...dates, periodStart: '2025-07-15' });
  assert.equal(fsPlanFlowDateLine(odd, odd.isRanges), 'For the Period from July 15, 2025 to September 30, 2025');
});

test('income-tax basis reads the tax balances and titles the statements for it', () => {
  // A $500 tax AJE: more depreciation, against accumulated depreciation.
  const tax = { ...CY_2025, depr: CY_2025.depr + 50000, accdep: CY_2025.accdep - 50000 };
  const s = source({
    framework: 'tax', taxPriorIsBook: true,
    snapshots: {
      '2025-12-31': { date: '2025-12-31', balances: CY_2025, taxBalances: tax, hasData: true },
      '2024-12-31': snap('2024-12-31', OPEN_2024),
    },
  });
  const rep = run({ source: s, settings: { framework: 'tax', columns: CY_PY } });
  assert.deepEqual(errors(rep), []);
  const is = stmt(rep, 'income_statement');
  assert.equal(is.title, 'Statements of Revenues and Expenses — Income Tax Basis');
  // 12,800.13 book − 500.00 of tax depreciation.
  assert.equal(rowBy(is, 'NET INCOME').values[0], 12300);
  assert.ok(rep.checks.find((c) => c.code === 'TB_FS_TAX_PY_BOOK'));
});

test('settings accept only the two column modes', () => {
  assert.equal(fsReportSettingsSchema.safeParse({ ...SETTINGS, columns: CY_PY }).success, true);
  assert.equal(fsReportSettingsSchema.safeParse({ ...SETTINGS, columns: { ...CY_PY, mode: 'side_by_side' } }).success, false);
});

// ── Rounding properties ──

function lcg(seed: number) {
  let s = seed;
  return () => { s = (s * 1103515245 + 12345) % 2147483648; return s / 2147483648; };
}
function balancedTb(rnd: () => number, max: number): Record<string, number> {
  const b: Record<string, number> = {};
  for (const a of ACCOUNTS) if (a.id !== 'cash') b[a.id] = Math.round((rnd() * 2 - 1) * max);
  b['cash'] = -Object.values(b).reduce((x, y) => x + y, 0);
  return b;
}

test('rounding property: random balanced trial balances always foot', () => {
  const rnd = lcg(12345);
  for (let t = 0; t < 40; t++) {
    const s = source({
      snapshots: {
        '2025-12-31': snap('2025-12-31', balancedTb(rnd, 5_000_000)),
        '2024-12-31': snap('2024-12-31', balancedTb(rnd, 5_000_000)),
      },
    });
    const rep = run({ source: s });
    assert.deepEqual(errors(rep), [], `case ${t}`);
    for (const st of [...rep.statements, ...rep.schedules]) assertFoots(st);
    const bs = stmt(rep, 'balance_sheet');
    const eq = stmt(rep, 'equity');
    const cf = stmt(rep, 'cash_flows');
    assert.equal(rowBy(bs, 'TOTAL ASSETS').values[0], rowBy(bs, "TOTAL LIABILITIES AND STOCKHOLDERS' EQUITY").values[0], `case ${t}`);
    const ni = rowBy(stmt(rep, 'income_statement'), 'NET INCOME').values[0];
    assert.equal(rowBy(eq, 'Net income').values[1], ni, `case ${t}`);
    assert.equal(rowBy(cf, 'Net income').values[0], ni, `case ${t}`);
    assert.equal(rowBy(cf, 'CASH, END OF YEAR').values[0], rowBy(bs, 'Cash').values[0], `case ${t}`);
    assert.equal(eq.rows[eq.rows.length - 1]!.values[2], rowBy(bs, "Total stockholders' equity").values[0], `case ${t}`);
  }
});

test('rounding property: comparative years stay consistent when the prior period is in the app', () => {
  const rnd = lcg(777);
  for (let t = 0; t < 25; t++) {
    const s = source({
      snapshots: {
        '2025-12-31': snap('2025-12-31', balancedTb(rnd, 5_000_000)),
        '2024-12-31': snap('2024-12-31', balancedTb(rnd, 5_000_000)),
        '2023-12-31': snap('2023-12-31', balancedTb(rnd, 5_000_000)),
      },
    });
    const rep = run({ source: s, settings: { columns: { mode: 'cy_py', pctOfRevenue: true, varianceAmt: true, variancePct: true } } });
    assert.deepEqual(errors(rep), [], `case ${t}`);
    assert.equal(rep.checks.find((c) => c.code === 'TB_FS_PY_OPENING_UNAVAILABLE'), undefined);
    for (const st of [...rep.statements, ...rep.schedules]) assertFoots(st);
    const bs = stmt(rep, 'balance_sheet');
    const is = stmt(rep, 'income_statement');
    const eq = stmt(rep, 'equity');
    const cf = stmt(rep, 'cash_flows');
    // Amount columns of the income statement (pct columns interleave).
    const [niCy, niPy] = [0, 2].map((i) => rowBy(is, 'NET INCOME').values[i]);
    assert.deepEqual(rowBy(cf, 'Net income').values, [niCy, niPy], `case ${t}`);
    assert.deepEqual(rowBy(cf, 'CASH, END OF YEAR').values, [rowBy(bs, 'Cash').values[0], rowBy(bs, 'Cash').values[1]], `case ${t}`);
    // PY ending cash is CY beginning cash.
    assert.equal(rowBy(cf, 'Cash, beginning of year').values[0], rowBy(bs, 'Cash').values[1], `case ${t}`);
    assert.equal(rowBy(eq, 'Balance, December 31, 2024').values[2], rowBy(bs, "Total stockholders' equity").values[1], `case ${t}`);
    assert.equal(rowBy(eq, 'Balance, December 31, 2025').values[2], rowBy(bs, "Total stockholders' equity").values[0], `case ${t}`);
    assert.deepEqual(eq.rows.filter((r) => r.caption === 'Net income').map((r) => r.values[2]), [niPy, niCy], `case ${t}`);
    assert.equal(eq.dateLine, 'For the Years Ended December 31, 2025 and 2024');
  }
});

// ── Schemas, titles, binding ──

test('the default layout is a valid template for every entity kind', () => {
  for (const k of ['corporation', 'partnership', 'llc', 'sole_prop'] as const) {
    assert.equal(fsTemplateLayoutSchema.safeParse(buildDefaultLayout(k)).success, true, k);
  }
});

test('templates may not carry client ids; ids are integer strings', () => {
  const l = buildDefaultLayout('corporation');
  l.statements[0]!.body.push({ type: 'account', id: 'p', refs: [{ accountId: '412' }], caption: 'x' });
  assert.equal(fsTemplateLayoutSchema.safeParse(l).success, false);
  assert.equal(fsClientLayoutSchema.safeParse(l).success, true);
  const bad = buildDefaultLayout('corporation');
  bad.statements[0]!.body.push({ type: 'account', id: 'p', refs: [{ accountId: '11111111-1111-4111-8111-111111111111' }], caption: 'x' });
  assert.equal(fsClientLayoutSchema.safeParse(bad).success, false);
});

test('binding resolves codes against a client and strips back to portable', () => {
  const groupings = GROUPINGS.map((g, i) => ({ id: String(900 + i), code: g.code, name: g.name })).filter((g) => g.code !== 'N');
  const { layout, unresolved } = bindLayout(buildDefaultLayout('corporation'), groupings);
  assert.deepEqual(unresolved.map((u) => u.leadsheetCode), ['N']);
  assert.ok(JSON.stringify(layout).includes('"groupingId":"900"'));
  assert.equal(fsClientLayoutSchema.safeParse(layout).success, true);
  assert.deepEqual(bindLayout(buildDefaultLayout('corporation'), groupings, { is_other_income: null }).unresolved, []);
  // A pulled-out account line and a customized schedule are client-only.
  const is = layout.statements.find((s) => s.kind === 'income_statement')!;
  is.body.push({ type: 'account', id: 'acct', refs: [{ accountId: '5' }], caption: 'Rent' });
  const portable = toPortableLayout(layout, groupings);
  assert.equal(fsTemplateLayoutSchema.safeParse(portable).success, true);
  assert.ok(!JSON.stringify(portable).includes('groupingId'));
});

test('titles follow framework and entity', () => {
  const o = { framework: 'tax' as const, entityKind: 'partnership' as const, comparative: false };
  assert.equal(fsStatementTitle('balance_sheet', o), "Statement of Assets, Liabilities and Partners' Capital — Income Tax Basis");
  assert.equal(fsStatementTitle('income_statement', { ...o, comparative: true }), 'Statements of Revenues and Expenses — Income Tax Basis');
  assert.equal(fsStatementTitle('equity', { ...o, entityKind: 'corporation', equityColumns: 'single', framework: 'gaap' }), 'Statement of Retained Earnings');
  assert.equal(
    fsIncludedTitlesPhrase(['balance_sheet', 'income_statement', 'equity', 'cash_flows'], { framework: 'gaap', entityKind: 'corporation', comparative: false }),
    "balance sheet, and the related statements of income, changes in stockholders' equity, and cash flows",
  );
});

test('a lead sheet letter only sets the cash-flow default when the account is the kind the letter stands for', () => {
  const acct = (accountType: string, name: string) => ({ accountType, name, detailType: null });
  assert.equal(fsDefaultCashFlowClass(acct('asset', 'Checking'), 'A'), 'cash');
  assert.equal(fsDefaultCashFlowClass(acct('liability', 'Bank Loan'), 'H'), 'financing');
  // A liability someone filed under A is not cash.
  assert.equal(fsDefaultCashFlowClass(acct('liability', 'Bank Overdraft'), 'A'), 'operating');
  // No lead sheet: the name decides.
  assert.equal(fsDefaultCashFlowClass(acct('asset', 'Petty Cash'), null), 'cash');
  assert.equal(fsDefaultCashFlowClass(acct('asset', 'Cash Surrender Value of Life Insurance'), null), 'operating');
  assert.equal(fsDefaultCashFlowClass(acct('asset', 'Accumulated Depreciation'), 'D'), 'noncash_adjustment');
});

test('preview fonts are requested without a .ttf extension', () => {
  const css = fsDocumentCss(FS_DEFAULT_STYLE, { mode: 'url', baseUrl: '/api/v1/fs-fonts' });
  assert.ok(css.includes("url('/api/v1/fs-fonts/LiberationSerif-Regular')"));
  assert.ok(!/fs-fonts\/[^')]+\.ttf/.test(css));
});
