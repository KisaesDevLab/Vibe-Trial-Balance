// Copyright 2025-2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Use is limited to qualifying small businesses. See LICENSE for terms.

/**
 * PDF report generator functions.
 * Each function takes a DB instance + parameters, queries the data, and returns a Buffer.
 */
import { Knex } from 'knex';
import type { Content, TableCell } from 'pdfmake/interfaces';
import { PdfTemplateService, DocOptions } from './PdfTemplateService';
import { categoryNet, netIncomeContribution } from '../lib/accounting';
import { whereHasActivity } from '../lib/tbActivity';
import { currentStampsForClient } from '../lib/leadSheetStamp';

// ─────────────────────────────────────────────────────────────────────────────
// Shared DB helpers
// ─────────────────────────────────────────────────────────────────────────────

interface PeriodInfo {
  id: number;
  name: string;
  start_date: string | null;
  end_date: string | null;
  client_id: number;
  client_name: string;
  ein: string | null;
}

async function getPeriodInfo(db: Knex, periodId: number): Promise<PeriodInfo> {
  const row = await db('periods as p')
    .join('clients as c', 'c.id', 'p.client_id')
    .where('p.id', periodId)
    .select(
      'p.id',
      'p.period_name as name',
      'p.start_date',
      'p.end_date',
      'p.client_id',
      'c.name as client_name',
      'c.tax_id as ein',
    )
    .first();
  if (!row) throw Object.assign(new Error('Period not found'), { code: 'NOT_FOUND', status: 404 });
  return row as PeriodInfo;
}

function fmtDate(d: string | null | undefined): string {
  if (!d) return '';
  return new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

// ─────────────────────────────────────────────────────────────────────────────
// (a) Working Trial Balance PDF
// ─────────────────────────────────────────────────────────────────────────────

const TB_CATEGORIES = ['assets', 'liabilities', 'equity', 'revenue', 'expenses'];

export async function generateTrialBalancePdf(db: Knex, periodId: number, visibleGroups?: string[]): Promise<Buffer> {
  const svc  = await PdfTemplateService.fromDb(db);
  const info = await getPeriodInfo(db, periodId);

  const rows = await db('v_adjusted_trial_balance')
    .where({ period_id: periodId, is_active: true })
    .modify(whereHasActivity)
    .orderBy('account_number', 'asc');

  const showGroup = (g: string) => !visibleGroups || visibleGroups.includes(g);

  const cols: string[] = ['Acct #', 'Account Name'];
  const numericColCount =
    (showGroup('priorYear') ? 2 : 0) +
    (showGroup('unadjusted') ? 2 : 0) +
    (showGroup('bookAje') ? 2 : 0) +
    (showGroup('bookAdjusted') ? 2 : 0) +
    (showGroup('taxAje') ? 2 : 0) +
    (showGroup('taxAdjusted') ? 2 : 0);

  // Landscape A4 usable width ≈ 770pt (842 - 2×36 margin).
  // Reserve 45pt for Acct # and flexible space for Account Name.
  // Distribute remaining space evenly across numeric columns, capped at 70pt.
  const acctNumWidth = 45;
  const availableForNumbers = 770 - acctNumWidth - 120; // 120pt min for Account Name
  const numColWidth = numericColCount > 0
    ? Math.min(70, Math.max(42, Math.floor(availableForNumbers / numericColCount)))
    : 52;

  const widths: (number | string)[] = [acctNumWidth, '*'];
  if (showGroup('priorYear'))    { cols.push('PY DR', 'PY CR'); widths.push(numColWidth, numColWidth); }
  if (showGroup('unadjusted'))   { cols.push('Unadj DR', 'Unadj CR'); widths.push(numColWidth, numColWidth); }
  if (showGroup('bookAje'))      { cols.push('Book Adj DR', 'Book Adj CR'); widths.push(numColWidth, numColWidth); }
  if (showGroup('bookAdjusted')) { cols.push('Book DR', 'Book CR'); widths.push(numColWidth, numColWidth); }
  if (showGroup('taxAje'))       { cols.push('Tax Adj DR', 'Tax Adj CR'); widths.push(numColWidth, numColWidth); }
  if (showGroup('taxAdjusted'))  { cols.push('Tax DR', 'Tax CR'); widths.push(numColWidth, numColWidth); }

  const tableBody: TableCell[][] = [svc.headerRow(cols)];

  // Totals accumulators
  const totals = {
    py_dr: 0, py_cr: 0,
    unadj_dr: 0, unadj_cr: 0,
    book_adj_dr: 0, book_adj_cr: 0,
    tax_adj_dr: 0, tax_adj_cr: 0,
    book_dr: 0, book_cr: 0,
    tax_dr: 0, tax_cr: 0,
  };

  let rowIdx = 0;
  for (const category of TB_CATEGORIES) {
    const catRows = rows.filter((r: Record<string, unknown>) =>
      (r.category as string)?.toLowerCase() === category,
    );
    if (catRows.length === 0) continue;

    tableBody.push(svc.sectionHeaderRow(category, cols.length));

    for (const r of catRows as Record<string, unknown>[]) {
      const cells: (string | number)[] = [
        r.account_number as string,
        r.account_name   as string,
      ];
      const pyDr = Number(r.prior_year_debit ?? 0);
      const pyCr = Number(r.prior_year_credit ?? 0);
      const uDr = Number(r.unadjusted_debit ?? 0);
      const uCr = Number(r.unadjusted_credit ?? 0);
      const baDr = Number(r.book_adj_debit ?? 0);
      const baCr = Number(r.book_adj_credit ?? 0);
      const taDr = Number(r.tax_adj_debit ?? 0);
      const taCr = Number(r.tax_adj_credit ?? 0);
      // Adjusted balances are presented NETTED per account (only the winning
      // side shows), matching the TB grid, popout, and Excel export — so the
      // report ties to the working grid line-for-line.
      const bNet = Number(r.book_adjusted_debit ?? 0) - Number(r.book_adjusted_credit ?? 0);
      const bDr = bNet > 0 ? bNet : 0;
      const bCr = bNet < 0 ? -bNet : 0;
      const tNet = Number(r.tax_adjusted_debit ?? 0) - Number(r.tax_adjusted_credit ?? 0);
      const tDr = tNet > 0 ? tNet : 0;
      const tCr = tNet < 0 ? -tNet : 0;

      if (showGroup('priorYear'))    { cells.push(pyDr, pyCr); }
      if (showGroup('unadjusted'))   { cells.push(uDr, uCr); }
      if (showGroup('bookAje'))      { cells.push(baDr, baCr); }
      if (showGroup('bookAdjusted')) { cells.push(bDr, bCr); }
      if (showGroup('taxAje'))       { cells.push(taDr, taCr); }
      if (showGroup('taxAdjusted'))  { cells.push(tDr, tCr); }

      tableBody.push(svc.dataRow(cells, { isAlt: rowIdx % 2 === 1 }));
      rowIdx++;

      totals.py_dr += pyDr; totals.py_cr += pyCr;
      totals.unadj_dr += uDr; totals.unadj_cr += uCr;
      totals.book_adj_dr += baDr; totals.book_adj_cr += baCr;
      totals.book_dr += bDr; totals.book_cr += bCr;
      totals.tax_adj_dr += taDr; totals.tax_adj_cr += taCr;
      totals.tax_dr += tDr; totals.tax_cr += tCr;
    }
  }

  // Grand totals row
  const grandCells: (string | number)[] = ['', 'TOTALS'];
  if (showGroup('priorYear'))    { grandCells.push(totals.py_dr, totals.py_cr); }
  if (showGroup('unadjusted'))   { grandCells.push(totals.unadj_dr, totals.unadj_cr); }
  if (showGroup('bookAje'))      { grandCells.push(totals.book_adj_dr, totals.book_adj_cr); }
  if (showGroup('bookAdjusted')) { grandCells.push(totals.book_dr, totals.book_cr); }
  if (showGroup('taxAje'))       { grandCells.push(totals.tax_adj_dr, totals.tax_adj_cr); }
  if (showGroup('taxAdjusted'))  { grandCells.push(totals.tax_dr, totals.tax_cr); }
  tableBody.push(svc.dataRow(grandCells, { bold: true, shade: true }));

  // Verify every displayed layer foots DR = CR (integer cents — exact), not
  // just the unadjusted columns; report the first layer that fails.
  const layerChecks: Array<{ label: string; dr: number; cr: number }> = [
    { label: 'Prior Year',    dr: totals.py_dr,       cr: totals.py_cr },
    { label: 'Unadjusted',    dr: totals.unadj_dr,    cr: totals.unadj_cr },
    { label: 'Book AJEs',     dr: totals.book_adj_dr, cr: totals.book_adj_cr },
    { label: 'Book Adjusted', dr: totals.book_dr,     cr: totals.book_cr },
    { label: 'Tax AJEs',      dr: totals.tax_adj_dr,  cr: totals.tax_adj_cr },
    { label: 'Tax Adjusted',  dr: totals.tax_dr,      cr: totals.tax_cr },
  ];
  const outOfBalance = layerChecks.filter((l) => l.dr !== l.cr);
  const balanced = outOfBalance.length === 0;

  const content: Content[] = [
    {
      table: { headerRows: 1, widths, body: tableBody },
      layout: {
        hLineWidth: (i: number) => (i === 0 || i === 1) ? 1 : 0,
        vLineWidth: () => 0,
        hLineColor: () => '#cccccc',
        paddingLeft: () => 0,
        paddingRight: () => 0,
      },
    },
    {
      text: balanced
        ? 'Trial balance is in balance (all layers foot DR = CR).'
        : `WARNING: Out of balance — ${outOfBalance.map((l) => `${l.label}: DR ${svc.formatCents(l.dr)} vs CR ${svc.formatCents(l.cr)}`).join('; ')}`,
      fontSize: 7,
      color: balanced ? '#27ae60' : '#c0392b',
      margin: [0, 4, 0, 0] as [number, number, number, number],
    },
  ];

  const docOpts: DocOptions = {
    title:       'Working Trial Balance',
    clientName:  info.client_name,
    ein:         info.ein ?? undefined,
    periodName:  info.name,
    startDate:   fmtDate(info.start_date),
    endDate:     fmtDate(info.end_date),
    content,
  };

  return svc.generateBuffer(svc.buildDocument(docOpts));
}

// ─────────────────────────────────────────────────────────────────────────────
// (b) Journal Entry Listing PDF
// ─────────────────────────────────────────────────────────────────────────────

export async function generateJournalEntryListingPdf(
  db: Knex,
  periodId: number,
  typeFilter?: string,
): Promise<Buffer> {
  const svc  = await PdfTemplateService.fromDb(db);
  const info = await getPeriodInfo(db, periodId);

  let q = db('journal_entries').where({ period_id: periodId });
  if (typeFilter && typeFilter !== 'all') q = q.where({ entry_type: typeFilter });
  const entries = await q.orderBy('entry_type').orderBy('entry_number');

  const entryIds = entries.map((e: Record<string, unknown>) => e.id as number);
  const lines = entryIds.length > 0
    ? await db('journal_entry_lines as jel')
        .whereIn('jel.journal_entry_id', entryIds)
        .join('journal_entries as je', 'je.id', 'jel.journal_entry_id')
        .join('chart_of_accounts as coa', 'coa.id', 'jel.account_id')
        .select(
          'jel.journal_entry_id',
          'coa.account_number',
          'coa.account_name',
          'jel.debit',
          'jel.credit',
        )
        .orderBy('jel.journal_entry_id')
    : [];

  const linesByEntry = new Map<number, typeof lines>();
  for (const l of lines as Record<string, unknown>[]) {
    const eid = l.journal_entry_id as number;
    if (!linesByEntry.has(eid)) linesByEntry.set(eid, []);
    linesByEntry.get(eid)!.push(l);
  }

  const cols = ['#', 'Type', 'Date', 'W/P Ref', 'Description', 'Acct #', 'Account Name', 'Debit', 'Credit'];
  const widths = [25, 35, 60, 45, '*', 45, '*', 60, 60];

  const tableBody: TableCell[][] = [svc.headerRow(cols)];
  let totalDr = 0;
  let totalCr = 0;
  let rowIdx = 0;

  for (const entry of entries as Record<string, unknown>[]) {
    const entryLines = linesByEntry.get(entry.id as number) ?? [];
    let firstLine = true;

    for (const line of entryLines as Record<string, unknown>[]) {
      const dr = Number(line.debit  ?? 0);
      const cr = Number(line.credit ?? 0);
      totalDr += dr;
      totalCr += cr;

      tableBody.push(svc.dataRow([
        firstLine ? String(entry.entry_number ?? '') : '',
        firstLine ? String(entry.entry_type   ?? '') : '',
        firstLine ? fmtDate(entry.entry_date as string) : '',
        firstLine ? (entry.workpaper_ref as string ?? '') : '',
        firstLine ? (entry.description as string ?? '') : '',
        line.account_number as string,
        line.account_name   as string,
        dr,
        cr,
      ], { isAlt: rowIdx % 2 === 1 }));

      firstLine = false;
      rowIdx++;
    }
  }

  // Grand total
  tableBody.push(svc.dataRow(
    ['', '', '', '', '', '', 'TOTALS', totalDr, totalCr],
    { bold: true, shade: true },
  ));

  const typeLabel = typeFilter && typeFilter !== 'all'
    ? ` (${typeFilter.toUpperCase()} only)`
    : '';

  const content: Content[] = [{
    table: { headerRows: 1, widths, body: tableBody },
    layout: {
      hLineWidth: (i: number) => (i === 0 || i === 1) ? 1 : 0,
      vLineWidth: () => 0,
      hLineColor: () => '#cccccc',
    },
  }];

  return svc.generateBuffer(svc.buildDocument({
    title:      `Journal Entry Listing${typeLabel}`,
    clientName: info.client_name,
    ein:        info.ein ?? undefined,
    periodName: info.name,
    startDate:  fmtDate(info.start_date),
    endDate:    fmtDate(info.end_date),
    content,
  }));
}

// ─────────────────────────────────────────────────────────────────────────────
// (c) AJE Listing PDF
// ─────────────────────────────────────────────────────────────────────────────

export async function generateAjeListingPdf(db: Knex, periodId: number): Promise<Buffer> {
  const svc  = await PdfTemplateService.fromDb(db);
  const info = await getPeriodInfo(db, periodId);

  const entries = await db('journal_entries')
    .where({ period_id: periodId })
    .whereIn('entry_type', ['book', 'tax'])
    .orderBy('entry_type')
    .orderBy('entry_number');

  const entryIds = entries.map((e: Record<string, unknown>) => e.id as number);
  const lines = entryIds.length > 0
    ? await db('journal_entry_lines as jel')
        .whereIn('jel.journal_entry_id', entryIds)
        .join('chart_of_accounts as coa', 'coa.id', 'jel.account_id')
        .select(
          'jel.journal_entry_id',
          'coa.account_number',
          'coa.account_name',
          'jel.debit',
          'jel.credit',
        )
    : [];

  const linesByEntry = new Map<number, typeof lines>();
  for (const l of lines as Record<string, unknown>[]) {
    const eid = l.journal_entry_id as number;
    if (!linesByEntry.has(eid)) linesByEntry.set(eid, []);
    linesByEntry.get(eid)!.push(l);
  }

  const cols = ['AJE #', 'Date', 'W/P Ref', 'Description', 'Acct #', 'Account Name', 'Debit', 'Credit'];
  const widths = [35, 60, 45, '*', 45, '*', 60, 60];

  const buildSection = (type: string): Content => {
    const sectionEntries = (entries as Record<string, unknown>[]).filter(
      (e) => e.entry_type === type,
    );
    const tableBody: TableCell[][] = [svc.headerRow(cols)];
    // Debits and credits are footed independently — printing the debit total
    // in both columns would mask an out-of-balance entry.
    let totalDr = 0;
    let totalCr = 0;
    let rowIdx = 0;

    for (const entry of sectionEntries) {
      const entryLines = linesByEntry.get(entry.id as number) ?? [];
      let firstLine = true;

      for (const line of entryLines as Record<string, unknown>[]) {
        const dr = Number(line.debit  ?? 0);
        const cr = Number(line.credit ?? 0);
        totalDr += dr;
        totalCr += cr;

        tableBody.push(svc.dataRow([
          firstLine ? String(entry.entry_number ?? '') : '',
          firstLine ? fmtDate(entry.entry_date as string) : '',
          firstLine ? (entry.workpaper_ref as string ?? '') : '',
          firstLine ? (entry.description as string ?? '') : '',
          line.account_number as string,
          line.account_name   as string,
          dr,
          cr,
        ], { isAlt: rowIdx % 2 === 1 }));

        firstLine = false;
        rowIdx++;
      }
    }

    tableBody.push(svc.dataRow(
      ['', '', '', '', '', totalDr === totalCr ? 'SECTION TOTAL' : 'SECTION TOTAL — OUT OF BALANCE', totalDr, totalCr],
      { bold: true, shade: true },
    ));

    return [
      { text: `${type.toUpperCase()} Adjusting Journal Entries`, fontSize: 9, bold: true, margin: [0, 8, 0, 4] as [number, number, number, number] },
      {
        table: { headerRows: 1, widths, body: tableBody },
        layout: { hLineWidth: (i: number) => (i <= 1) ? 1 : 0, vLineWidth: () => 0, hLineColor: () => '#cccccc' },
      },
    ] as Content;
  };

  const content: Content[] = [buildSection('book'), buildSection('tax')];

  return svc.generateBuffer(svc.buildDocument({
    title:      'AJE Listing',
    clientName: info.client_name,
    ein:        info.ein ?? undefined,
    periodName: info.name,
    startDate:  fmtDate(info.start_date),
    endDate:    fmtDate(info.end_date),
    content,
  }));
}

// ─────────────────────────────────────────────────────────────────────────────
// (d) General Ledger PDF
// ─────────────────────────────────────────────────────────────────────────────

export async function generateGeneralLedgerPdf(
  db: Knex,
  periodId: number,
  accountId?: number,
): Promise<Buffer> {
  const svc  = await PdfTemplateService.fromDb(db);
  const info = await getPeriodInfo(db, periodId);

  // TB opening balances
  let tbQ = db('trial_balance as tb')
    .join('chart_of_accounts as coa', 'coa.id', 'tb.account_id')
    .where('tb.period_id', periodId)
    .select(
      'coa.id as account_id', 'coa.account_number', 'coa.account_name',
      'coa.normal_balance',
      'tb.unadjusted_debit', 'tb.unadjusted_credit',
      'tb.prior_year_debit', 'tb.prior_year_credit',
    )
    .orderBy('coa.account_number');

  if (accountId) tbQ = tbQ.where('coa.id', accountId);

  const tbRows = await tbQ;

  // JE lines
  let jeQ = db('journal_entry_lines as jel')
    .join('journal_entries as je', 'je.id', 'jel.journal_entry_id')
    .join('chart_of_accounts as coa', 'coa.id', 'jel.account_id')
    .where('je.period_id', periodId)
    .select(
      'coa.id as account_id',
      'je.entry_date', 'je.entry_number', 'je.entry_type', 'je.description',
      'jel.debit', 'jel.credit',
    )
    .orderBy(['coa.account_number', 'je.entry_date', 'je.entry_number']);

  if (accountId) jeQ = jeQ.where('coa.id', accountId);

  const jeLines = await jeQ;

  // Group JE lines by account
  const linesByAccount = new Map<number, typeof jeLines>();
  for (const l of jeLines as Record<string, unknown>[]) {
    const aid = l.account_id as number;
    if (!linesByAccount.has(aid)) linesByAccount.set(aid, []);
    linesByAccount.get(aid)!.push(l);
  }

  // Union with accounts that have JE activity but no trial_balance row (the
  // web GL route does the same) — otherwise their activity vanishes from the
  // PDF and the ledger no longer foots to the journals.
  const tbAccountIds = new Set((tbRows as Record<string, unknown>[]).map((r) => Number(r.account_id)));
  const missingIds = [...linesByAccount.keys()].filter((aid) => !tbAccountIds.has(aid));
  if (missingIds.length > 0) {
    const missingAccts = await db('chart_of_accounts')
      .whereIn('id', missingIds)
      .select('id as account_id', 'account_number', 'account_name', 'normal_balance');
    for (const a of missingAccts as Record<string, unknown>[]) {
      (tbRows as Record<string, unknown>[]).push({ ...a, unadjusted_debit: 0, unadjusted_credit: 0 });
    }
    (tbRows as Record<string, unknown>[]).sort((a, b) =>
      String(a.account_number).localeCompare(String(b.account_number), undefined, { numeric: true }));
  }

  const cols = ['Date', 'Entry #', 'Type', 'Description', 'Debit', 'Credit', 'Balance'];
  const widths = [55, 40, 35, '*', 65, 65, 65];

  const content: Content[] = [];

  for (const acct of tbRows as Record<string, unknown>[]) {
    const aid        = acct.account_id as number;
    const unadjDr    = Number(acct.unadjusted_debit  ?? 0);
    const unadjCr    = Number(acct.unadjusted_credit ?? 0);
    const normalBal  = acct.normal_balance as string;

    // Skip dormant accounts — no beginning balance, no entries, no ending
    // balance — so the ledger matches the on-screen GL (lib/tbActivity.ts).
    const acctLines = (linesByAccount.get(aid) ?? []) as Record<string, unknown>[];
    if (
      acctLines.length === 0 &&
      unadjDr === 0 && unadjCr === 0 &&
      Number(acct.prior_year_debit ?? 0) === 0 && Number(acct.prior_year_credit ?? 0) === 0
    ) continue;

    // Opening balance
    let balance = normalBal === 'debit' ? unadjDr - unadjCr : unadjCr - unadjDr;

    const tableBody: TableCell[][] = [svc.headerRow(cols)];
    let rowIdx = 0;

    // Opening balance row
    tableBody.push(svc.dataRow(
      ['', '', '', 'Unadjusted Balance', unadjDr, unadjCr, balance],
      { bold: true, shade: true },
    ));
    rowIdx++;

    for (const line of acctLines) {
      const dr = Number(line.debit  ?? 0);
      const cr = Number(line.credit ?? 0);
      balance += normalBal === 'debit' ? dr - cr : cr - dr;

      tableBody.push(svc.dataRow([
        fmtDate(line.entry_date as string),
        `${String(line.entry_type ?? '').toUpperCase()}-${String(line.entry_number ?? '')}`,
        line.entry_type as string,
        line.description as string ?? '',
        dr, cr, balance,
      ], { isAlt: rowIdx % 2 === 1 }));
      rowIdx++;
    }

    // Ending balance — includes trans + book + tax entries, i.e. the
    // tax-adjusted figure; label it so users don't tie it to book balances.
    tableBody.push(svc.dataRow(
      ['', '', '', 'Ending Balance (all entries — tax adjusted)', null, null, balance],
      { bold: true, shade: true },
    ));

    content.push([
      {
        text: `${acct.account_number as string}  ${acct.account_name as string}`,
        fontSize: 9, bold: true,
        margin: [0, 10, 0, 3] as [number, number, number, number],
      },
      {
        table: { headerRows: 1, widths, body: tableBody },
        layout: { hLineWidth: (i: number) => i <= 1 ? 1 : 0, vLineWidth: () => 0, hLineColor: () => '#cccccc' },
      },
    ] as Content);
  }

  return svc.generateBuffer(svc.buildDocument({
    title:      'General Ledger',
    clientName: info.client_name,
    ein:        info.ein ?? undefined,
    periodName: info.name,
    startDate:  fmtDate(info.start_date),
    endDate:    fmtDate(info.end_date),
    content,
  }));
}

// ─────────────────────────────────────────────────────────────────────────────
// (e) Income Statement PDF
// ─────────────────────────────────────────────────────────────────────────────

export async function generateIncomeStatementPdf(
  db: Knex,
  periodId: number,
  includePriorYear = false,
): Promise<Buffer> {
  const svc  = await PdfTemplateService.fromDb(db);
  const info = await getPeriodInfo(db, periodId);

  const rows = await db('v_adjusted_trial_balance')
    .where({ period_id: periodId, is_active: true })
    .whereIn('category', ['revenue', 'expenses'])
    .modify(whereHasActivity)
    .orderBy('account_number', 'asc');

  const cols = includePriorYear
    ? ['Acct #', 'Account Name', 'Current Year', 'Prior Year', 'Change']
    : ['Acct #', 'Account Name', 'Amount'];
  const widths = includePriorYear
    ? [45, '*', 80, 80, 80]
    : [45, '*', 80];

  const tableBody: TableCell[][] = [svc.headerRow(cols)];
  let totalRevenue = 0;
  let totalExpenses = 0;
  let totalRevenuePY = 0;
  let totalExpensesPY = 0;
  let rowIdx = 0;

  // IS traditional: revenue positive (cr-dr), expenses positive (dr-cr)
  const isBookNet = (r: Record<string, unknown>): number => {
    const dr = Number(r.book_adjusted_debit  ?? 0);
    const cr = Number(r.book_adjusted_credit ?? 0);
    return (r.category as string) === 'revenue' ? cr - dr : dr - cr;
  };
  const isPyNet = (r: Record<string, unknown>): number => {
    const dr = Number(r.prior_year_debit  ?? 0);
    const cr = Number(r.prior_year_credit ?? 0);
    return (r.category as string) === 'revenue' ? cr - dr : dr - cr;
  };

  for (const section of ['revenue', 'expenses'] as const) {
    const sectionRows = (rows as Record<string, unknown>[]).filter(
      (r) => r.category === section,
    );
    if (sectionRows.length === 0) continue;

    tableBody.push(svc.sectionHeaderRow(section, cols.length));

    let sectionTotal = 0;
    let sectionTotalPY = 0;

    for (const r of sectionRows) {
      const amt  = isBookNet(r);
      const amtPY = isPyNet(r);
      sectionTotal   += amt;
      sectionTotalPY += amtPY;

      if (section === 'revenue') {
        totalRevenue   += amt;
        totalRevenuePY += amtPY;
      } else {
        totalExpenses   += amt;
        totalExpensesPY += amtPY;
      }

      const cells: (string | number | null)[] = [
        r.account_number as string,
        r.account_name   as string,
        amt,
      ];
      if (includePriorYear) {
        cells.push(amtPY, amt - amtPY);
      }
      tableBody.push(svc.dataRow(cells, { isAlt: rowIdx % 2 === 1 }));
      rowIdx++;
    }

    // Section subtotal
    const subtotalCells: (string | number | null)[] = ['', `Total ${section}`, sectionTotal];
    if (includePriorYear) subtotalCells.push(sectionTotalPY, sectionTotal - sectionTotalPY);
    tableBody.push(svc.dataRow(subtotalCells, { bold: true, shade: true }));
    rowIdx++;
  }

  // Net Income = revenue - expenses (both positive in traditional presentation)
  const netIncome   = totalRevenue - totalExpenses;
  const netIncomePY = totalRevenuePY - totalExpensesPY;
  const netIncomeCells: (string | number | null)[] = ['', 'NET INCOME / (LOSS)', netIncome];
  if (includePriorYear) netIncomeCells.push(netIncomePY, netIncome - netIncomePY);
  tableBody.push(svc.dataRow(netIncomeCells, { bold: true, shade: true }));

  const content: Content[] = [{
    table: { headerRows: 1, widths, body: tableBody },
    layout: { hLineWidth: (i: number) => i <= 1 ? 1 : 0, vLineWidth: () => 0, hLineColor: () => '#cccccc' },
  }];

  return svc.generateBuffer(svc.buildDocument({
    title:      'Income Statement',
    clientName: info.client_name,
    ein:        info.ein ?? undefined,
    periodName: info.name,
    startDate:  fmtDate(info.start_date),
    endDate:    fmtDate(info.end_date),
    pageOrientation: 'portrait',
    content,
  }));
}

// ─────────────────────────────────────────────────────────────────────────────
// (f) Balance Sheet PDF
// ─────────────────────────────────────────────────────────────────────────────

export async function generateBalanceSheetPdf(db: Knex, periodId: number): Promise<Buffer> {
  const svc  = await PdfTemplateService.fromDb(db);
  const info = await getPeriodInfo(db, periodId);

  // Include revenue/expense for net income calculation
  const rows = await db('v_adjusted_trial_balance')
    .where({ period_id: periodId, is_active: true })
    .modify(whereHasActivity)
    .orderBy('account_number', 'asc');

  const cols   = ['Acct #', 'Account Name', 'Amount'];
  const widths = [45, '*', 80];

  const tableBody: TableCell[][] = [svc.headerRow(cols)];
  let totalAssets = 0;
  let totalLiab = 0;
  let totalEquity = 0;
  let rowIdx = 0;

  // Category-based sign: assets/expenses dr-cr, liabilities/equity/revenue cr-dr
  const fsNet = (r: Record<string, unknown>): number => {
    const dr = Number(r.book_adjusted_debit  ?? 0);
    const cr = Number(r.book_adjusted_credit ?? 0);
    const cat = r.category as string;
    const creditNormal = cat === 'revenue' || cat === 'liabilities' || cat === 'equity';
    return creditNormal ? cr - dr : dr - cr;
  };
  const revenueRows = (rows as Record<string, unknown>[]).filter(r => r.category === 'revenue');
  const expenseRows = (rows as Record<string, unknown>[]).filter(r => r.category === 'expenses');
  const totalRevenue = revenueRows.reduce((s, r) => s + fsNet(r), 0);
  const totalExpenses = expenseRows.reduce((s, r) => s + fsNet(r), 0);
  const netIncome = totalRevenue - totalExpenses;

  for (const section of ['assets', 'liabilities', 'equity'] as const) {
    const sectionRows = (rows as Record<string, unknown>[]).filter(r => r.category === section);
    if (sectionRows.length === 0 && section !== 'equity') continue;

    tableBody.push(svc.sectionHeaderRow(section, cols.length));
    let sectionTotal = 0;

    for (const r of sectionRows) {
      const amt = fsNet(r);
      sectionTotal += amt;
      if (section === 'assets') totalAssets += amt;
      else if (section === 'liabilities') totalLiab += amt;
      else totalEquity += amt;

      tableBody.push(svc.dataRow([r.account_number as string, r.account_name as string, amt], { isAlt: rowIdx % 2 === 1 }));
      rowIdx++;
    }

    // Add net income line in equity section
    if (section === 'equity') {
      tableBody.push(svc.dataRow(['', 'Net Income (current period)', netIncome], { isAlt: rowIdx % 2 === 1 }));
      sectionTotal += netIncome;
      totalEquity += netIncome;
      rowIdx++;
    }

    tableBody.push(svc.dataRow(['', `Total ${section}`, sectionTotal], { bold: true, shade: true }));
    rowIdx++;
  }

  const liabPlusEquity = totalLiab + totalEquity;
  // Tolerance: 1 cent. Values are integer cents from the DB but JS Number
  // accumulation of ~hundreds of rows can emit trailing-bit drift.
  const imbalanceCents = totalAssets - liabPlusEquity;
  const balanced = Math.abs(imbalanceCents) < 1;

  tableBody.push(svc.dataRow(
    ['', 'Total Liabilities + Equity', liabPlusEquity],
    { bold: true, shade: true },
  ));

  const bannerText = balanced
    ? 'Balance sheet is in balance (A = L + E).'
    : `WARNING — BALANCE SHEET OUT OF BALANCE BY ${svc.formatCents(Math.abs(imbalanceCents))}. Assets: ${svc.formatCents(totalAssets)}  Liabilities + Equity: ${svc.formatCents(liabPlusEquity)}. Do not distribute until investigated.`;

  const content: Content[] = [
    // Prominent top-of-report banner when out of balance — impossible to miss.
    ...(balanced ? [] : [{
      text: bannerText,
      bold: true,
      fontSize: 10,
      color: '#ffffff',
      fillColor: '#c0392b',
      margin: [0, 0, 0, 6] as [number, number, number, number],
      alignment: 'center' as const,
    }]),
    {
      table: { headerRows: 1, widths, body: tableBody },
      layout: { hLineWidth: (i: number) => i <= 1 ? 1 : 0, vLineWidth: () => 0, hLineColor: () => '#cccccc' },
    },
    {
      text: bannerText,
      fontSize: 7,
      color: balanced ? '#27ae60' : '#c0392b',
      margin: [0, 4, 0, 0] as [number, number, number, number],
    },
  ];

  return svc.generateBuffer(svc.buildDocument({
    title:      'Balance Sheet',
    clientName: info.client_name,
    ein:        info.ein ?? undefined,
    periodName: info.name,
    startDate:  fmtDate(info.start_date),
    endDate:    fmtDate(info.end_date),
    pageOrientation: 'portrait',
    content,
  }));
}

// ─────────────────────────────────────────────────────────────────────────────
// (g) Tax Code Report PDF
// ─────────────────────────────────────────────────────────────────────────────

export async function generateTaxCodeReportPdf(
  db: Knex,
  periodId: number,
  columns: 'book' | 'tax' = 'tax',
): Promise<Buffer> {
  const svc  = await PdfTemplateService.fromDb(db);
  const info = await getPeriodInfo(db, periodId);

  const drCol = columns === 'book' ? 'vtb.book_adjusted_debit as dr' : 'vtb.tax_adjusted_debit as dr';
  const crCol = columns === 'book' ? 'vtb.book_adjusted_credit as cr' : 'vtb.tax_adjusted_credit as cr';

  // No tax_line filter: unmapped accounts must appear (grouped under
  // "Unassigned") so the PDF's population and totals match the on-screen
  // report instead of silently hiding unfinished mapping work.
  const rows = await db('v_adjusted_trial_balance as vtb')
    .join('chart_of_accounts as coa', 'coa.id', 'vtb.account_id')
    .leftJoin('tax_codes as tc', 'tc.id', 'coa.tax_code_id')
    .where('vtb.period_id', periodId)
    .where('vtb.is_active', true)
    .modify(whereHasActivity, 'vtb')
    .select(
      'vtb.account_id', 'vtb.account_number', 'vtb.account_name',
      drCol, crCol,
      'vtb.normal_balance',
      'vtb.tax_line',
      'tc.description as tc_description',
    )
    .orderByRaw('vtb.tax_line ASC NULLS LAST, vtb.account_number ASC');

  const layerLabel = columns === 'book' ? 'Book-Adj Net' : 'Tax-Adj Net';
  const cols   = ['Tax Code', 'Acct #', 'Account Name', layerLabel];
  const widths = [70, 55, '*', 80];

  const tableBody: TableCell[][] = [svc.headerRow(cols)];

  // Group by tax_line, capture description from first row
  const codeMap = new Map<string, { desc: string; rows: Record<string, unknown>[] }>();
  for (const r of rows as Record<string, unknown>[]) {
    const code = String(r.tax_line ?? 'Unassigned');
    if (!codeMap.has(code)) codeMap.set(code, { desc: (r.tc_description as string) ?? '', rows: [] });
    codeMap.get(code)!.rows.push(r);
  }

  let grandTotal = 0;
  let rowIdx = 0;

  for (const [code, group] of codeMap.entries()) {
    const label = group.desc ? `${code} — ${group.desc}` : code;
    tableBody.push(svc.sectionHeaderRow(label, cols.length));
    const codeRows = group.rows;
    let codeTotal = 0;

    for (const r of codeRows as Record<string, unknown>[]) {
      const dr  = Number(r.dr ?? 0);
      const cr  = Number(r.cr ?? 0);
      // Raw DR−CR, matching the on-screen Tax Code Report and its Excel
      // export: credit balances show as negatives, and the grand total is a
      // zero control on a balanced TB. The two renderings of this report must
      // state identical amounts.
      const net = dr - cr;
      codeTotal += net;

      tableBody.push(svc.dataRow([
        code,
        r.account_number as string,
        r.account_name   as string,
        net,
      ], { isAlt: rowIdx % 2 === 1 }));
      rowIdx++;
    }

    tableBody.push(svc.dataRow(['', '', `Total ${code}`, codeTotal], { bold: true, shade: true }));
    grandTotal += codeTotal;
    rowIdx++;
  }

  tableBody.push(svc.dataRow(['', '', 'GRAND TOTAL (balance check — should be 0.00)', grandTotal], { bold: true, shade: true }));

  const content: Content[] = [{
    table: { headerRows: 1, widths, body: tableBody },
    layout: { hLineWidth: (i: number) => i <= 1 ? 1 : 0, vLineWidth: () => 0, hLineColor: () => '#cccccc' },
  }];

  return svc.generateBuffer(svc.buildDocument({
    title:      'Tax Code Report',
    clientName: info.client_name,
    ein:        info.ein ?? undefined,
    periodName: info.name,
    startDate:  fmtDate(info.start_date),
    endDate:    fmtDate(info.end_date),
    pageOrientation: 'portrait',
    content,
  }));
}

// ─────────────────────────────────────────────────────────────────────────────
// (h) Workpaper Index PDF
// ─────────────────────────────────────────────────────────────────────────────

export async function generateWorkpaperIndexPdf(db: Knex, periodId: number, pageBreakByGroup = true): Promise<Buffer> {
  const svc  = await PdfTemplateService.fromDb(db);
  const info = await getPeriodInfo(db, periodId);

  // Get TB rows with notes
  const rows = await db('v_adjusted_trial_balance as vtb')
    .where('vtb.period_id', periodId)
    .where('vtb.is_active', true)
    .modify(whereHasActivity, 'vtb')
    .select(
      'vtb.account_id', 'vtb.account_number', 'vtb.account_name',
      'vtb.category',
      'vtb.book_adjusted_debit', 'vtb.book_adjusted_credit',
      'vtb.tax_adjusted_debit', 'vtb.tax_adjusted_credit',
      'vtb.normal_balance',
      'vtb.preparer_notes', 'vtb.reviewer_notes', 'vtb.workpaper_ref',
    )
    .orderBy('vtb.account_number', 'asc');

  // Fetch tickmark assignments for this period
  const tickmarkRows = await db('tb_tickmarks as tt')
    .join('tickmark_library as tl', 'tl.id', 'tt.tickmark_id')
    .where('tt.period_id', periodId)
    .select('tt.account_id', 'tl.id as tm_id', 'tl.symbol', 'tl.description as tm_description', 'tl.sort_order as tm_sort');
  const tickMap = new Map<number, Array<{ id: number; symbol: string; description: string }>>();
  for (const t of tickmarkRows) {
    const aid = t.account_id as number;
    if (!tickMap.has(aid)) tickMap.set(aid, []);
    tickMap.get(aid)!.push({ id: t.tm_id as number, symbol: t.symbol as string, description: t.tm_description as string });
  }

  const cols   = ['Acct #', 'Account Name', 'Cat.', 'Book Bal', 'Tax Bal', 'Marks', 'Notes'];
  const widths = [40, '*', 40, 60, 60, 35, '*'];
  const tableLayout = { hLineWidth: (i: number) => i <= 1 ? 1 : 0, vLineWidth: () => 0, hLineColor: () => '#cccccc' };

  const bookBal = (r: Record<string, unknown>): number => categoryNet(
    r.category as string, Number(r.book_adjusted_debit ?? 0), Number(r.book_adjusted_credit ?? 0));
  const taxBal = (r: Record<string, unknown>): number => categoryNet(
    r.category as string, Number(r.tax_adjusted_debit ?? 0), Number(r.tax_adjusted_credit ?? 0));

  // Group by workpaper_ref
  const wpGroups = new Map<string, Record<string, unknown>[]>();
  for (const r of rows as Record<string, unknown>[]) {
    const ref = (r.workpaper_ref as string) || 'Unassigned';
    if (!wpGroups.has(ref)) wpGroups.set(ref, []);
    wpGroups.get(ref)!.push(r);
  }
  const sortedRefs = [...wpGroups.entries()].sort(([a], [b]) => {
    if (a === 'Unassigned') return 1;
    if (b === 'Unassigned') return -1;
    return a.localeCompare(b);
  });

  // Build one page (page break) per WP ref group
  const content: Content[] = [];
  const usedTickmarks = new Set<number>();

  for (let gi = 0; gi < sortedRefs.length; gi++) {
    const [ref, refRows] = sortedRefs[gi];
    if (gi > 0 && pageBreakByGroup) content.push({ text: '', pageBreak: 'before' } as Content);

    const tableBody: TableCell[][] = [svc.headerRow(cols)];
    tableBody.push(svc.sectionHeaderRow(`WP Ref: ${ref}`, cols.length));
    let bookTotal = 0;
    let taxTotal = 0;

    for (let ri = 0; ri < refRows.length; ri++) {
      const r = refRows[ri];
      const bk = bookBal(r);
      const tx = taxBal(r);
      bookTotal += bk;
      taxTotal += tx;

      const marks = tickMap.get(r.account_id as number) ?? [];
      for (const m of marks) usedTickmarks.add(m.id);
      const markStr = marks.map((m) => m.symbol).join(' ');

      const notes: string[] = [];
      if (r.preparer_notes) notes.push(`P: ${r.preparer_notes}`);
      if (r.reviewer_notes) notes.push(`R: ${r.reviewer_notes}`);

      tableBody.push(svc.dataRow([
        r.account_number as string,
        r.account_name as string,
        r.category as string,
        bk, tx, markStr,
        notes.join(' | '),
      ], { isAlt: ri % 2 === 1 }));
    }

    tableBody.push(svc.dataRow(['', '', `Total ${ref}`, bookTotal, taxTotal, '', ''], { bold: true, shade: true }));

    content.push({
      table: { headerRows: 1, widths, body: tableBody },
      layout: tableLayout,
    } as Content);
  }

  // Tickmark legend page (if any tickmarks used)
  if (usedTickmarks.size > 0) {
    content.push({ text: '', pageBreak: 'before' } as Content);
    content.push({ text: 'Tickmark Legend', fontSize: 12, bold: true, margin: [0, 0, 0, 8] } as Content);

    const legendBody: TableCell[][] = [svc.headerRow(['Symbol', 'Description'])];
    const allMarks = [...tickMap.values()].flat();
    const uniqueMarks = new Map<number, { symbol: string; description: string }>();
    for (const m of allMarks) { if (usedTickmarks.has(m.id)) uniqueMarks.set(m.id, m); }
    for (const m of uniqueMarks.values()) {
      legendBody.push(svc.dataRow([m.symbol, m.description], {}));
    }

    content.push({
      table: { headerRows: 1, widths: [40, '*'], body: legendBody },
      layout: tableLayout,
    } as Content);
  }

  return svc.generateBuffer(svc.buildDocument({
    title:      'Workpaper Index',
    clientName: info.client_name,
    ein:        info.ein ?? undefined,
    periodName: info.name,
    startDate:  fmtDate(info.start_date),
    endDate:    fmtDate(info.end_date),
    content,
  }));
}

// ─────────────────────────────────────────────────────────────────────────────
// Lead Sheets PDF — one page per lead sheet with subtotals and a sign-off
// block, then a tickmark legend and a recap page that proves the lead sheets
// tie back to the trial balance.
//
// Structurally a sibling of generateWorkpaperIndexPdf (page break per group,
// section header, member rows, group subtotal, legend of symbols actually
// used); it groups by lead sheet instead of workpaper_ref and adds sign-off.
// ─────────────────────────────────────────────────────────────────────────────

export async function generateLeadSheetsPdf(db: Knex, periodId: number): Promise<Buffer> {
  const svc  = await PdfTemplateService.fromDb(db);
  const info = await getPeriodInfo(db, periodId);

  const rows = await db('v_adjusted_trial_balance as vtb')
    .where('vtb.period_id', periodId)
    .where('vtb.is_active', true)
    .modify(whereHasActivity, 'vtb')
    .select(
      'vtb.account_id', 'vtb.account_number', 'vtb.account_name', 'vtb.category',
      'vtb.lead_sheet_id', 'vtb.lead_sheet_code', 'vtb.lead_sheet_name', 'vtb.lead_sheet_sort',
      'vtb.workpaper_ref',
      'vtb.prior_year_debit', 'vtb.prior_year_credit',
      'vtb.unadjusted_debit', 'vtb.unadjusted_credit',
      'vtb.book_adj_debit', 'vtb.book_adj_credit',
      'vtb.book_adjusted_debit', 'vtb.book_adjusted_credit',
      'vtb.tax_adjusted_debit', 'vtb.tax_adjusted_credit',
    )
    .orderBy([
      { column: 'vtb.lead_sheet_sort', order: 'asc' },
      { column: 'vtb.lead_sheet_code', order: 'asc' },
      { column: 'vtb.account_number', order: 'asc' },
    ]) as Array<Record<string, unknown>>;

  const tickmarkRows = await db('tb_tickmarks as tt')
    .join('tickmark_library as tl', 'tl.id', 'tt.tickmark_id')
    .where('tt.period_id', periodId)
    .select('tt.account_id', 'tl.id as tm_id', 'tl.symbol', 'tl.description as tm_description');
  const tickMap = new Map<number, Array<{ id: number; symbol: string; description: string }>>();
  for (const t of tickmarkRows) {
    const aid = t.account_id as number;
    if (!tickMap.has(aid)) tickMap.set(aid, []);
    tickMap.get(aid)!.push({ id: t.tm_id as number, symbol: t.symbol as string, description: t.tm_description as string });
  }

  // Sign-offs. Staleness uses the SHARED stamp helper — never recomputed
  // inline, or the PDF could read STALE while the screen reads SIGNED.
  const signoffRows = await db('lead_sheet_signoffs')
    .where({ period_id: periodId })
    .whereNull('invalidated_at')
    .select('lead_sheet_id', 'role', 'user_name', 'signed_at', 'balance_stamp');
  const signoffMap = new Map<number, Record<string, { user_name: string | null; signed_at: string; balance_stamp: string }>>();
  for (const r of signoffRows as Array<Record<string, unknown>>) {
    const lsId = r.lead_sheet_id as number;
    if (!signoffMap.has(lsId)) signoffMap.set(lsId, {});
    signoffMap.get(lsId)![r.role as string] = {
      user_name: (r.user_name as string | null) ?? null,
      signed_at: r.signed_at as string,
      balance_stamp: r.balance_stamp as string,
    };
  }
  const stamps = await currentStampsForClient(db, periodId, info.client_id);

  // Attachment ref codes are LISTED here, never merged — the binder has its own
  // opt-in for embedding the files themselves.
  const refsByAccount = new Map<number, string[]>();
  if (await db.schema.hasTable('lead_sheet_attachments')) {
    const atts = await db('lead_sheet_attachments')
      .where({ period_id: periodId })
      .orderBy('ref_code', 'asc')
      .select('account_id', 'ref_code');
    for (const a of atts as Array<Record<string, unknown>>) {
      const aid = a.account_id as number | null;
      if (aid === null) continue;
      if (!refsByAccount.has(aid)) refsByAccount.set(aid, []);
      refsByAccount.get(aid)!.push(a.ref_code as string);
    }
  }


  // Review notes for this period, per lead sheet. Resolved notes still print —
  // a closed query is the evidence that the review happened, which is the whole
  // point of putting it in the workpaper.
  const notesBySheet = new Map<number, Array<{ body: string; author: string | null; created: string; resolved: boolean; account: string | null }>>();
  if (await db.schema.hasTable('lead_sheet_notes')) {
    const noteRows = await db('lead_sheet_notes as n')
      .leftJoin('chart_of_accounts as a', 'a.id', 'n.account_id')
      .where('n.period_id', periodId)
      .whereNotNull('n.lead_sheet_id')
      .orderBy([{ column: 'n.resolved_at', order: 'asc', nulls: 'first' }, { column: 'n.created_at', order: 'asc' }])
      .select('n.lead_sheet_id', 'n.body', 'n.author_name', 'n.created_at', 'n.resolved_at', 'a.account_number');
    for (const n of noteRows as Array<Record<string, unknown>>) {
      const lsId = n.lead_sheet_id as number;
      if (!notesBySheet.has(lsId)) notesBySheet.set(lsId, []);
      notesBySheet.get(lsId)!.push({
        body: String(n.body ?? ''),
        author: (n.author_name as string | null) ?? null,
        created: String(n.created_at ?? ''),
        resolved: n.resolved_at != null,
        account: (n.account_number as string | null) ?? null,
      });
    }
  }

  const net = (r: Record<string, unknown>, d: string, c: string): number =>
    categoryNet(String(r.category), Number(r[d] ?? 0), Number(r[c] ?? 0));

  // Group, with unassigned accounts collected into a trailing bucket.
  const groups = new Map<string, { id: number | null; code: string; name: string; rows: Array<Record<string, unknown>> }>();
  for (const r of rows) {
    const id = (r.lead_sheet_id as number | null) ?? null;
    const key = id === null ? '~unassigned' : String(id);
    if (!groups.has(key)) {
      groups.set(key, {
        id,
        code: (r.lead_sheet_code as string | null) ?? '',
        name: (r.lead_sheet_name as string | null) ?? 'Unassigned',
        rows: [],
      });
    }
    groups.get(key)!.rows.push(r);
  }
  // The query already ordered by sort_order; this only floats unassigned last.
  const ordered = [...groups.values()].sort((a, b) => {
    if (a.id === null) return 1;
    if (b.id === null) return -1;
    return 0;
  });

  const cols   = ['Acct #', 'Account Name', 'Prior Year', 'Unadjusted', 'Book AJE', 'Book Bal', 'Tax Bal', 'Marks', 'Files'];
  const widths = [45, '*', 62, 62, 62, 62, 62, 40, 45];
  const tableLayout = { hLineWidth: (i: number) => i <= 1 ? 1 : 0, vLineWidth: () => 0, hLineColor: () => '#cccccc' };

  const content: Content[] = [];
  const usedTickmarks = new Set<number>();
  const recap: Array<{ label: string; book: number; tax: number }> = [];
  let checkTotal = 0;

  for (let gi = 0; gi < ordered.length; gi++) {
    const g = ordered[gi];
    if (gi > 0) content.push({ text: '', pageBreak: 'before' } as Content);

    const label = g.id === null ? 'Unassigned — no lead sheet' : `${g.code} — ${g.name}`;
    const tableBody: TableCell[][] = [svc.headerRow(cols)];
    tableBody.push(svc.sectionHeaderRow(label, cols.length));

    let py = 0, un = 0, aje = 0, book = 0, tax = 0;
    for (let ri = 0; ri < g.rows.length; ri++) {
      const r = g.rows[ri];
      const vPy   = net(r, 'prior_year_debit', 'prior_year_credit');
      const vUn   = net(r, 'unadjusted_debit', 'unadjusted_credit');
      const vAje  = net(r, 'book_adj_debit', 'book_adj_credit');
      const vBook = net(r, 'book_adjusted_debit', 'book_adjusted_credit');
      const vTax  = net(r, 'tax_adjusted_debit', 'tax_adjusted_credit');
      py += vPy; un += vUn; aje += vAje; book += vBook; tax += vTax;
      // Raw debit-minus-credit, so the recap's balance check foots to zero.
      checkTotal += Number(r.book_adjusted_debit ?? 0) - Number(r.book_adjusted_credit ?? 0);

      const marks = tickMap.get(r.account_id as number) ?? [];
      for (const m of marks) usedTickmarks.add(m.id);

      tableBody.push(svc.dataRow([
        r.account_number as string,
        r.account_name as string,
        vPy, vUn, vAje, vBook, vTax,
        marks.map((m) => m.symbol).join(' '),
        (refsByAccount.get(r.account_id as number) ?? []).join(' '),
      ], { isAlt: ri % 2 === 1 }));
    }

    tableBody.push(svc.dataRow(
      ['', `Total ${label}`, py, un, aje, book, tax, '', ''],
      { bold: true, shade: true },
    ));
    recap.push({ label, book, tax });

    content.push({ table: { headerRows: 1, widths, body: tableBody }, layout: tableLayout } as Content);

    // Review notes, above the sign-off — a reviewer signing the page should be
    // looking at the open queries on it.
    const notes = g.id !== null ? (notesBySheet.get(g.id) ?? []) : [];
    if (notes.length > 0) {
      content.push({ text: 'Notes', fontSize: 9, bold: true, margin: [0, 10, 0, 4] } as Content);
      const noteBody: TableCell[][] = [];
      for (let ni = 0; ni < notes.length; ni++) {
        const n = notes[ni];
        const who = `${n.author ?? 'Unknown'}  ${fmtDate(n.created)}${n.resolved ? '  (resolved)' : ''}`;
        noteBody.push([
          { text: n.account ?? '', fontSize: 7, color: '#555555' },
          { text: n.body, fontSize: 8, color: n.resolved ? '#777777' : '#000000' },
          { text: who, fontSize: 7, color: '#555555', alignment: 'right' },
        ]);
      }
      content.push({
        table: { widths: [45, '*', 130], body: noteBody },
        layout: { hLineWidth: (i: number) => (i === 0 ? 0 : 0.5), vLineWidth: () => 0, hLineColor: () => '#e5e5e5' },
      } as Content);
    }

    // Sign-off block. Printed signature rules when unsigned, so a paper page is
    // still signable by hand.
    const so = g.id !== null ? signoffMap.get(g.id) : undefined;
    const current = g.id !== null ? (stamps.get(g.id) ?? '') : '';
    const line = (role: 'preparer' | 'reviewer'): string => {
      const heading = role === 'preparer' ? 'Prepared' : 'Reviewed';
      const rec = so?.[role];
      if (!rec) return `${heading}: ______________________   Date: ____________`;
      const stale = current && rec.balance_stamp !== current ? '  (STALE)' : '';
      return `${heading}: ${rec.user_name ?? 'Unknown'}   ${fmtDate(rec.signed_at)}${stale}`;
    };
    content.push({
      text: `${line('preparer')}          ${line('reviewer')}`,
      fontSize: 7, italics: true, margin: [0, 10, 0, 0], color: '#555555',
    } as Content);
  }

  // Tickmark legend — only symbols actually used on the printed sheets.
  if (usedTickmarks.size > 0) {
    content.push({ text: '', pageBreak: 'before' } as Content);
    content.push({ text: 'Tickmark Legend', fontSize: 12, bold: true, margin: [0, 0, 0, 8] } as Content);
    const legendBody: TableCell[][] = [svc.headerRow(['Symbol', 'Description'])];
    const uniqueMarks = new Map<number, { symbol: string; description: string }>();
    for (const m of [...tickMap.values()].flat()) {
      if (usedTickmarks.has(m.id)) uniqueMarks.set(m.id, m);
    }
    for (const m of uniqueMarks.values()) legendBody.push(svc.dataRow([m.symbol, m.description], {}));
    content.push({ table: { headerRows: 1, widths: [40, '*'], body: legendBody }, layout: tableLayout } as Content);
  }

  // Recap — this is what proves the lead sheets tie to the trial balance.
  if (recap.length > 0) {
    content.push({ text: '', pageBreak: 'before' } as Content);
    content.push({ text: 'Lead Sheet Recap', fontSize: 12, bold: true, margin: [0, 0, 0, 8] } as Content);
    const recapBody: TableCell[][] = [svc.headerRow(['Lead Sheet', 'Book Balance', 'Tax Balance'])];
    let bookTotal = 0, taxTotal = 0;
    for (let i = 0; i < recap.length; i++) {
      recapBody.push(svc.dataRow([recap[i].label, recap[i].book, recap[i].tax], { isAlt: i % 2 === 1 }));
      bookTotal += recap[i].book;
      taxTotal += recap[i].tax;
    }
    recapBody.push(svc.dataRow(['Total', bookTotal, taxTotal], { bold: true, shade: true }));
    recapBody.push(svc.dataRow(['Balance Check (should be 0.00)', checkTotal, ''], { bold: true, shade: true }));
    content.push({ table: { headerRows: 1, widths: ['*', 90, 90], body: recapBody }, layout: tableLayout } as Content);
  }

  if (content.length === 0) {
    content.push({ text: 'No accounts with activity in this period.', fontSize: 10, italics: true } as Content);
  }

  return svc.generateBuffer(svc.buildDocument({
    title:      'Lead Sheets',
    clientName: info.client_name,
    ein:        info.ein ?? undefined,
    periodName: info.name,
    startDate:  fmtDate(info.start_date),
    endDate:    fmtDate(info.end_date),
    content,
  }));
}

// ─────────────────────────────────────────────────────────────────────────────
// (i) Tax-Basis P&L PDF  (income/expense accounts grouped by tax code)
// ─────────────────────────────────────────────────────────────────────────────

export async function generateTaxBasisPlPdf(db: Knex, periodId: number): Promise<Buffer> {
  const svc  = await PdfTemplateService.fromDb(db);
  const info = await getPeriodInfo(db, periodId);

  type TbRow = {
    account_number: string; account_name: string; normal_balance: string; category: string;
    tax_adjusted_debit: string | number; tax_adjusted_credit: string | number;
    tax_code_id: number | null; tax_code: string | null;
    tc_description: string | null; sort_order: number | null;
  };

  const rows = await db('v_adjusted_trial_balance as vtb')
    .join('chart_of_accounts as coa', 'coa.id', 'vtb.account_id')
    .leftJoin('tax_codes as tc', 'tc.id', 'coa.tax_code_id')
    .where('vtb.period_id', periodId)
    .where('vtb.is_active', true)
    .whereIn('vtb.category', ['revenue', 'expenses'])
    .modify(whereHasActivity, 'vtb')
    .select(
      'vtb.account_number', 'vtb.account_name', 'vtb.normal_balance', 'vtb.category',
      'vtb.tax_adjusted_debit', 'vtb.tax_adjusted_credit',
      'coa.tax_code_id',
      'tc.tax_code', 'tc.description as tc_description', 'tc.sort_order',
    )
    .orderByRaw('tc.sort_order ASC NULLS LAST, tc.tax_code ASC NULLS LAST, vtb.account_number ASC') as TbRow[];

  const cols   = ['Tax Code', 'Description', 'Acct #', 'Account Name', 'Tax-Adj Net'];
  const widths = [55, '*', 45, '*', 80];
  const tableBody: TableCell[][] = [svc.headerRow(cols)];

  // Every group is split by category, not just Unassigned: rows render revenue
  // as cr−dr and expenses as dr−cr, both positive, so a group holding both
  // would subtotal them as if they shared a sign — a credit-balance revenue
  // account adding in like a debit — and group subtotals would stop summing to
  // net income. 88888 "reporting only" routinely holds such a mix. Codes with
  // one category produce a single group and keep their plain label. Mirrors
  // TaxBasisPlPage.
  const groups = new Map<string, { code: string; label: string; desc: string; unassigned: boolean; category: string; rows: TbRow[] }>();
  for (const r of rows) {
    const key = `${r.tax_code ?? '__UNASSIGNED__'}|${r.category}`;
    if (!groups.has(key)) {
      groups.set(key, {
        code: r.tax_code ?? 'Unassigned',
        label: r.tax_code ?? 'Unassigned',
        desc: r.tc_description ?? '(no tax code assigned)',
        unassigned: r.tax_code === null,
        category: r.category,
        rows: [],
      });
    }
    groups.get(key)!.rows.push(r);
  }

  // Only disambiguate labels where a code actually split across categories.
  const codeCounts = new Map<string, number>();
  for (const g of groups.values()) codeCounts.set(g.code, (codeCounts.get(g.code) ?? 0) + 1);
  for (const g of groups.values()) {
    if ((codeCounts.get(g.code) ?? 0) > 1) {
      g.label = `${g.code} — ${g.category === 'revenue' ? 'Revenue' : 'Expenses'}`;
    }
  }

  let grandRevenue = 0;
  let grandExpenses = 0;
  let rowIdx = 0;
  for (const [, grp] of groups.entries()) {
    tableBody.push(svc.sectionHeaderRow(`${grp.label} — ${grp.desc}`, cols.length));
    let grpNet = 0;
    for (const r of grp.rows) {
      const dr  = Number(r.tax_adjusted_debit  ?? 0);
      const cr  = Number(r.tax_adjusted_credit ?? 0);
      // Category-based signing: revenue = cr − dr, expenses = dr − cr, so
      // contra accounts net against their category (matches TaxBasisPlPage).
      const net = categoryNet(r.category, dr, cr);
      grpNet += net;
      if (r.category === 'revenue') grandRevenue += net;
      else grandExpenses += net;
      // Plain code in the per-row cell; the split suffix belongs on the
      // section header and subtotal, not on every line.
      tableBody.push(svc.dataRow([grp.unassigned ? '—' : grp.code, '', r.account_number, r.account_name, net], { isAlt: rowIdx % 2 === 1 }));
      rowIdx++;
    }
    tableBody.push(svc.dataRow(['', '', '', `Total ${grp.label}`, grpNet], { bold: true, shade: true }));
    rowIdx++;
  }
  // Net Income = Revenue - Expenses (both shown as positive above)
  const netIncome = grandRevenue - grandExpenses;
  tableBody.push(svc.dataRow(['', '', '', 'Net Income (Loss)', netIncome], { bold: true, shade: true }));

  const content: Content[] = [{
    table: { headerRows: 1, widths, body: tableBody },
    layout: { hLineWidth: (i: number) => i <= 1 ? 1 : 0, vLineWidth: () => 0, hLineColor: () => '#cccccc' },
  }];
  return svc.generateBuffer(svc.buildDocument({
    title: 'Tax-Basis Profit & Loss', clientName: info.client_name,
    ein: info.ein ?? undefined, periodName: info.name,
    startDate: fmtDate(info.start_date), endDate: fmtDate(info.end_date),
    pageOrientation: 'portrait', content,
  }));
}

// ─────────────────────────────────────────────────────────────────────────────
// (j) Tax Return Order PDF  (all accounts in tax code sort_order)
// ─────────────────────────────────────────────────────────────────────────────

export async function generateTaxReturnOrderPdf(db: Knex, periodId: number): Promise<Buffer> {
  const svc  = await PdfTemplateService.fromDb(db);
  const info = await getPeriodInfo(db, periodId);

  type TaxRow = {
    account_number: string; account_name: string; category: string; normal_balance: string;
    tax_adjusted_debit: string | number; tax_adjusted_credit: string | number;
    tax_code: string | null; tc_description: string | null; sort_order: number | null;
  };

  const rows = await db('v_adjusted_trial_balance as vtb')
    .join('chart_of_accounts as coa', 'coa.id', 'vtb.account_id')
    .leftJoin('tax_codes as tc', 'tc.id', 'coa.tax_code_id')
    .where('vtb.period_id', periodId)
    .where('vtb.is_active', true)
    .modify(whereHasActivity, 'vtb')
    .select(
      'vtb.account_number', 'vtb.account_name', 'vtb.category', 'vtb.normal_balance',
      'vtb.tax_adjusted_debit', 'vtb.tax_adjusted_credit',
      'tc.tax_code', 'tc.description as tc_description', 'tc.sort_order',
    )
    .orderByRaw('tc.sort_order ASC NULLS LAST, tc.tax_code ASC NULLS LAST, vtb.account_number ASC') as TaxRow[];

  const cols   = ['Sort', 'Tax Code', 'Acct #', 'Account Name', 'Category', 'Tax-Adj Net'];
  const widths = [30, 55, 45, '*', 55, 75];
  const tableBody: TableCell[][] = [svc.headerRow(cols)];

  // Balance check: raw Σ(debit − credit) over every account. A summed
  // "grand total" of normal-signed balances across all five categories is
  // not a recognized accounting figure; the raw sum is a control total that
  // must be zero on a balanced trial balance.
  let balanceCheck = 0;
  let rowIdx = 0;
  let lastCode: string | null | undefined = undefined;

  for (const r of rows) {
    const code = r.tax_code ?? null;
    if (code !== lastCode) {
      tableBody.push(svc.sectionHeaderRow(
        code ? `${code} — ${r.tc_description ?? ''}` : 'Unassigned — no tax code mapped',
        cols.length,
      ));
      lastCode = code;
    }
    const dr  = Number(r.tax_adjusted_debit  ?? 0);
    const cr  = Number(r.tax_adjusted_credit ?? 0);
    // Category-based signing (lib/accounting.ts) — matches TaxReturnOrderPage.
    const net = categoryNet(r.category, dr, cr);
    balanceCheck += dr - cr;
    tableBody.push(svc.dataRow([
      r.sort_order !== null ? String(r.sort_order) : '—',
      r.tax_code ?? '—',
      r.account_number,
      r.account_name,
      r.category.charAt(0).toUpperCase() + r.category.slice(1),
      net,
    ], { isAlt: rowIdx % 2 === 1 }));
    rowIdx++;
  }
  tableBody.push(svc.dataRow(['', '', '', '', 'Balance Check (should be 0.00)', balanceCheck], { bold: true, shade: true }));

  const content: Content[] = [{
    table: { headerRows: 1, widths, body: tableBody },
    layout: { hLineWidth: (i: number) => i <= 1 ? 1 : 0, vLineWidth: () => 0, hLineColor: () => '#cccccc' },
  }];
  return svc.generateBuffer(svc.buildDocument({
    title: 'Tax Return Order', clientName: info.client_name,
    ein: info.ein ?? undefined, periodName: info.name,
    startDate: fmtDate(info.start_date), endDate: fmtDate(info.end_date), content,
  }));
}

// ─────────────────────────────────────────────────────────────────────────────
// (j) Flux Analysis PDF  (two-period comparison with variance)
// ─────────────────────────────────────────────────────────────────────────────

export async function generateFluxAnalysisPdf(
  db: Knex,
  periodId: number,
  comparePeriodId: number,
): Promise<Buffer> {
  const svc  = await PdfTemplateService.fromDb(db);
  const info = await getPeriodInfo(db, periodId);

  const comparePeriod = await db('periods').where({ id: comparePeriodId })
    .first('period_name', 'start_date', 'end_date');
  if (!comparePeriod) throw Object.assign(new Error('Compare period not found'), { status: 404 });

  // Mirrors comparison.ts: fetch FULL rows for both periods (no is_active
  // filter) and walk the UNION of account ids, so accounts with a balance in
  // only one period — including deactivated/closed-out accounts — still
  // appear instead of silently vanishing from the category totals.
  const cmpSelect = [
    'vtb.account_id', 'vtb.account_number', 'vtb.account_name',
    'vtb.category', 'vtb.normal_balance',
    'vtb.book_adjusted_debit', 'vtb.book_adjusted_credit',
  ];
  const [currentRows, compareRows] = await Promise.all([
    db('v_adjusted_trial_balance as vtb')
      .where('vtb.period_id', periodId)
      .modify(whereHasActivity, 'vtb')
      .select(cmpSelect)
      .orderBy('vtb.account_number', 'asc'),
    db('v_adjusted_trial_balance as vtb')
      .where('vtb.period_id', comparePeriodId)
      .modify(whereHasActivity, 'vtb')
      .select(cmpSelect),
  ]);

  const curMap = new Map<number, Record<string, unknown>>();
  for (const r of currentRows as Record<string, unknown>[]) curMap.set(Number(r.account_id), r);
  const cmpMap = new Map<number, Record<string, unknown>>();
  for (const r of compareRows as Record<string, unknown>[]) cmpMap.set(Number(r.account_id), r);

  const unionRows = [
    ...(currentRows as Record<string, unknown>[]),
    ...(compareRows as Record<string, unknown>[]).filter((r) => !curMap.has(Number(r.account_id))),
  ].sort((a, b) => String(a.account_number).localeCompare(String(b.account_number), undefined, { numeric: true }));

  const notes = await db('variance_notes')
    .where({ period_id: periodId, compare_period_id: comparePeriodId })
    .select('account_id', 'note');
  const notesMap = new Map<number, string>();
  for (const n of notes as Record<string, unknown>[]) notesMap.set(Number(n.account_id), String(n.note));

  const cols   = ['Acct #', 'Account Name', info.name, comparePeriod.period_name, '$ Change', '% Change', 'Note'];
  const widths = [42, '*', 68, 68, 68, 48, '*'];

  const tableBody: TableCell[][] = [svc.headerRow(cols)];
  let rowIdx = 0;

  const CATEGORIES = ['assets', 'liabilities', 'equity', 'revenue', 'expenses'];

  for (const cat of CATEGORIES) {
    const catRows = unionRows.filter((r) => r.category === cat);
    if (catRows.length === 0) continue;

    tableBody.push(svc.sectionHeaderRow(cat.charAt(0).toUpperCase() + cat.slice(1), cols.length));

    let catCurrent = 0;
    let catCompare = 0;

    for (const r of catRows) {
      const accountId = Number(r.account_id);
      const cur = curMap.get(accountId);
      const cmp = cmpMap.get(accountId);
      // Category-based signing (matches comparison.ts): contra accounts show
      // negative within their category so the subtotals net correctly.
      const curr = cur ? categoryNet(cat, Number(cur.book_adjusted_debit), Number(cur.book_adjusted_credit)) : 0;
      const prev = cmp ? categoryNet(cat, Number(cmp.book_adjusted_debit), Number(cmp.book_adjusted_credit)) : 0;
      const chg  = curr - prev;
      const pct  = prev !== 0 ? (chg / Math.abs(prev)) * 100 : null;

      catCurrent += curr;
      catCompare += prev;

      tableBody.push(svc.dataRow([
        r.account_number as string,
        r.account_name   as string,
        curr, prev, chg,
        // 'New' only when the account had no compare-period presence at all;
        // a zero prior balance on an existing account is '—' (rate undefined).
        pct !== null ? `${pct >= 0 ? '+' : ''}${pct.toFixed(1)}%` : (curr !== 0 && !cmp ? 'New' : '—'),
        notesMap.get(accountId) ?? '',
      ], { isAlt: rowIdx % 2 === 1 }));
      rowIdx++;
    }

    const catChg = catCurrent - catCompare;
    const catPct = catCompare !== 0 ? (catChg / Math.abs(catCompare)) * 100 : null;
    tableBody.push(svc.dataRow([
      '', `Total ${cat.charAt(0).toUpperCase() + cat.slice(1)}`,
      catCurrent, catCompare, catChg,
      catPct !== null ? `${catPct >= 0 ? '+' : ''}${catPct.toFixed(1)}%` : '—',
      '',
    ], { bold: true, shade: true }));
    rowIdx++;
  }

  const content: Content[] = [
    {
      text: `Compare: ${info.name}  vs.  ${comparePeriod.period_name}`,
      fontSize: 9, color: '#555555', margin: [0, 0, 0, 8],
    },
    {
      table: { headerRows: 1, widths, body: tableBody },
      layout: { hLineWidth: (i: number) => i <= 1 ? 1 : 0, vLineWidth: () => 0, hLineColor: () => '#cccccc' },
    },
  ];

  return svc.generateBuffer(svc.buildDocument({
    title:      'Flux Analysis',
    clientName: info.client_name,
    ein:        info.ein ?? undefined,
    periodName: `${info.name} vs. ${comparePeriod.period_name}`,
    startDate:  fmtDate(info.start_date),
    endDate:    fmtDate(info.end_date),
    content,
  }));
}

// ─────────────────────────────────────────────────────────────────────────────
// (l) Cash Flow Statement PDF (indirect method)
// Mirrors the cashFlowRouter GET logic so the PDF and the on-screen statement
// agree line-for-line. Kept in sync with server/src/routes/cashFlow.ts —
// any sign/category change there must land here too.
// ─────────────────────────────────────────────────────────────────────────────

export async function generateCashFlowPdf(db: Knex, periodId: number): Promise<Buffer> {
  const svc  = await PdfTemplateService.fromDb(db);
  const info = await getPeriodInfo(db, periodId);

  const rows = await db('v_adjusted_trial_balance as tb')
    .join('chart_of_accounts as c', 'c.id', 'tb.account_id')
    .where('tb.period_id', periodId)
    .where('tb.is_active', true)
    .modify(whereHasActivity, 'tb')
    .select(
      'tb.account_number', 'tb.account_name',
      'tb.category', 'tb.normal_balance',
      'tb.book_adjusted_debit', 'tb.book_adjusted_credit',
      'tb.prior_year_debit', 'tb.prior_year_credit',
      'c.cash_flow_category',
    ) as Record<string, unknown>[];

  const bookNet = (r: Record<string, unknown>): number => {
    const dr = Number(r.book_adjusted_debit  ?? 0);
    const cr = Number(r.book_adjusted_credit ?? 0);
    return categoryNet(r.category as string, dr, cr);
  };
  const priorNet = (r: Record<string, unknown>): number => {
    const dr = Number(r.prior_year_debit  ?? 0);
    const cr = Number(r.prior_year_credit ?? 0);
    return categoryNet(r.category as string, dr, cr);
  };
  const cashImpact = (r: Record<string, unknown>): number => {
    const change = bookNet(r) - priorNet(r);
    return (r.category as string) === 'assets' ? -change : change;
  };
  const isBalanceSheet = (r: Record<string, unknown>): boolean =>
    r.category === 'assets' || r.category === 'liabilities' || r.category === 'equity';

  const netIncome = rows.reduce((sum, r) =>
    sum + netIncomeContribution(
      r.category as string,
      Number(r.book_adjusted_debit ?? 0),
      Number(r.book_adjusted_credit ?? 0),
    ), 0);

  const nonCashItems = rows
    .filter(r => r.cash_flow_category === 'non_cash' &&
      (r.category === 'revenue' || r.category === 'expenses'))
    .map(r => ({
      account_number: String(r.account_number),
      account_name:   String(r.account_name),
      amount: -netIncomeContribution(
        r.category as string,
        Number(r.book_adjusted_debit ?? 0),
        Number(r.book_adjusted_credit ?? 0),
      ),
    }));

  const workingCapital = rows
    .filter(r => r.cash_flow_category === 'operating' && isBalanceSheet(r))
    .map(r => ({
      account_number: String(r.account_number),
      account_name:   String(r.account_name),
      amount: cashImpact(r),
    }));

  const investingItems = rows
    .filter(r => r.cash_flow_category === 'investing' && isBalanceSheet(r))
    .map(r => ({
      account_number: String(r.account_number),
      account_name:   String(r.account_name),
      amount: cashImpact(r),
    }));

  const financingItems = rows
    .filter(r => r.cash_flow_category === 'financing' && isBalanceSheet(r))
    .map(r => ({
      account_number: String(r.account_number),
      account_name:   String(r.account_name),
      amount: cashImpact(r),
    }));

  const totalOperating =
    netIncome +
    nonCashItems.reduce((s, i) => s + i.amount, 0) +
    workingCapital.reduce((s, i) => s + i.amount, 0);
  const totalInvesting = investingItems.reduce((s, i) => s + i.amount, 0);
  const totalFinancing = financingItems.reduce((s, i) => s + i.amount, 0);
  const netChange = totalOperating + totalInvesting + totalFinancing;

  const cashRows = rows.filter(r => r.cash_flow_category === 'cash' && isBalanceSheet(r));
  const beginningCash = cashRows.reduce((s, r) => s + priorNet(r), 0);
  const endingCash    = cashRows.reduce((s, r) => s + bookNet(r),  0);

  const cols   = ['Acct #', 'Description', 'Amount'];
  const widths = [55, '*', 90];
  const tableBody: TableCell[][] = [svc.headerRow(cols)];
  let rowIdx = 0;

  const pushDataRow = (cells: (string | number | null)[], opts?: { bold?: boolean; shade?: boolean; indent?: number }): void => {
    const indent = opts?.indent ?? 0;
    if (indent > 0 && typeof cells[1] === 'string') {
      cells[1] = ' '.repeat(indent) + cells[1];
    }
    tableBody.push(svc.dataRow(cells, { bold: opts?.bold, shade: opts?.shade, isAlt: !opts?.shade && rowIdx % 2 === 1 }));
    rowIdx++;
  };

  // ── Operating ─────────────────────────────────────────────────────────────
  tableBody.push(svc.sectionHeaderRow('OPERATING ACTIVITIES', cols.length));
  pushDataRow(['', 'Net Income', netIncome]);
  if (nonCashItems.length > 0) {
    pushDataRow(['', 'Adjustments for non-cash items:', null], { bold: true });
    for (const item of nonCashItems) {
      pushDataRow([item.account_number, item.account_name, item.amount], { indent: 2 });
    }
  }
  if (workingCapital.length > 0) {
    pushDataRow(['', 'Changes in working capital:', null], { bold: true });
    for (const item of workingCapital) {
      pushDataRow([item.account_number, item.account_name, item.amount], { indent: 2 });
    }
  }
  pushDataRow(['', 'Net Cash from Operating Activities', totalOperating], { bold: true, shade: true });

  // ── Investing ─────────────────────────────────────────────────────────────
  tableBody.push(svc.sectionHeaderRow('INVESTING ACTIVITIES', cols.length));
  if (investingItems.length === 0) {
    pushDataRow(['', '(No accounts mapped to investing)', null]);
  } else {
    for (const item of investingItems) {
      pushDataRow([item.account_number, item.account_name, item.amount]);
    }
  }
  pushDataRow(['', 'Net Cash from Investing Activities', totalInvesting], { bold: true, shade: true });

  // ── Financing ─────────────────────────────────────────────────────────────
  tableBody.push(svc.sectionHeaderRow('FINANCING ACTIVITIES', cols.length));
  if (financingItems.length === 0) {
    pushDataRow(['', '(No accounts mapped to financing)', null]);
  } else {
    for (const item of financingItems) {
      pushDataRow([item.account_number, item.account_name, item.amount]);
    }
  }
  pushDataRow(['', 'Net Cash from Financing Activities', totalFinancing], { bold: true, shade: true });

  // ── Reconciliation ────────────────────────────────────────────────────────
  tableBody.push(svc.sectionHeaderRow('RECONCILIATION', cols.length));
  pushDataRow(['', 'Net Change in Cash', netChange], { bold: true });
  pushDataRow(['', 'Beginning Cash (prior year)', beginningCash]);
  pushDataRow(['', 'Ending Cash', endingCash], { bold: true, shade: true });

  const expectedEnding = beginningCash + netChange;
  const reconciliationDiff = endingCash - expectedEnding;
  const reconciled = reconciliationDiff === 0;

  const content: Content[] = [
    ...(reconciled ? [] : [{
      text: `WARNING — Ending cash does not tie to beginning + net change. Off by ${svc.formatCents(Math.abs(reconciliationDiff))}. Verify cash-flow mappings.`,
      bold: true,
      fontSize: 9,
      color: '#ffffff',
      fillColor: '#c0392b',
      margin: [0, 0, 0, 6] as [number, number, number, number],
      alignment: 'center' as const,
    }]),
    {
      table: { headerRows: 1, widths, body: tableBody },
      layout: { hLineWidth: (i: number) => i <= 1 ? 1 : 0, vLineWidth: () => 0, hLineColor: () => '#cccccc' },
    },
    {
      text: 'Indirect method. Non-cash add-backs include only income-statement accounts tagged "non-cash" (e.g. depreciation expense).',
      fontSize: 7,
      color: '#999999',
      italics: true,
      margin: [0, 8, 0, 0] as [number, number, number, number],
    },
  ];

  return svc.generateBuffer(svc.buildDocument({
    title:      'Statement of Cash Flows',
    clientName: info.client_name,
    ein:        info.ein ?? undefined,
    periodName: info.name,
    startDate:  fmtDate(info.start_date),
    endDate:    fmtDate(info.end_date),
    content,
  }));
}

// ─────────────────────────────────────────────────────────────────────────────
// (m) M-1 Book-to-Tax Reconciliation PDF
// Uses the client-side sign convention: expense-like categories adjust as
// (book − tax); income-like categories adjust as (tax − book). Kept in sync
// with TaxWorksheetsPage.tsx.
// ─────────────────────────────────────────────────────────────────────────────

// Must stay in sync with M1_INCOME_CATEGORIES in client/src/api/taxWorkpapers.ts.
const M1_INCOME_CATEGORIES = new Set<string>(['Tax-Exempt Income', 'Deferred Revenue', 'Other Income Difference']);
const m1Sign = (c: string | null | undefined): 1 | -1 =>
  c && M1_INCOME_CATEGORIES.has(c) ? -1 : 1;

export async function generateM1Pdf(db: Knex, periodId: number): Promise<Buffer> {
  const svc  = await PdfTemplateService.fromDb(db);
  const info = await getPeriodInfo(db, periodId);

  const adjs = await db('m1_adjustments')
    .where({ period_id: periodId })
    .orderBy(['category', 'description']) as Array<{
      id: number;
      description: string;
      category: string | null;
      book_amount: string | number;
      tax_amount: string | number;
    }>;

  // Book net income from TB (revenue − expenses, both positive in IS presentation).
  const rows = await db('v_adjusted_trial_balance')
    .where({ period_id: periodId, is_active: true })
    .whereIn('category', ['revenue', 'expenses'])
    .select('category', 'book_adjusted_debit', 'book_adjusted_credit',
      'tax_adjusted_debit', 'tax_adjusted_credit');

  let bookNetIncome = 0;
  let taxNetIncome  = 0;
  for (const r of rows as Array<Record<string, unknown>>) {
    bookNetIncome += netIncomeContribution(
      r.category as string, Number(r.book_adjusted_debit ?? 0), Number(r.book_adjusted_credit ?? 0));
    taxNetIncome += netIncomeContribution(
      r.category as string, Number(r.tax_adjusted_debit ?? 0), Number(r.tax_adjusted_credit ?? 0));
  }

  const totalBookAdj = adjs.reduce((s, a) => s + Number(a.book_amount), 0);
  const totalTaxAdj  = adjs.reduce((s, a) => s + Number(a.tax_amount),  0);
  const totalDiff    = adjs.reduce(
    (s, a) => s + m1Sign(a.category) * (Number(a.book_amount) - Number(a.tax_amount)),
    0,
  );
  const taxableIncome = bookNetIncome + totalDiff;

  const cols   = ['Description', 'Category', 'Book Amount', 'Tax Amount', 'Adj. to NI'];
  const widths = ['*', 100, 80, 80, 80];
  const tableBody: TableCell[][] = [svc.headerRow(cols)];

  if (adjs.length === 0) {
    tableBody.push(svc.dataRow(['(No adjustments recorded)', '', null, null, null]));
  } else {
    adjs.forEach((a, i) => {
      const diff = m1Sign(a.category) * (Number(a.book_amount) - Number(a.tax_amount));
      tableBody.push(svc.dataRow(
        [a.description, a.category ?? '', Number(a.book_amount), Number(a.tax_amount), diff],
        { isAlt: i % 2 === 1 },
      ));
    });
    tableBody.push(svc.dataRow(
      ['TOTAL ADJUSTMENTS', '', totalBookAdj, totalTaxAdj, totalDiff],
      { bold: true, shade: true },
    ));
  }

  // Summary section — the M-1 must tie: book NI + adjustments must equal the
  // tax-adjusted TB net income. Surface the tie-out on the deliverable, not
  // just on the screen.
  const m1TieDiff = taxableIncome - taxNetIncome;
  const summaryBody: TableCell[][] = [
    svc.dataRow(['', 'Book Net Income', bookNetIncome], { bold: true }),
    svc.dataRow(['', 'Total M-1 Adjustments', totalDiff]),
    svc.dataRow(['', 'Taxable Income (per M-1)', taxableIncome], { bold: true, shade: true }),
    svc.dataRow(['', 'Tax-Adjusted TB Net Income', taxNetIncome]),
  ];

  const content: Content[] = [
    ...(m1TieDiff === 0 ? [] : [{
      text: `WARNING — M-1 taxable income does not tie to the tax-adjusted trial balance. Off by ${svc.formatCents(Math.abs(m1TieDiff))}. Review M-1 adjustments against posted tax AJEs.`,
      bold: true,
      fontSize: 9,
      color: '#ffffff',
      fillColor: '#c0392b',
      margin: [0, 0, 0, 6] as [number, number, number, number],
      alignment: 'center' as const,
    }]),
    {
      table: { headerRows: 1, widths, body: tableBody },
      layout: { hLineWidth: (i: number) => i <= 1 ? 1 : 0, vLineWidth: () => 0, hLineColor: () => '#cccccc' },
    },
    { text: 'Reconciliation', fontSize: 11, bold: true, margin: [0, 14, 0, 4] as [number, number, number, number] },
    {
      table: { widths: [30, '*', 100], body: summaryBody },
      layout: { hLineWidth: (i: number) => i === 0 ? 0 : 1, vLineWidth: () => 0, hLineColor: () => '#cccccc' },
    },
    {
      text: 'Sign convention: expense-like categories add (book − tax); income-like categories (Tax-Exempt Income, Deferred Revenue, Other Income Difference) add (tax − book).',
      fontSize: 7,
      color: '#999999',
      italics: true,
      margin: [0, 8, 0, 0] as [number, number, number, number],
    },
  ];

  return svc.generateBuffer(svc.buildDocument({
    title:      'M-1 Book-to-Tax Reconciliation',
    clientName: info.client_name,
    ein:        info.ein ?? undefined,
    periodName: info.name,
    startDate:  fmtDate(info.start_date),
    endDate:    fmtDate(info.end_date),
    content,
  }));
}

// ─────────────────────────────────────────────────────────────────────────────
// (n) Tax Basis Schedule PDF (Book vs Tax per account, by category)
// ─────────────────────────────────────────────────────────────────────────────

export async function generateTaxBasisSchedulePdf(db: Knex, periodId: number): Promise<Buffer> {
  const svc  = await PdfTemplateService.fromDb(db);
  const info = await getPeriodInfo(db, periodId);

  const rows = await db('v_adjusted_trial_balance')
    .where({ period_id: periodId, is_active: true })
    .modify(whereHasActivity)
    .orderBy('account_number', 'asc') as Array<Record<string, unknown>>;

  // Match category sign convention from client: assets/expenses = dr-cr,
  // liabilities/equity/revenue = cr-dr.
  const netBalance = (r: Record<string, unknown>, which: 'book' | 'tax'): number => {
    const dr = Number(r[which === 'book' ? 'book_adjusted_debit'  : 'tax_adjusted_debit']  ?? 0);
    const cr = Number(r[which === 'book' ? 'book_adjusted_credit' : 'tax_adjusted_credit'] ?? 0);
    const cat = r.category as string;
    return (cat === 'assets' || cat === 'expenses') ? dr - cr : cr - dr;
  };

  const CATEGORY_ORDER = ['assets', 'liabilities', 'equity', 'revenue', 'expenses'] as const;
  const CATEGORY_LABELS: Record<string, string> = {
    assets: 'Assets', liabilities: 'Liabilities', equity: 'Equity',
    revenue: 'Revenue', expenses: 'Expenses',
  };

  const cols   = ['Acct #', 'Account Name', 'Book Balance', 'Tax Balance', 'Difference'];
  const widths = [50, '*', 85, 85, 85];
  const tableBody: TableCell[][] = [svc.headerRow(cols)];
  let rowIdx = 0;

  for (const cat of CATEGORY_ORDER) {
    const catRows = rows.filter((r) => r.category === cat);
    if (catRows.length === 0) continue;

    tableBody.push(svc.sectionHeaderRow(CATEGORY_LABELS[cat], cols.length));
    let bookTotal = 0, taxTotal = 0;
    for (const r of catRows) {
      const book = netBalance(r, 'book');
      const tax  = netBalance(r, 'tax');
      bookTotal += book;
      taxTotal  += tax;
      tableBody.push(svc.dataRow(
        [String(r.account_number), String(r.account_name), book, tax, tax - book],
        { isAlt: rowIdx % 2 === 1 },
      ));
      rowIdx++;
    }
    tableBody.push(svc.dataRow(
      ['', `Total ${CATEGORY_LABELS[cat]}`, bookTotal, taxTotal, taxTotal - bookTotal],
      { bold: true, shade: true },
    ));
    rowIdx++;
  }

  const content: Content[] = [{
    table: { headerRows: 1, widths, body: tableBody },
    layout: { hLineWidth: (i: number) => i <= 1 ? 1 : 0, vLineWidth: () => 0, hLineColor: () => '#cccccc' },
  }];

  return svc.generateBuffer(svc.buildDocument({
    title:      'Tax Basis Schedule',
    clientName: info.client_name,
    ein:        info.ein ?? undefined,
    periodName: info.name,
    startDate:  fmtDate(info.start_date),
    endDate:    fmtDate(info.end_date),
    content,
  }));
}

// ─────────────────────────────────────────────────────────────────────────────
// (n) Workpaper Package — Table of Contents
// ─────────────────────────────────────────────────────────────────────────────

export interface TocEntry {
  label: string;
  /** 1-based page of the merged document where this report starts. */
  startPage: number;
  pageCount: number;
}

/**
 * Front matter for the merged workpaper package. Page numbers are positions in
 * the merged document, counting the table of contents itself as page 1 — so a
 * number on this page is the page you turn to in the combined file.
 *
 * The caller has to know how long this document is before it can hand over
 * correct start pages, so it builds once with an assumed length and rebuilds if
 * the assumption was wrong (see the workpaper-merged route).
 */
export async function generateWorkpaperTocPdf(
  db: Knex,
  periodId: number,
  entries: TocEntry[],
): Promise<Buffer> {
  const svc  = await PdfTemplateService.fromDb(db);
  const info = await getPeriodInfo(db, periodId);

  const cols   = ['#', 'Report', 'Pages'];
  const widths = [26, '*', 60];

  const tableBody: TableCell[][] = [svc.headerRow(cols)];
  entries.forEach((e, i) => {
    const lastPage = e.startPage + e.pageCount - 1;
    const range = e.pageCount > 1 ? `${e.startPage}–${lastPage}` : String(e.startPage);
    // Page numbers are strings, not numbers: dataRow formats numeric cells as
    // money. Right-align them by hand, keeping the service's row styling.
    const row = svc.dataRow([String(i + 1), e.label, range], { isAlt: i % 2 === 1 });
    (row[0] as Record<string, unknown>).alignment = 'right';
    (row[2] as Record<string, unknown>).alignment = 'right';
    tableBody.push(row);
  });

  const totalPages = entries.reduce((s, e) => s + e.pageCount, 0);
  // "6 pages", not a bare 6: every other number in this column is a page
  // number you turn to, and the total is a count.
  const totalRow = svc.dataRow(
    ['', `${entries.length} report${entries.length === 1 ? '' : 's'}`, `${totalPages} pages`],
    { bold: true, shade: true },
  );
  (totalRow[2] as Record<string, unknown>).alignment = 'right';
  tableBody.push(totalRow);

  const content: Content[] = [{
    table: { headerRows: 1, widths, body: tableBody },
    layout: { hLineWidth: (i: number) => i <= 1 ? 1 : 0, vLineWidth: () => 0, hLineColor: () => '#cccccc' },
  }];

  return svc.generateBuffer(svc.buildDocument({
    title:      'Table of Contents',
    clientName: info.client_name,
    ein:        info.ein ?? undefined,
    periodName: info.name,
    startDate:  fmtDate(info.start_date),
    endDate:    fmtDate(info.end_date),
    pageOrientation: 'portrait',
    content,
  }));
}
