/**
 * PDF report generator functions.
 * Each function takes a DB instance + parameters, queries the data, and returns a Buffer.
 */
import { Knex } from 'knex';
import type { Content, TableCell } from 'pdfmake/interfaces';
import { PdfTemplateService, DocOptions } from './PdfTemplateService';

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
      const bDr = Number(r.book_adjusted_debit ?? 0);
      const bCr = Number(r.book_adjusted_credit ?? 0);
      const taDr = Number(r.tax_adj_debit ?? 0);
      const taCr = Number(r.tax_adj_credit ?? 0);
      const tDr = Number(r.tax_adjusted_debit ?? 0);
      const tCr = Number(r.tax_adjusted_credit ?? 0);

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

  const balanced = totals.unadj_dr === totals.unadj_cr;

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
        ? 'Trial balance is in balance.'
        : `WARNING: Trial balance is out of balance. DR total: ${svc.formatCents(totals.unadj_dr)}  CR total: ${svc.formatCents(totals.unadj_cr)}`,
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

  const cols = ['#', 'Type', 'Date', 'Description', 'Acct #', 'Account Name', 'Debit', 'Credit'];
  const widths = [25, 35, 60, '*', 45, '*', 60, 60];

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
    ['', '', '', '', '', 'TOTALS', totalDr, totalCr],
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

  const cols = ['AJE #', 'Date', 'Description', 'Acct #', 'Account Name', 'Debit', 'Credit'];
  const widths = [35, 60, '*', 45, '*', 60, 60];

  const buildSection = (type: string): Content => {
    const sectionEntries = (entries as Record<string, unknown>[]).filter(
      (e) => e.entry_type === type,
    );
    const tableBody: TableCell[][] = [svc.headerRow(cols)];
    let total = 0;
    let rowIdx = 0;

    for (const entry of sectionEntries) {
      const entryLines = linesByEntry.get(entry.id as number) ?? [];
      let firstLine = true;

      for (const line of entryLines as Record<string, unknown>[]) {
        const dr = Number(line.debit  ?? 0);
        const cr = Number(line.credit ?? 0);
        total += dr;

        tableBody.push(svc.dataRow([
          firstLine ? String(entry.entry_number ?? '') : '',
          firstLine ? fmtDate(entry.entry_date as string) : '',
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
      ['', '', '', '', 'SECTION TOTAL', total, total],
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

  const cols = ['Date', 'Entry #', 'Type', 'Description', 'Debit', 'Credit', 'Balance'];
  const widths = [55, 40, 35, '*', 65, 65, 65];

  const content: Content[] = [];

  for (const acct of tbRows as Record<string, unknown>[]) {
    const aid        = acct.account_id as number;
    const unadjDr    = Number(acct.unadjusted_debit  ?? 0);
    const unadjCr    = Number(acct.unadjusted_credit ?? 0);
    const normalBal  = acct.normal_balance as string;

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

    for (const line of (linesByAccount.get(aid) ?? []) as Record<string, unknown>[]) {
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

    // Ending balance
    tableBody.push(svc.dataRow(
      ['', '', '', 'Ending Balance', null, null, balance],
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

  const bookNet = (r: Record<string, unknown>): number => {
    const dr = Number(r.book_adjusted_debit  ?? 0);
    const cr = Number(r.book_adjusted_credit ?? 0);
    return (r.normal_balance as string) === 'debit' ? dr - cr : cr - dr;
  };
  const pyNet = (r: Record<string, unknown>): number => {
    const dr = Number(r.prior_year_debit  ?? 0);
    const cr = Number(r.prior_year_credit ?? 0);
    return (r.normal_balance as string) === 'debit' ? dr - cr : cr - dr;
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
      const amt  = bookNet(r);
      const amtPY = pyNet(r);
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

  // Net Income
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
    content,
  }));
}

// ─────────────────────────────────────────────────────────────────────────────
// (f) Balance Sheet PDF
// ─────────────────────────────────────────────────────────────────────────────

export async function generateBalanceSheetPdf(db: Knex, periodId: number): Promise<Buffer> {
  const svc  = await PdfTemplateService.fromDb(db);
  const info = await getPeriodInfo(db, periodId);

  const rows = await db('v_adjusted_trial_balance')
    .where({ period_id: periodId, is_active: true })
    .whereIn('category', ['assets', 'liabilities', 'equity'])
    .orderBy('account_number', 'asc');

  const cols   = ['Acct #', 'Account Name', 'Amount'];
  const widths = [45, '*', 80];

  const tableBody: TableCell[][] = [svc.headerRow(cols)];
  let totalAssets = 0;
  let totalLiab = 0;
  let totalEquity = 0;
  let rowIdx = 0;

  const bookNet = (r: Record<string, unknown>): number => {
    const dr = Number(r.book_adjusted_debit  ?? 0);
    const cr = Number(r.book_adjusted_credit ?? 0);
    return (r.normal_balance as string) === 'debit' ? dr - cr : cr - dr;
  };

  for (const section of ['assets', 'liabilities', 'equity'] as const) {
    const sectionRows = (rows as Record<string, unknown>[]).filter(r => r.category === section);
    if (sectionRows.length === 0) continue;

    tableBody.push(svc.sectionHeaderRow(section, cols.length));
    let sectionTotal = 0;

    for (const r of sectionRows) {
      const amt = bookNet(r);
      sectionTotal += amt;
      if (section === 'assets') totalAssets += amt;
      else if (section === 'liabilities') totalLiab += amt;
      else totalEquity += amt;

      tableBody.push(svc.dataRow([r.account_number as string, r.account_name as string, amt], { isAlt: rowIdx % 2 === 1 }));
      rowIdx++;
    }

    tableBody.push(svc.dataRow(['', `Total ${section}`, sectionTotal], { bold: true, shade: true }));
    rowIdx++;
  }

  const liabPlusEquity = totalLiab + totalEquity;
  const balanced = totalAssets === liabPlusEquity;

  tableBody.push(svc.dataRow(
    ['', 'Total Liabilities + Equity', liabPlusEquity],
    { bold: true, shade: true },
  ));

  const content: Content[] = [
    {
      table: { headerRows: 1, widths, body: tableBody },
      layout: { hLineWidth: (i: number) => i <= 1 ? 1 : 0, vLineWidth: () => 0, hLineColor: () => '#cccccc' },
    },
    {
      text: balanced
        ? 'Balance sheet is in balance (A = L + E).'
        : `WARNING: Balance sheet out of balance. Assets: ${svc.formatCents(totalAssets)}  Liabilities + Equity: ${svc.formatCents(liabPlusEquity)}`,
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
    content,
  }));
}

// ─────────────────────────────────────────────────────────────────────────────
// (g) Tax Code Report PDF
// ─────────────────────────────────────────────────────────────────────────────

export async function generateTaxCodeReportPdf(db: Knex, periodId: number): Promise<Buffer> {
  const svc  = await PdfTemplateService.fromDb(db);
  const info = await getPeriodInfo(db, periodId);

  const rows = await db('v_adjusted_trial_balance as vtb')
    .where('vtb.period_id', periodId)
    .where('vtb.is_active', true)
    .whereNotNull('vtb.tax_line')
    .select(
      'vtb.account_id', 'vtb.account_number', 'vtb.account_name',
      'vtb.tax_adjusted_debit', 'vtb.tax_adjusted_credit',
      'vtb.normal_balance',
      'vtb.tax_line',
    )
    .orderBy(['vtb.tax_line', 'vtb.account_number']);

  const cols   = ['Tax Code', 'Tax Line', 'Acct #', 'Account Name', 'Tax-Adj DR', 'Tax-Adj CR', 'Net Amount'];
  const widths = [55, '*', 45, '*', 65, 65, 65];

  const tableBody: TableCell[][] = [svc.headerRow(cols)];

  // Group by tax_line
  const codeMap = new Map<string, typeof rows>();
  for (const r of rows as Record<string, unknown>[]) {
    const code = String(r.tax_line ?? 'Unassigned');
    if (!codeMap.has(code)) codeMap.set(code, []);
    codeMap.get(code)!.push(r);
  }

  let grandTotal = 0;
  let rowIdx = 0;

  for (const [code, codeRows] of codeMap.entries()) {
    tableBody.push(svc.sectionHeaderRow(`Tax Code: ${code}`, cols.length));
    let codeTotal = 0;

    for (const r of codeRows as Record<string, unknown>[]) {
      const dr  = Number(r.tax_adjusted_debit  ?? 0);
      const cr  = Number(r.tax_adjusted_credit ?? 0);
      const net = (r.normal_balance as string) === 'debit' ? dr - cr : cr - dr;
      codeTotal += net;

      tableBody.push(svc.dataRow([
        code,
        '',
        r.account_number as string,
        r.account_name   as string,
        dr, cr, net,
      ], { isAlt: rowIdx % 2 === 1 }));
      rowIdx++;
    }

    tableBody.push(svc.dataRow(['', '', '', '', '', `Total ${code}`, codeTotal], { bold: true, shade: true }));
    grandTotal += codeTotal;
    rowIdx++;
  }

  tableBody.push(svc.dataRow(['', '', '', '', '', 'GRAND TOTAL', grandTotal], { bold: true, shade: true }));

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
    content,
  }));
}

// ─────────────────────────────────────────────────────────────────────────────
// (h) Workpaper Index PDF
// ─────────────────────────────────────────────────────────────────────────────

export async function generateWorkpaperIndexPdf(db: Knex, periodId: number): Promise<Buffer> {
  const svc  = await PdfTemplateService.fromDb(db);
  const info = await getPeriodInfo(db, periodId);

  // Get TB rows with notes
  const rows = await db('v_adjusted_trial_balance as vtb')
    .where('vtb.period_id', periodId)
    .where('vtb.is_active', true)
    .select(
      'vtb.account_id', 'vtb.account_number', 'vtb.account_name',
      'vtb.category',
      'vtb.book_adjusted_debit', 'vtb.book_adjusted_credit',
      'vtb.normal_balance',
      'vtb.preparer_notes', 'vtb.reviewer_notes', 'vtb.workpaper_ref',
    )
    .orderBy('vtb.account_number', 'asc');

  const cols   = ['Acct #', 'Account Name', 'Category', 'Book Balance', 'WP Ref', 'Preparer Note', 'Reviewer Note'];
  const widths = [45, '*', 55, 65, 45, '*', '*'];

  const tableBody: TableCell[][] = [svc.headerRow(cols)];
  let rowIdx = 0;

  for (const r of rows as Record<string, unknown>[]) {
    const dr  = Number(r.book_adjusted_debit  ?? 0);
    const cr  = Number(r.book_adjusted_credit ?? 0);
    const bal = (r.normal_balance as string) === 'debit' ? dr - cr : cr - dr;

    tableBody.push(svc.dataRow([
      r.account_number as string,
      r.account_name   as string,
      r.category       as string,
      bal,
      r.workpaper_ref   as string ?? '',
      r.preparer_notes  as string ?? '',
      r.reviewer_notes  as string ?? '',
    ], { isAlt: rowIdx % 2 === 1 }));
    rowIdx++;
  }

  const content: Content[] = [{
    table: { headerRows: 1, widths, body: tableBody },
    layout: { hLineWidth: (i: number) => i <= 1 ? 1 : 0, vLineWidth: () => 0, hLineColor: () => '#cccccc' },
  }];

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

  const groups = new Map<string, { label: string; desc: string; rows: TbRow[] }>();
  for (const r of rows) {
    const key = r.tax_code ?? '__UNASSIGNED__';
    if (!groups.has(key)) {
      groups.set(key, { label: r.tax_code ?? 'Unassigned', desc: r.tc_description ?? '(no tax code assigned)', rows: [] });
    }
    groups.get(key)!.rows.push(r);
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
      const net = r.normal_balance === 'debit' ? dr - cr : cr - dr;
      grpNet += net;
      // Accumulate revenue and expenses separately for net income
      if (r.category === 'revenue') grandRevenue += net;
      else grandExpenses += net;
      tableBody.push(svc.dataRow([grp.label === 'Unassigned' ? '—' : grp.label, '', r.account_number, r.account_name, net], { isAlt: rowIdx % 2 === 1 }));
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
    .select(
      'vtb.account_number', 'vtb.account_name', 'vtb.category', 'vtb.normal_balance',
      'vtb.tax_adjusted_debit', 'vtb.tax_adjusted_credit',
      'tc.tax_code', 'tc.description as tc_description', 'tc.sort_order',
    )
    .orderByRaw('tc.sort_order ASC NULLS LAST, tc.tax_code ASC NULLS LAST, vtb.account_number ASC') as TaxRow[];

  const cols   = ['Sort', 'Tax Code', 'Acct #', 'Account Name', 'Category', 'Tax-Adj Net'];
  const widths = [30, 55, 45, '*', 55, 75];
  const tableBody: TableCell[][] = [svc.headerRow(cols)];

  let grandNet = 0;
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
    const net = r.normal_balance === 'debit' ? dr - cr : cr - dr;
    grandNet += net;
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
  tableBody.push(svc.dataRow(['', '', '', '', 'Grand Total (Net)', grandNet], { bold: true, shade: true }));

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

  function netBal(dr: number, cr: number, nb: string): number {
    return nb === 'debit' ? dr - cr : cr - dr;
  }

  const [currentRows, compareRows] = await Promise.all([
    db('v_adjusted_trial_balance as vtb')
      .where('vtb.period_id', periodId).where('vtb.is_active', true)
      .select(
        'vtb.account_id', 'vtb.account_number', 'vtb.account_name',
        'vtb.category', 'vtb.normal_balance',
        'vtb.book_adjusted_debit', 'vtb.book_adjusted_credit',
      )
      .orderBy('vtb.account_number', 'asc'),
    db('v_adjusted_trial_balance as vtb')
      .where('vtb.period_id', comparePeriodId).where('vtb.is_active', true)
      .select('vtb.account_id', 'vtb.book_adjusted_debit', 'vtb.book_adjusted_credit'),
  ]);

  const cmpMap = new Map<number, { dr: number; cr: number }>();
  for (const r of compareRows as Record<string, unknown>[]) {
    cmpMap.set(Number(r.account_id), { dr: Number(r.book_adjusted_debit), cr: Number(r.book_adjusted_credit) });
  }

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
    const catRows = (currentRows as Record<string, unknown>[]).filter((r) => r.category === cat);
    if (catRows.length === 0) continue;

    tableBody.push(svc.sectionHeaderRow(cat.charAt(0).toUpperCase() + cat.slice(1), cols.length));

    let catCurrent = 0;
    let catCompare = 0;

    for (const r of catRows) {
      const nb   = r.normal_balance as string;
      const curr = netBal(Number(r.book_adjusted_debit), Number(r.book_adjusted_credit), nb);
      const cmp  = cmpMap.get(Number(r.account_id));
      const prev = cmp ? netBal(cmp.dr, cmp.cr, nb) : 0;
      const chg  = curr - prev;
      const pct  = prev !== 0 ? (chg / Math.abs(prev)) * 100 : null;

      catCurrent += curr;
      catCompare += prev;

      tableBody.push(svc.dataRow([
        r.account_number as string,
        r.account_name   as string,
        curr, prev, chg,
        pct !== null ? `${pct >= 0 ? '+' : ''}${pct.toFixed(1)}%` : (curr !== 0 ? 'New' : '—'),
        notesMap.get(Number(r.account_id)) ?? '',
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
