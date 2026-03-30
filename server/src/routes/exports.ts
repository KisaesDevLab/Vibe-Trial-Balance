/**
 * Phase 9: Exports
 * GET /api/v1/periods/:periodId/exports/ultratax     -> Excel (.xlsx)
 * GET /api/v1/periods/:periodId/exports/cch          -> Excel (.xlsx)
 * GET /api/v1/periods/:periodId/exports/lacerte      -> Excel (.xlsx)
 * GET /api/v1/periods/:periodId/exports/gosystem     -> Excel (.xlsx)
 * GET /api/v1/periods/:periodId/exports/generic      -> Excel (.xlsx)
 * GET /api/v1/periods/:periodId/exports/working-tb   -> Excel (.xlsx)
 * GET /api/v1/periods/:periodId/exports/bookkeeper-letter -> PDF
 * GET /api/v1/periods/:periodId/exports/validate     -> JSON
 */
import { Router, Response } from 'express';
import ExcelJS from 'exceljs';
import { db } from '../db';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { PdfTemplateService } from '../pdf/PdfTemplateService';
import type { Content, TableCell } from 'pdfmake/interfaces';

export const exportsRouter = Router({ mergeParams: true });
exportsRouter.use(authMiddleware);

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

interface PeriodInfo {
  id: number;
  name: string;
  start_date: string | null;
  end_date: string | null;
  client_id: number;
  client_name: string;
  ein: string | null;
  entity_type: string | null;
  default_tax_software: string | null;
}

async function getPeriodInfo(periodId: number): Promise<PeriodInfo | null> {
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
      'c.entity_type',
      'c.default_tax_software',
    )
    .first();
  return row ?? null;
}

function fmtDate(d: string | null | undefined): string {
  if (!d) return '';
  return new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

/** cents -> dollar string (e.g. 123456 -> "1234.56") */
function centsToAmt(cents: number | null | undefined): number {
  return (cents ?? 0) / 100;
}


/**
 * Compute the natural net balance for a TB row in dollars.
 * Positive = normal balance direction for that account type.
 * Debit-normal (assets, expenses): positive when DR > CR.
 * Credit-normal (liabilities, equity, revenue): positive when CR > DR.
 */
function netBalance(r: Record<string, unknown>): number {
  const dr = Number(r.tax_adjusted_debit ?? 0);
  const cr = Number(r.tax_adjusted_credit ?? 0);
  return r.normal_balance === 'debit' ? (dr - cr) / 100 : (cr - dr) / 100;
}

/** Build a styled Excel workbook and return the buffer */
async function buildExcel(
  sheetName: string,
  columns: Array<{ header: string; key: string; width: number; numFmt?: string }>,
  rowData: Record<string, unknown>[],
): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Trial Balance App';
  wb.created = new Date();

  const ws = wb.addWorksheet(sheetName);
  ws.columns = columns.map(({ header: _h, ...rest }) => rest);

  // Styled header row
  const headerRow = ws.addRow(columns.map((c) => c.header));
  headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A5F' } };
  headerRow.alignment = { horizontal: 'center' };

  for (const row of rowData) {
    const dataRow = ws.addRow(columns.map((c) => row[c.key]));
    for (let i = 0; i < columns.length; i++) {
      if (columns[i].numFmt) dataRow.getCell(i + 1).numFmt = columns[i].numFmt!;
    }
  }

  ws.views = [{ state: 'frozen', ySplit: 1 }];

  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf);
}

// ─────────────────────────────────────────────────────────────────────────────
// TB data query — joins COA + tax codes + software maps
// ─────────────────────────────────────────────────────────────────────────────

async function getTbRows(periodId: number, software?: string) {
  let q = db('v_adjusted_trial_balance as tb')
    .join('chart_of_accounts as coa', 'coa.id', 'tb.account_id')
    .leftJoin('tax_codes as tc', 'tc.id', 'coa.tax_code_id')
    .where('tb.period_id', periodId)
    .where('tb.is_active', true)
    .select(
      'tb.account_id',
      'coa.account_number',
      'coa.account_name',
      'coa.category',
      'coa.tax_code_id',
      'tc.tax_code',
      'tc.description as tax_description',
      'tc.sort_order as tc_sort_order',
      'tb.unadjusted_debit',
      'tb.unadjusted_credit',
      'tb.book_adj_debit',
      'tb.book_adj_credit',
      'tb.tax_adj_debit',
      'tb.tax_adj_credit',
      'tb.book_adjusted_debit',
      'tb.book_adjusted_credit',
      'tb.tax_adjusted_debit',
      'tb.tax_adjusted_credit',
    );

  // Always include normal_balance so sign convention can be applied correctly
  q = q.select('coa.normal_balance');

  if (software) {
    q = q
      .leftJoin('tax_code_software_maps as tcsm', function () {
        this.on('tcsm.tax_code_id', '=', 'coa.tax_code_id')
          .andOn(db.raw('tcsm.tax_software = ?', [software]))
          .andOn(db.raw('tcsm.is_active = true'));
      })
      .select('tcsm.software_code', 'tcsm.software_description', 'tcsm.export_account_number', 'tcsm.export_description');
  }

  return q.orderBy('coa.account_number', 'asc');
}

/** Parse ?consolidate=1,5,12 query param into a Set of tax_code_ids */
function parseConsolidateParam(val: unknown): Set<number> {
  if (typeof val !== 'string' || !val.trim()) return new Set();
  return new Set(val.split(',').map(Number).filter((n) => !isNaN(n) && n > 0));
}

/** Parse ?overrides=JSON query param into runtime override map */
function parseOverridesParam(val: unknown): Record<string, { n: string; d: string }> | undefined {
  if (typeof val !== 'string' || !val.trim()) return undefined;
  try { return JSON.parse(val); } catch { return undefined; }
}

/** Handle export errors including consolidation duplicate check */
function handleExportError(err: unknown, res: Response): void {
  const e = err as { code?: string; status?: number; message?: string };
  if (e.code === 'DUPLICATE_ACCOUNT') {
    res.status(409).json({ data: null, error: { code: 'DUPLICATE_ACCOUNT', message: e.message } });
    return;
  }
  res.status(500).json({ data: null, error: { code: 'SERVER_ERROR', message: (err as Error).message } });
}

/**
 * Consolidate rows by tax_code_id for the given set of IDs.
 * Returns synthetic rows with the same shape so downstream Excel mapping is unchanged.
 */
function consolidateRows(rows: Record<string, unknown>[], consolidateIds: Set<number>, overrides?: Record<string, { n: string; d: string }>): Record<string, unknown>[] {
  if (consolidateIds.size === 0) return rows;

  const passThrough: Record<string, unknown>[] = [];
  const groups = new Map<number, { rows: Record<string, unknown>[]; first: Record<string, unknown> }>();

  for (const r of rows) {
    const tcId = r.tax_code_id as number | null;
    if (!tcId || !consolidateIds.has(tcId)) {
      passThrough.push(r);
      continue;
    }
    if (!groups.has(tcId)) {
      groups.set(tcId, { rows: [], first: r });
    }
    groups.get(tcId)!.rows.push(r);
  }

  const consolidated: Record<string, unknown>[] = [];
  for (const [, grp] of groups) {
    let bookDr = 0, bookCr = 0, taxDr = 0, taxCr = 0;
    for (const r of grp.rows) {
      bookDr += Number(r.book_adjusted_debit ?? 0);
      bookCr += Number(r.book_adjusted_credit ?? 0);
      taxDr  += Number(r.tax_adjusted_debit ?? 0);
      taxCr  += Number(r.tax_adjusted_credit ?? 0);
    }

    const f = grp.first;
    const tcId = f.tax_code_id as number;
    const runtimeOverride = overrides?.[String(tcId)];
    // Account identity: runtime override → DB export overrides → first account in group
    const acctNum = runtimeOverride?.n || (f.export_account_number as string) || (f.account_number as string) || '';
    const acctName = runtimeOverride?.d || (f.export_description as string) || (f.account_name as string) || '';

    consolidated.push({
      ...f,
      account_number: acctNum,
      account_name: acctName,
      // software_code and software_description remain from the first row (the tax line mapping)
      book_adjusted_debit: bookDr,
      book_adjusted_credit: bookCr,
      tax_adjusted_debit: taxDr,
      tax_adjusted_credit: taxCr,
    });
  }

  // Validate: consolidated account numbers must not conflict with pass-through account numbers
  const existingAcctNums = new Set(passThrough.map((r) => String(r.account_number).toLowerCase()));
  for (const c of consolidated) {
    const num = String(c.account_number).toLowerCase();
    if (existingAcctNums.has(num)) {
      throw Object.assign(
        new Error(`Consolidated account number "${c.account_number}" conflicts with an existing account in the export. Choose a different number.`),
        { code: 'DUPLICATE_ACCOUNT', status: 409 },
      );
    }
  }

  // Sort consolidated by sort_order, then merge with pass-through
  consolidated.sort((a, b) => (Number(a.tc_sort_order ?? 999) - Number(b.tc_sort_order ?? 999)));
  return [...consolidated, ...passThrough];
}

// ─────────────────────────────────────────────────────────────────────────────
// GET validate
// ─────────────────────────────────────────────────────────────────────────────

exportsRouter.get('/validate', async (req: AuthRequest, res: Response): Promise<void> => {
  const periodId = Number(req.params.periodId);
  if (isNaN(periodId)) {
    res.status(400).json({ data: null, error: { code: 'INVALID_ID', message: 'Invalid period ID' } });
    return;
  }

  const software = (req.query.software as string | undefined) ?? 'ultratax';

  try {
    const info = await getPeriodInfo(periodId);
    if (!info) {
      res.status(404).json({ data: null, error: { code: 'NOT_FOUND', message: 'Period not found' } });
      return;
    }

    const rows = await getTbRows(periodId, software);

    // Balance check (unadjusted)
    let totalDr = 0;
    let totalCr = 0;
    for (const r of rows as Record<string, unknown>[]) {
      totalDr += Number(r.unadjusted_debit ?? 0);
      totalCr += Number(r.unadjusted_credit ?? 0);
    }
    const isBalanced = totalDr === totalCr;

    // Unmapped accounts (no tax_code_id)
    const unmappedAccounts = (rows as Record<string, unknown>[])
      .filter((r) => !r.tax_code_id)
      .map((r) => ({ account_id: r.account_id, account_number: r.account_number, account_name: r.account_name }));

    // Missing software mappings (has tax_code_id but no software_code for selected software)
    const missingMappings = (rows as Record<string, unknown>[])
      .filter((r) => r.tax_code_id && !r.software_code)
      .map((r) => ({
        account_id: r.account_id,
        account_number: r.account_number,
        account_name: r.account_name,
        tax_code: r.tax_code,
      }));

    const warnings: string[] = [];
    if (!isBalanced) {
      warnings.push(`Trial balance is out of balance (DR: ${(totalDr / 100).toFixed(2)} vs CR: ${(totalCr / 100).toFixed(2)})`);
    }
    if (unmappedAccounts.length > 0) {
      warnings.push(`${unmappedAccounts.length} account(s) have no tax code assigned`);
    }
    if (missingMappings.length > 0) {
      warnings.push(`${missingMappings.length} account(s) have a tax code but no ${software} software mapping`);
    }

    // Tax codes in use for consolidation UI — includes per-account detail and totals
    type TcAccount = { account_number: string; account_name: string; bookAmt: number; taxAmt: number };
    type TcGroup = {
      tax_code_id: number; tax_code: string; description: string;
      software_code: string | null; software_description: string | null;
      export_account_number: string | null; export_description: string | null;
      account_count: number; totalBookAmt: number; totalTaxAmt: number;
      accounts: TcAccount[];
    };
    const tcGroups = new Map<number, TcGroup>();
    for (const r of rows as Record<string, unknown>[]) {
      const tcId = r.tax_code_id as number | null;
      if (!tcId) continue;
      if (!tcGroups.has(tcId)) {
        tcGroups.set(tcId, {
          tax_code_id: tcId,
          tax_code: (r.tax_code as string) ?? '',
          description: (r.tax_description as string) ?? '',
          software_code: (r.software_code as string) ?? null,
          software_description: (r.software_description as string) ?? null,
          export_account_number: (r.export_account_number as string) ?? null,
          export_description: (r.export_description as string) ?? null,
          account_count: 0, totalBookAmt: 0, totalTaxAmt: 0, accounts: [],
        });
      }
      const grp = tcGroups.get(tcId)!;
      const bookAmt = (Number(r.book_adjusted_debit ?? 0) - Number(r.book_adjusted_credit ?? 0)) / 100;
      const taxAmt = (Number(r.tax_adjusted_debit ?? 0) - Number(r.tax_adjusted_credit ?? 0)) / 100;
      grp.account_count++;
      grp.totalBookAmt += bookAmt;
      grp.totalTaxAmt += taxAmt;
      grp.accounts.push({ account_number: r.account_number as string, account_name: r.account_name as string, bookAmt, taxAmt });
    }
    const taxCodesInUse = [...tcGroups.values()].sort((a, b) => a.tax_code.localeCompare(b.tax_code));

    res.json({
      data: {
        isBalanced,
        unmappedAccounts,
        missingMappings,
        canExport: true,
        warnings,
        software,
        totalDebit: totalDr,
        totalCredit: totalCr,
        taxCodesInUse,
      },
      error: null,
    });
  } catch (err: unknown) {
    res.status(500).json({ data: null, error: { code: 'SERVER_ERROR', message: (err as Error).message } });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET ultratax  ->  Excel: AccountNumber, AccountName, TaxCode, Amount
// ─────────────────────────────────────────────────────────────────────────────

exportsRouter.get('/ultratax', async (req: AuthRequest, res: Response): Promise<void> => {
  const periodId = Number(req.params.periodId);
  if (isNaN(periodId)) {
    res.status(400).json({ data: null, error: { code: 'INVALID_ID', message: 'Invalid period ID' } });
    return;
  }
  try {
    const info = await getPeriodInfo(periodId);
    if (!info) { res.status(404).json({ data: null, error: { code: 'NOT_FOUND', message: 'Period not found' } }); return; }

    let rows = await getTbRows(periodId, 'ultratax') as Record<string, unknown>[];
    const consolidateIds = parseConsolidateParam(req.query.consolidate);
    const runtimeOverrides = parseOverridesParam(req.query.overrides);
    if (consolidateIds.size > 0) rows = consolidateRows(rows, consolidateIds, runtimeOverrides);

    const data = rows.map((r) => ({
      acct:    r.account_number,
      name:    r.account_name,
      code:    r.software_code ?? '',
      bookAmt: centsToAmt(Number(r.book_adjusted_debit ?? 0) - Number(r.book_adjusted_credit ?? 0)),
      taxAmt:  centsToAmt(Number(r.tax_adjusted_debit ?? 0) - Number(r.tax_adjusted_credit ?? 0)),
    }));

    const buffer = await buildExcel('UltraTax CS Export', [
      { header: 'AccountNumber',    key: 'acct',    width: 18 },
      { header: 'AccountName',      key: 'name',    width: 40 },
      { header: 'TaxCode',          key: 'code',    width: 18 },
      { header: 'Book Basis Amt',   key: 'bookAmt', width: 18, numFmt: '#,##0.00' },
      { header: 'Tax Basis Amt',    key: 'taxAmt',  width: 18, numFmt: '#,##0.00' },
    ], data);

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="ultratax-export-${periodId}.xlsx"`);
    res.send(buffer);
  } catch (err: unknown) {
    handleExportError(err, res);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET cch  ->  Excel: AccountNumber, AccountName, CCHCode, Description, Amount
// ─────────────────────────────────────────────────────────────────────────────

exportsRouter.get('/cch', async (req: AuthRequest, res: Response): Promise<void> => {
  const periodId = Number(req.params.periodId);
  if (isNaN(periodId)) {
    res.status(400).json({ data: null, error: { code: 'INVALID_ID', message: 'Invalid period ID' } });
    return;
  }
  try {
    const info = await getPeriodInfo(periodId);
    if (!info) { res.status(404).json({ data: null, error: { code: 'NOT_FOUND', message: 'Period not found' } }); return; }

    let rows = await getTbRows(periodId, 'cch') as Record<string, unknown>[];
    const consolidateIds = parseConsolidateParam(req.query.consolidate);
    const runtimeOverrides = parseOverridesParam(req.query.overrides);
    if (consolidateIds.size > 0) rows = consolidateRows(rows, consolidateIds, runtimeOverrides);

    const wb = new ExcelJS.Workbook();
    wb.creator = 'Trial Balance App';
    wb.created = new Date();

    const ws = wb.addWorksheet('CCH Axcess Export');
    ws.columns = [
      { header: 'AccountNumber',  key: 'acct',    width: 18 },
      { header: 'AccountName',    key: 'name',    width: 40 },
      { header: 'CCHCode',        key: 'code',    width: 18 },
      { header: 'Description',    key: 'desc',    width: 40 },
      { header: 'Book Basis Amt', key: 'bookAmt', width: 18 },
      { header: 'Tax Basis Amt',  key: 'taxAmt',  width: 18 },
    ];

    // Bold header
    ws.getRow(1).font = { bold: true };
    ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A5F' } };
    ws.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };

    for (const r of rows) {
      const row = ws.addRow({
        acct:    r.account_number,
        name:    r.account_name,
        code:    r.software_code ?? '',
        desc:    r.software_description ?? '',
        bookAmt: centsToAmt(Number(r.book_adjusted_debit ?? 0) - Number(r.book_adjusted_credit ?? 0)),
        taxAmt:  centsToAmt(Number(r.tax_adjusted_debit ?? 0) - Number(r.tax_adjusted_credit ?? 0)),
      });
      row.getCell('bookAmt').numFmt = '#,##0.00';
      row.getCell('taxAmt').numFmt = '#,##0.00';
    }

    // Freeze header row
    ws.views = [{ state: 'frozen', ySplit: 1 }];

    const buffer = await wb.xlsx.writeBuffer();
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="cch-export-${periodId}.xlsx"`);
    res.send(Buffer.from(buffer));
  } catch (err: unknown) {
    handleExportError(err, res);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET lacerte  ->  Excel: LineCode, Description, Amount
// ─────────────────────────────────────────────────────────────────────────────

exportsRouter.get('/lacerte', async (req: AuthRequest, res: Response): Promise<void> => {
  const periodId = Number(req.params.periodId);
  if (isNaN(periodId)) {
    res.status(400).json({ data: null, error: { code: 'INVALID_ID', message: 'Invalid period ID' } });
    return;
  }
  try {
    const info = await getPeriodInfo(periodId);
    if (!info) { res.status(404).json({ data: null, error: { code: 'NOT_FOUND', message: 'Period not found' } }); return; }

    let rows = await getTbRows(periodId, 'lacerte') as Record<string, unknown>[];
    const consolidateIds = parseConsolidateParam(req.query.consolidate);
    const runtimeOverrides = parseOverridesParam(req.query.overrides);
    if (consolidateIds.size > 0) rows = consolidateRows(rows, consolidateIds, runtimeOverrides);

    const data = rows.map((r) => ({
      code:    r.software_code ?? '',
      name:    r.account_name,
      bookAmt: centsToAmt(Number(r.book_adjusted_debit ?? 0) - Number(r.book_adjusted_credit ?? 0)),
      taxAmt:  centsToAmt(Number(r.tax_adjusted_debit ?? 0) - Number(r.tax_adjusted_credit ?? 0)),
    }));

    const buffer = await buildExcel('Lacerte Export', [
      { header: 'LineCode',         key: 'code',    width: 18 },
      { header: 'Description',      key: 'name',    width: 40 },
      { header: 'Book Basis Amt',   key: 'bookAmt', width: 18, numFmt: '#,##0.00' },
      { header: 'Tax Basis Amt',    key: 'taxAmt',  width: 18, numFmt: '#,##0.00' },
    ], data);

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="lacerte-export-${periodId}.xlsx"`);
    res.send(buffer);
  } catch (err: unknown) {
    handleExportError(err, res);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET gosystem  ->  Excel: LineCode, Description, Amount
// ─────────────────────────────────────────────────────────────────────────────

exportsRouter.get('/gosystem', async (req: AuthRequest, res: Response): Promise<void> => {
  const periodId = Number(req.params.periodId);
  if (isNaN(periodId)) {
    res.status(400).json({ data: null, error: { code: 'INVALID_ID', message: 'Invalid period ID' } });
    return;
  }
  try {
    const info = await getPeriodInfo(periodId);
    if (!info) { res.status(404).json({ data: null, error: { code: 'NOT_FOUND', message: 'Period not found' } }); return; }

    let rows = await getTbRows(periodId, 'gosystem') as Record<string, unknown>[];
    const consolidateIds = parseConsolidateParam(req.query.consolidate);
    const runtimeOverrides = parseOverridesParam(req.query.overrides);
    if (consolidateIds.size > 0) rows = consolidateRows(rows, consolidateIds, runtimeOverrides);

    const data = rows.map((r) => ({
      code:    r.software_code ?? '',
      name:    r.account_name,
      bookAmt: centsToAmt(Number(r.book_adjusted_debit ?? 0) - Number(r.book_adjusted_credit ?? 0)),
      taxAmt:  centsToAmt(Number(r.tax_adjusted_debit ?? 0) - Number(r.tax_adjusted_credit ?? 0)),
    }));

    const buffer = await buildExcel('GoSystem Tax RS Export', [
      { header: 'LineCode',         key: 'code',    width: 18 },
      { header: 'Description',      key: 'name',    width: 40 },
      { header: 'Book Basis Amt',   key: 'bookAmt', width: 18, numFmt: '#,##0.00' },
      { header: 'Tax Basis Amt',    key: 'taxAmt',  width: 18, numFmt: '#,##0.00' },
    ], data);

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="gosystem-export-${periodId}.xlsx"`);
    res.send(buffer);
  } catch (err: unknown) {
    handleExportError(err, res);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET generic  ->  Excel: AccountNumber, AccountName, TaxCode, TaxDescription, Amount
// ─────────────────────────────────────────────────────────────────────────────

exportsRouter.get('/generic', async (req: AuthRequest, res: Response): Promise<void> => {
  const periodId = Number(req.params.periodId);
  if (isNaN(periodId)) {
    res.status(400).json({ data: null, error: { code: 'INVALID_ID', message: 'Invalid period ID' } });
    return;
  }
  try {
    const info = await getPeriodInfo(periodId);
    if (!info) { res.status(404).json({ data: null, error: { code: 'NOT_FOUND', message: 'Period not found' } }); return; }

    let rows = await getTbRows(periodId) as Record<string, unknown>[];
    const consolidateIds = parseConsolidateParam(req.query.consolidate);
    const runtimeOverrides = parseOverridesParam(req.query.overrides);
    if (consolidateIds.size > 0) rows = consolidateRows(rows, consolidateIds, runtimeOverrides);

    const data = rows.map((r) => ({
      acct:    r.account_number,
      name:    r.account_name,
      code:    r.tax_code ?? '',
      desc:    r.tax_description ?? '',
      bookAmt: centsToAmt(Number(r.book_adjusted_debit ?? 0) - Number(r.book_adjusted_credit ?? 0)),
      taxAmt:  centsToAmt(Number(r.tax_adjusted_debit ?? 0) - Number(r.tax_adjusted_credit ?? 0)),
    }));

    const buffer = await buildExcel('Generic Export', [
      { header: 'AccountNumber',  key: 'acct',    width: 18 },
      { header: 'AccountName',    key: 'name',    width: 40 },
      { header: 'TaxCode',        key: 'code',    width: 18 },
      { header: 'TaxDescription', key: 'desc',    width: 40 },
      { header: 'Book Basis Amt', key: 'bookAmt', width: 18, numFmt: '#,##0.00' },
      { header: 'Tax Basis Amt',  key: 'taxAmt',  width: 18, numFmt: '#,##0.00' },
    ], data);

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="generic-export-${periodId}.xlsx"`);
    res.send(buffer);
  } catch (err: unknown) {
    handleExportError(err, res);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET working-tb  ->  Excel with all columns
// ─────────────────────────────────────────────────────────────────────────────
// GET/PUT consolidation-settings — per-client consolidation overrides
// ─────────────────────────────────────────────────────────────────────────────

exportsRouter.get('/consolidation-settings', async (req: AuthRequest, res: Response): Promise<void> => {
  const periodId = Number(req.params.periodId);
  if (isNaN(periodId)) { res.status(400).json({ data: null, error: { code: 'INVALID_ID', message: 'Invalid period ID' } }); return; }

  const sw = (req.query.software as string) || 'ultratax';
  try {
    const info = await getPeriodInfo(periodId);
    if (!info) { res.status(404).json({ data: null, error: { code: 'NOT_FOUND', message: 'Period not found' } }); return; }

    const rows = await db('export_consolidation_settings')
      .where({ client_id: info.client_id, tax_software: sw })
      .select('tax_code_id', 'override_account_number', 'override_description');

    const settings: Record<number, { acctNum: string; acctName: string }> = {};
    for (const r of rows) {
      settings[r.tax_code_id] = {
        acctNum: r.override_account_number ?? '',
        acctName: r.override_description ?? '',
      };
    }
    res.json({ data: settings, error: null });
  } catch (err: unknown) {
    res.status(500).json({ data: null, error: { code: 'SERVER_ERROR', message: (err as Error).message } });
  }
});

exportsRouter.put('/consolidation-settings', async (req: AuthRequest, res: Response): Promise<void> => {
  const periodId = Number(req.params.periodId);
  if (isNaN(periodId)) { res.status(400).json({ data: null, error: { code: 'INVALID_ID', message: 'Invalid period ID' } }); return; }

  const { software, settings } = req.body as {
    software: string;
    settings: Record<string, { acctNum: string; acctName: string }>;
  };
  if (!software || !settings) {
    res.status(400).json({ data: null, error: { code: 'VALIDATION_ERROR', message: 'software and settings required' } });
    return;
  }

  try {
    const info = await getPeriodInfo(periodId);
    if (!info) { res.status(404).json({ data: null, error: { code: 'NOT_FOUND', message: 'Period not found' } }); return; }

    await db.transaction(async (trx) => {
      // Remove existing settings for this client+software
      await trx('export_consolidation_settings').where({ client_id: info.client_id, tax_software: software }).delete();

      // Insert new settings
      const entries = Object.entries(settings);
      if (entries.length > 0) {
        await trx('export_consolidation_settings').insert(
          entries.map(([tcId, v]) => ({
            client_id: info.client_id,
            tax_code_id: Number(tcId),
            tax_software: software,
            override_account_number: v.acctNum || null,
            override_description: v.acctName || null,
            updated_at: trx.fn.now(),
          })),
        );
      }
    });

    res.json({ data: { saved: Object.keys(settings).length }, error: null });
  } catch (err: unknown) {
    res.status(500).json({ data: null, error: { code: 'SERVER_ERROR', message: (err as Error).message } });
  }
});

// ─────────────────────────────────────────────────────────────────────────────

exportsRouter.get('/working-tb', async (req: AuthRequest, res: Response): Promise<void> => {
  const periodId = Number(req.params.periodId);
  if (isNaN(periodId)) {
    res.status(400).json({ data: null, error: { code: 'INVALID_ID', message: 'Invalid period ID' } });
    return;
  }
  try {
    const info = await getPeriodInfo(periodId);
    if (!info) { res.status(404).json({ data: null, error: { code: 'NOT_FOUND', message: 'Period not found' } }); return; }

    const rows = await getTbRows(periodId) as Record<string, unknown>[];

    const wb = new ExcelJS.Workbook();
    wb.creator = 'Trial Balance App';
    wb.created = new Date();

    const ws = wb.addWorksheet('Working Trial Balance');

    // Title rows
    ws.addRow([`${info.client_name} — ${info.name}`]);
    ws.getRow(1).font = { bold: true, size: 12 };
    ws.addRow([`Working Trial Balance as of ${fmtDate(info.end_date)}`]);
    ws.addRow([]);

    ws.columns = [
      { key: 'acct_num',       width: 16 },
      { key: 'acct_name',      width: 38 },
      { key: 'category',       width: 14 },
      { key: 'unadj_dr',       width: 16 },
      { key: 'unadj_cr',       width: 16 },
      { key: 'book_adj_dr',    width: 16 },
      { key: 'book_adj_cr',    width: 16 },
      { key: 'tax_adj_dr',     width: 16 },
      { key: 'tax_adj_cr',     width: 16 },
      { key: 'book_bal',       width: 16 },
      { key: 'tax_bal',        width: 16 },
    ];

    // Header row (row 4)
    const headerRow = ws.addRow([
      'AccountNumber', 'AccountName', 'Category',
      'UnadjDR', 'UnadjCR',
      'BookAdjDR', 'BookAdjCR',
      'TaxAdjDR', 'TaxAdjCR',
      'BookAdjBalance', 'TaxAdjBalance',
    ]);
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A5F' } };
    headerRow.alignment = { horizontal: 'center' };

    const dollarFmt = '#,##0.00';
    const amtCols = [4, 5, 6, 7, 8, 9, 10, 11]; // 1-indexed columns D-K

    for (const r of rows) {
      const nb      = r.normal_balance as string;
      const bookBal = nb === 'debit'
        ? (Number(r.book_adjusted_debit ?? 0) - Number(r.book_adjusted_credit ?? 0)) / 100
        : (Number(r.book_adjusted_credit ?? 0) - Number(r.book_adjusted_debit ?? 0)) / 100;
      const taxBal  = nb === 'debit'
        ? (Number(r.tax_adjusted_debit ?? 0)  - Number(r.tax_adjusted_credit ?? 0))  / 100
        : (Number(r.tax_adjusted_credit ?? 0) - Number(r.tax_adjusted_debit ?? 0))   / 100;

      const dataRow = ws.addRow([
        r.account_number,
        r.account_name,
        r.category,
        Number(r.unadjusted_debit   ?? 0) / 100,
        Number(r.unadjusted_credit  ?? 0) / 100,
        Number(r.book_adj_debit     ?? 0) / 100,
        Number(r.book_adj_credit    ?? 0) / 100,
        Number(r.tax_adj_debit      ?? 0) / 100,
        Number(r.tax_adj_credit     ?? 0) / 100,
        bookBal,
        taxBal,
      ]);

      // Format amount cells
      for (const col of amtCols) {
        dataRow.getCell(col).numFmt = dollarFmt;
      }
    }

    // Freeze header rows (first 4 rows)
    ws.views = [{ state: 'frozen', ySplit: 4 }];

    const buffer = await wb.xlsx.writeBuffer();
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="working-tb-${periodId}.xlsx"`);
    res.send(Buffer.from(buffer));
  } catch (err: unknown) {
    res.status(500).json({ data: null, error: { code: 'SERVER_ERROR', message: (err as Error).message } });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET bookkeeper-letter  ->  PDF (pdfmake) — Book AJEs only
// ─────────────────────────────────────────────────────────────────────────────

exportsRouter.get('/bookkeeper-letter', async (req: AuthRequest, res: Response): Promise<void> => {
  const periodId = Number(req.params.periodId);
  if (isNaN(periodId)) {
    res.status(400).json({ data: null, error: { code: 'INVALID_ID', message: 'Invalid period ID' } });
    return;
  }
  try {
    const info = await getPeriodInfo(periodId);
    if (!info) { res.status(404).json({ data: null, error: { code: 'NOT_FOUND', message: 'Period not found' } }); return; }

    // Fetch book AJEs only
    const entries = await db('journal_entries')
      .where({ period_id: periodId, entry_type: 'book' })
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
          .orderBy('jel.journal_entry_id')
      : [];

    const linesByEntry = new Map<number, typeof lines>();
    for (const l of lines as Record<string, unknown>[]) {
      const eid = l.journal_entry_id as number;
      if (!linesByEntry.has(eid)) linesByEntry.set(eid, []);
      linesByEntry.get(eid)!.push(l);
    }

    const svc = await PdfTemplateService.fromDb(db);

    const cols = ['Entry #', 'Date', 'Description', 'Account', 'Debit', 'Credit'];
    const widths = [40, 60, '*', '*', 65, 65];

    const tableBody: TableCell[][] = [svc.headerRow(cols)];
    let totalDr = 0;
    let totalCr = 0;
    let rowIdx = 0;

    for (const entry of entries as Record<string, unknown>[]) {
      const entryLines = linesByEntry.get(entry.id as number) ?? [];
      let firstLine = true;

      for (const line of entryLines as Record<string, unknown>[]) {
        const dr = Number((line as Record<string, unknown>).debit  ?? 0);
        const cr = Number((line as Record<string, unknown>).credit ?? 0);
        totalDr += dr;
        totalCr += cr;

        tableBody.push(svc.dataRow([
          firstLine ? String(entry.entry_number ?? '') : '',
          firstLine ? fmtDate(entry.entry_date as string) : '',
          firstLine ? (entry.description as string ?? '') : '',
          `${(line as Record<string, unknown>).account_number} ${(line as Record<string, unknown>).account_name}`,
          dr,
          cr,
        ], { isAlt: rowIdx % 2 === 1 }));

        firstLine = false;
        rowIdx++;
      }
    }

    tableBody.push(svc.dataRow(
      ['', '', '', 'TOTALS', totalDr, totalCr],
      { bold: true, shade: true },
    ));

    const introText: Content[] = entries.length === 0
      ? [{ text: 'No book adjusting journal entries found for this period.', fontSize: 9, margin: [0, 0, 0, 12] as [number, number, number, number] }]
      : [
          {
            text: `The following ${entries.length} proposed adjusting journal entr${entries.length === 1 ? 'y has' : 'ies have'} been prepared for the period ending ${fmtDate(info.end_date)}. Please review and post these entries to your accounting system.`,
            fontSize: 9,
            margin: [0, 0, 0, 12] as [number, number, number, number],
          },
        ];

    const content: Content[] = [
      ...introText,
      {
        table: { headerRows: 1, widths, body: tableBody },
        layout: {
          hLineWidth: (i: number) => (i === 0 || i === 1) ? 1 : 0,
          vLineWidth: () => 0,
          hLineColor: () => '#cccccc',
          paddingLeft: () => 2,
          paddingRight: () => 2,
        },
      },
      {
        text: `Total Adjustments: ${entries.length}`,
        fontSize: 8,
        bold: true,
        margin: [0, 8, 0, 0] as [number, number, number, number],
      },
    ];

    const buffer = await svc.generateBuffer(svc.buildDocument({
      title:      'Proposed Adjusting Journal Entries',
      clientName: info.client_name,
      ein:        info.ein ?? undefined,
      periodName: info.name,
      startDate:  fmtDate(info.start_date),
      endDate:    fmtDate(info.end_date),
      content,
    }));

    const preview = req.query.preview === 'true' || req.query.preview === '1';
    const disposition = preview
      ? `inline; filename="bookkeeper-letter-${periodId}.pdf"`
      : `attachment; filename="bookkeeper-letter-${periodId}.pdf"`;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', disposition);
    res.setHeader('Content-Length', String(buffer.length));
    res.send(buffer);
  } catch (err: unknown) {
    res.status(500).json({ data: null, error: { code: 'SERVER_ERROR', message: (err as Error).message } });
  }
});
