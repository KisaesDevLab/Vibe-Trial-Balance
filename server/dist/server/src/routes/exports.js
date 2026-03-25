"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.exportsRouter = void 0;
/**
 * Phase 9: Exports
 * GET /api/v1/periods/:periodId/exports/ultratax     -> CSV
 * GET /api/v1/periods/:periodId/exports/cch          -> Excel (.xlsx)
 * GET /api/v1/periods/:periodId/exports/lacerte      -> CSV
 * GET /api/v1/periods/:periodId/exports/gosystem     -> CSV
 * GET /api/v1/periods/:periodId/exports/generic      -> CSV
 * GET /api/v1/periods/:periodId/exports/working-tb   -> Excel (.xlsx)
 * GET /api/v1/periods/:periodId/exports/bookkeeper-letter -> PDF
 * GET /api/v1/periods/:periodId/exports/validate     -> JSON
 */
const express_1 = require("express");
const exceljs_1 = __importDefault(require("exceljs"));
const db_1 = require("../db");
const auth_1 = require("../middleware/auth");
const PdfTemplateService_1 = require("../pdf/PdfTemplateService");
exports.exportsRouter = (0, express_1.Router)({ mergeParams: true });
exports.exportsRouter.use(auth_1.authMiddleware);
async function getPeriodInfo(periodId) {
    const row = await (0, db_1.db)('periods as p')
        .join('clients as c', 'c.id', 'p.client_id')
        .where('p.id', periodId)
        .select('p.id', 'p.period_name as name', 'p.start_date', 'p.end_date', 'p.client_id', 'c.name as client_name', 'c.tax_id as ein', 'c.entity_type', 'c.default_tax_software')
        .first();
    return row ?? null;
}
function fmtDate(d) {
    if (!d)
        return '';
    return new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}
/** cents -> dollar string (e.g. 123456 -> "1234.56") */
function centsToAmt(cents) {
    return (cents ?? 0) / 100;
}
/** Escape a value for CSV */
function csvCell(v) {
    if (v === null || v === undefined)
        return '';
    const s = String(v);
    if (s.includes(',') || s.includes('"') || s.includes('\n')) {
        return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
}
function csvRow(cells) {
    return cells.map(csvCell).join(',');
}
/**
 * Compute the natural net balance for a TB row in dollars.
 * Positive = normal balance direction for that account type.
 * Debit-normal (assets, expenses): positive when DR > CR.
 * Credit-normal (liabilities, equity, revenue): positive when CR > DR.
 */
function netBalance(r) {
    const dr = Number(r.tax_adjusted_debit ?? 0);
    const cr = Number(r.tax_adjusted_credit ?? 0);
    return r.normal_balance === 'debit' ? (dr - cr) / 100 : (cr - dr) / 100;
}
// ─────────────────────────────────────────────────────────────────────────────
// TB data query — joins COA + tax codes + software maps
// ─────────────────────────────────────────────────────────────────────────────
async function getTbRows(periodId, software) {
    let q = (0, db_1.db)('v_adjusted_trial_balance as tb')
        .join('chart_of_accounts as coa', 'coa.id', 'tb.account_id')
        .leftJoin('tax_codes as tc', 'tc.id', 'coa.tax_code_id')
        .where('tb.period_id', periodId)
        .where('tb.is_active', true)
        .select('tb.account_id', 'coa.account_number', 'coa.account_name', 'coa.category', 'coa.tax_code_id', 'tc.tax_code', 'tc.description as tax_description', 'tc.sort_order as tc_sort_order', 'tb.unadjusted_debit', 'tb.unadjusted_credit', 'tb.book_adj_debit', 'tb.book_adj_credit', 'tb.tax_adj_debit', 'tb.tax_adj_credit', 'tb.book_adjusted_debit', 'tb.book_adjusted_credit', 'tb.tax_adjusted_debit', 'tb.tax_adjusted_credit');
    // Always include normal_balance so sign convention can be applied correctly
    q = q.select('coa.normal_balance');
    if (software) {
        q = q
            .leftJoin('tax_code_software_maps as tcsm', function () {
            this.on('tcsm.tax_code_id', '=', 'coa.tax_code_id')
                .andOn(db_1.db.raw('tcsm.tax_software = ?', [software]))
                .andOn(db_1.db.raw('tcsm.is_active = true'));
        })
            .select('tcsm.software_code', 'tcsm.software_description');
    }
    return q.orderBy('coa.account_number', 'asc');
}
// ─────────────────────────────────────────────────────────────────────────────
// GET validate
// ─────────────────────────────────────────────────────────────────────────────
exports.exportsRouter.get('/validate', async (req, res) => {
    const periodId = Number(req.params.periodId);
    if (isNaN(periodId)) {
        res.status(400).json({ data: null, error: { code: 'INVALID_ID', message: 'Invalid period ID' } });
        return;
    }
    const software = req.query.software ?? 'ultratax';
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
        for (const r of rows) {
            totalDr += Number(r.unadjusted_debit ?? 0);
            totalCr += Number(r.unadjusted_credit ?? 0);
        }
        const isBalanced = totalDr === totalCr;
        // Unmapped accounts (no tax_code_id)
        const unmappedAccounts = rows
            .filter((r) => !r.tax_code_id)
            .map((r) => ({ account_id: r.account_id, account_number: r.account_number, account_name: r.account_name }));
        // Missing software mappings (has tax_code_id but no software_code for selected software)
        const missingMappings = rows
            .filter((r) => r.tax_code_id && !r.software_code)
            .map((r) => ({
            account_id: r.account_id,
            account_number: r.account_number,
            account_name: r.account_name,
            tax_code: r.tax_code,
        }));
        const warnings = [];
        if (!isBalanced) {
            warnings.push(`Trial balance is out of balance (DR: ${(totalDr / 100).toFixed(2)} vs CR: ${(totalCr / 100).toFixed(2)})`);
        }
        if (unmappedAccounts.length > 0) {
            warnings.push(`${unmappedAccounts.length} account(s) have no tax code assigned`);
        }
        if (missingMappings.length > 0) {
            warnings.push(`${missingMappings.length} account(s) have a tax code but no ${software} software mapping`);
        }
        res.json({
            data: {
                isBalanced,
                unmappedAccounts,
                missingMappings,
                canExport: true, // always allow (warnings only, not blockers)
                warnings,
                software,
                totalDebit: totalDr,
                totalCredit: totalCr,
            },
            error: null,
        });
    }
    catch (err) {
        res.status(500).json({ data: null, error: { code: 'SERVER_ERROR', message: err.message } });
    }
});
// ─────────────────────────────────────────────────────────────────────────────
// GET ultratax  ->  CSV: AccountNumber, AccountName, TaxCode, Amount
// ─────────────────────────────────────────────────────────────────────────────
exports.exportsRouter.get('/ultratax', async (req, res) => {
    const periodId = Number(req.params.periodId);
    if (isNaN(periodId)) {
        res.status(400).json({ data: null, error: { code: 'INVALID_ID', message: 'Invalid period ID' } });
        return;
    }
    try {
        const info = await getPeriodInfo(periodId);
        if (!info) {
            res.status(404).json({ data: null, error: { code: 'NOT_FOUND', message: 'Period not found' } });
            return;
        }
        const rows = await getTbRows(periodId, 'ultratax');
        const lines = [csvRow(['AccountNumber', 'AccountName', 'TaxCode', 'Amount'])];
        for (const r of rows) {
            lines.push(csvRow([
                r.account_number,
                r.account_name,
                r.software_code ?? '',
                centsToAmt(Number(r.tax_adjusted_debit ?? 0) - Number(r.tax_adjusted_credit ?? 0)),
            ]));
        }
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="ultratax-export-${periodId}.csv"`);
        res.send(lines.join('\n'));
    }
    catch (err) {
        res.status(500).json({ data: null, error: { code: 'SERVER_ERROR', message: err.message } });
    }
});
// ─────────────────────────────────────────────────────────────────────────────
// GET cch  ->  Excel: AccountNumber, AccountName, CCHCode, Description, Amount
// ─────────────────────────────────────────────────────────────────────────────
exports.exportsRouter.get('/cch', async (req, res) => {
    const periodId = Number(req.params.periodId);
    if (isNaN(periodId)) {
        res.status(400).json({ data: null, error: { code: 'INVALID_ID', message: 'Invalid period ID' } });
        return;
    }
    try {
        const info = await getPeriodInfo(periodId);
        if (!info) {
            res.status(404).json({ data: null, error: { code: 'NOT_FOUND', message: 'Period not found' } });
            return;
        }
        const rows = await getTbRows(periodId, 'cch');
        const wb = new exceljs_1.default.Workbook();
        wb.creator = 'Trial Balance App';
        wb.created = new Date();
        const ws = wb.addWorksheet('CCH Axcess Export');
        ws.columns = [
            { header: 'AccountNumber', key: 'acct', width: 18 },
            { header: 'AccountName', key: 'name', width: 40 },
            { header: 'CCHCode', key: 'code', width: 18 },
            { header: 'Description', key: 'desc', width: 40 },
            { header: 'Amount', key: 'amount', width: 18 },
        ];
        // Bold header
        ws.getRow(1).font = { bold: true };
        ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A5F' } };
        ws.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
        for (const r of rows) {
            ws.addRow({
                acct: r.account_number,
                name: r.account_name,
                code: r.software_code ?? '',
                desc: r.software_description ?? '',
                amount: centsToAmt(Number(r.tax_adjusted_debit ?? 0) - Number(r.tax_adjusted_credit ?? 0)),
            });
        }
        // Freeze header row
        ws.views = [{ state: 'frozen', ySplit: 1 }];
        const buffer = await wb.xlsx.writeBuffer();
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="cch-export-${periodId}.xlsx"`);
        res.send(Buffer.from(buffer));
    }
    catch (err) {
        res.status(500).json({ data: null, error: { code: 'SERVER_ERROR', message: err.message } });
    }
});
// ─────────────────────────────────────────────────────────────────────────────
// GET lacerte  ->  CSV: LineCode, Description, Amount
// ─────────────────────────────────────────────────────────────────────────────
exports.exportsRouter.get('/lacerte', async (req, res) => {
    const periodId = Number(req.params.periodId);
    if (isNaN(periodId)) {
        res.status(400).json({ data: null, error: { code: 'INVALID_ID', message: 'Invalid period ID' } });
        return;
    }
    try {
        const info = await getPeriodInfo(periodId);
        if (!info) {
            res.status(404).json({ data: null, error: { code: 'NOT_FOUND', message: 'Period not found' } });
            return;
        }
        const rows = await getTbRows(periodId, 'lacerte');
        const lines = [csvRow(['LineCode', 'Description', 'Amount'])];
        for (const r of rows) {
            lines.push(csvRow([
                r.software_code ?? '',
                r.account_name,
                centsToAmt(Number(r.tax_adjusted_debit ?? 0) - Number(r.tax_adjusted_credit ?? 0)),
            ]));
        }
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="lacerte-export-${periodId}.csv"`);
        res.send(lines.join('\n'));
    }
    catch (err) {
        res.status(500).json({ data: null, error: { code: 'SERVER_ERROR', message: err.message } });
    }
});
// ─────────────────────────────────────────────────────────────────────────────
// GET gosystem  ->  CSV: LineCode, Description, Amount
// ─────────────────────────────────────────────────────────────────────────────
exports.exportsRouter.get('/gosystem', async (req, res) => {
    const periodId = Number(req.params.periodId);
    if (isNaN(periodId)) {
        res.status(400).json({ data: null, error: { code: 'INVALID_ID', message: 'Invalid period ID' } });
        return;
    }
    try {
        const info = await getPeriodInfo(periodId);
        if (!info) {
            res.status(404).json({ data: null, error: { code: 'NOT_FOUND', message: 'Period not found' } });
            return;
        }
        const rows = await getTbRows(periodId, 'gosystem');
        const lines = [csvRow(['LineCode', 'Description', 'Amount'])];
        for (const r of rows) {
            lines.push(csvRow([
                r.software_code ?? '',
                r.account_name,
                centsToAmt(Number(r.tax_adjusted_debit ?? 0) - Number(r.tax_adjusted_credit ?? 0)),
            ]));
        }
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="gosystem-export-${periodId}.csv"`);
        res.send(lines.join('\n'));
    }
    catch (err) {
        res.status(500).json({ data: null, error: { code: 'SERVER_ERROR', message: err.message } });
    }
});
// ─────────────────────────────────────────────────────────────────────────────
// GET generic  ->  CSV: AccountNumber, AccountName, TaxCode, TaxDescription, Amount
// ─────────────────────────────────────────────────────────────────────────────
exports.exportsRouter.get('/generic', async (req, res) => {
    const periodId = Number(req.params.periodId);
    if (isNaN(periodId)) {
        res.status(400).json({ data: null, error: { code: 'INVALID_ID', message: 'Invalid period ID' } });
        return;
    }
    try {
        const info = await getPeriodInfo(periodId);
        if (!info) {
            res.status(404).json({ data: null, error: { code: 'NOT_FOUND', message: 'Period not found' } });
            return;
        }
        const rows = await getTbRows(periodId);
        const lines = [csvRow(['AccountNumber', 'AccountName', 'TaxCode', 'TaxDescription', 'Amount'])];
        for (const r of rows) {
            lines.push(csvRow([
                r.account_number,
                r.account_name,
                r.tax_code ?? '',
                r.tax_description ?? '',
                centsToAmt(Number(r.tax_adjusted_debit ?? 0) - Number(r.tax_adjusted_credit ?? 0)),
            ]));
        }
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="generic-export-${periodId}.csv"`);
        res.send(lines.join('\n'));
    }
    catch (err) {
        res.status(500).json({ data: null, error: { code: 'SERVER_ERROR', message: err.message } });
    }
});
// ─────────────────────────────────────────────────────────────────────────────
// GET working-tb  ->  Excel with all columns
// ─────────────────────────────────────────────────────────────────────────────
exports.exportsRouter.get('/working-tb', async (req, res) => {
    const periodId = Number(req.params.periodId);
    if (isNaN(periodId)) {
        res.status(400).json({ data: null, error: { code: 'INVALID_ID', message: 'Invalid period ID' } });
        return;
    }
    try {
        const info = await getPeriodInfo(periodId);
        if (!info) {
            res.status(404).json({ data: null, error: { code: 'NOT_FOUND', message: 'Period not found' } });
            return;
        }
        const rows = await getTbRows(periodId);
        const wb = new exceljs_1.default.Workbook();
        wb.creator = 'Trial Balance App';
        wb.created = new Date();
        const ws = wb.addWorksheet('Working Trial Balance');
        // Title rows
        ws.addRow([`${info.client_name} — ${info.name}`]);
        ws.getRow(1).font = { bold: true, size: 12 };
        ws.addRow([`Working Trial Balance as of ${fmtDate(info.end_date)}`]);
        ws.addRow([]);
        ws.columns = [
            { key: 'acct_num', width: 16 },
            { key: 'acct_name', width: 38 },
            { key: 'category', width: 14 },
            { key: 'unadj_dr', width: 16 },
            { key: 'unadj_cr', width: 16 },
            { key: 'book_adj_dr', width: 16 },
            { key: 'book_adj_cr', width: 16 },
            { key: 'tax_adj_dr', width: 16 },
            { key: 'tax_adj_cr', width: 16 },
            { key: 'book_bal', width: 16 },
            { key: 'tax_bal', width: 16 },
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
            const nb = r.normal_balance;
            const bookBal = nb === 'debit'
                ? (Number(r.book_adjusted_debit ?? 0) - Number(r.book_adjusted_credit ?? 0)) / 100
                : (Number(r.book_adjusted_credit ?? 0) - Number(r.book_adjusted_debit ?? 0)) / 100;
            const taxBal = nb === 'debit'
                ? (Number(r.tax_adjusted_debit ?? 0) - Number(r.tax_adjusted_credit ?? 0)) / 100
                : (Number(r.tax_adjusted_credit ?? 0) - Number(r.tax_adjusted_debit ?? 0)) / 100;
            const dataRow = ws.addRow([
                r.account_number,
                r.account_name,
                r.category,
                Number(r.unadjusted_debit ?? 0) / 100,
                Number(r.unadjusted_credit ?? 0) / 100,
                Number(r.book_adj_debit ?? 0) / 100,
                Number(r.book_adj_credit ?? 0) / 100,
                Number(r.tax_adj_debit ?? 0) / 100,
                Number(r.tax_adj_credit ?? 0) / 100,
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
    }
    catch (err) {
        res.status(500).json({ data: null, error: { code: 'SERVER_ERROR', message: err.message } });
    }
});
// ─────────────────────────────────────────────────────────────────────────────
// GET bookkeeper-letter  ->  PDF (pdfmake) — Book AJEs only
// ─────────────────────────────────────────────────────────────────────────────
exports.exportsRouter.get('/bookkeeper-letter', async (req, res) => {
    const periodId = Number(req.params.periodId);
    if (isNaN(periodId)) {
        res.status(400).json({ data: null, error: { code: 'INVALID_ID', message: 'Invalid period ID' } });
        return;
    }
    try {
        const info = await getPeriodInfo(periodId);
        if (!info) {
            res.status(404).json({ data: null, error: { code: 'NOT_FOUND', message: 'Period not found' } });
            return;
        }
        // Fetch book AJEs only
        const entries = await (0, db_1.db)('journal_entries')
            .where({ period_id: periodId, entry_type: 'book' })
            .orderBy('entry_number');
        const entryIds = entries.map((e) => e.id);
        const lines = entryIds.length > 0
            ? await (0, db_1.db)('journal_entry_lines as jel')
                .whereIn('jel.journal_entry_id', entryIds)
                .join('chart_of_accounts as coa', 'coa.id', 'jel.account_id')
                .select('jel.journal_entry_id', 'coa.account_number', 'coa.account_name', 'jel.debit', 'jel.credit')
                .orderBy('jel.journal_entry_id')
            : [];
        const linesByEntry = new Map();
        for (const l of lines) {
            const eid = l.journal_entry_id;
            if (!linesByEntry.has(eid))
                linesByEntry.set(eid, []);
            linesByEntry.get(eid).push(l);
        }
        const svc = await PdfTemplateService_1.PdfTemplateService.fromDb(db_1.db);
        const cols = ['Entry #', 'Date', 'Description', 'Account', 'Debit', 'Credit'];
        const widths = [40, 60, '*', '*', 65, 65];
        const tableBody = [svc.headerRow(cols)];
        let totalDr = 0;
        let totalCr = 0;
        let rowIdx = 0;
        for (const entry of entries) {
            const entryLines = linesByEntry.get(entry.id) ?? [];
            let firstLine = true;
            for (const line of entryLines) {
                const dr = Number(line.debit ?? 0);
                const cr = Number(line.credit ?? 0);
                totalDr += dr;
                totalCr += cr;
                tableBody.push(svc.dataRow([
                    firstLine ? String(entry.entry_number ?? '') : '',
                    firstLine ? fmtDate(entry.entry_date) : '',
                    firstLine ? (entry.description ?? '') : '',
                    `${line.account_number} ${line.account_name}`,
                    dr,
                    cr,
                ], { isAlt: rowIdx % 2 === 1 }));
                firstLine = false;
                rowIdx++;
            }
        }
        tableBody.push(svc.dataRow(['', '', '', 'TOTALS', totalDr, totalCr], { bold: true, shade: true }));
        const introText = entries.length === 0
            ? [{ text: 'No book adjusting journal entries found for this period.', fontSize: 9, margin: [0, 0, 0, 12] }]
            : [
                {
                    text: `The following ${entries.length} proposed adjusting journal entr${entries.length === 1 ? 'y has' : 'ies have'} been prepared for the period ending ${fmtDate(info.end_date)}. Please review and post these entries to your accounting system.`,
                    fontSize: 9,
                    margin: [0, 0, 0, 12],
                },
            ];
        const content = [
            ...introText,
            {
                table: { headerRows: 1, widths, body: tableBody },
                layout: {
                    hLineWidth: (i) => (i === 0 || i === 1) ? 1 : 0,
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
                margin: [0, 8, 0, 0],
            },
        ];
        const buffer = await svc.generateBuffer(svc.buildDocument({
            title: 'Proposed Adjusting Journal Entries',
            clientName: info.client_name,
            ein: info.ein ?? undefined,
            periodName: info.name,
            startDate: fmtDate(info.start_date),
            endDate: fmtDate(info.end_date),
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
    }
    catch (err) {
        res.status(500).json({ data: null, error: { code: 'SERVER_ERROR', message: err.message } });
    }
});
//# sourceMappingURL=exports.js.map