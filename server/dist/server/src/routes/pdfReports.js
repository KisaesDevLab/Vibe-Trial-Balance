"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.pdfReportsRouter = void 0;
const express_1 = require("express");
const db_1 = require("../db");
const auth_1 = require("../middleware/auth");
const reportGenerators_1 = require("../pdf/reportGenerators");
exports.pdfReportsRouter = (0, express_1.Router)({ mergeParams: true });
exports.pdfReportsRouter.use(auth_1.authMiddleware);
// ─────────────────────────────────────────────────────────────────────────────
// Shared helpers
// ─────────────────────────────────────────────────────────────────────────────
function sendPdf(res, buffer, filename, preview) {
    const disposition = preview
        ? `inline; filename="${filename}"`
        : `attachment; filename="${filename}"`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', disposition);
    res.setHeader('Content-Length', String(buffer.length));
    res.send(buffer);
}
function getPeriodId(req) {
    const id = Number(req.params.periodId);
    return isNaN(id) ? null : id;
}
function isPreview(req) {
    return req.query.preview === 'true' || req.query.preview === '1';
}
// ─────────────────────────────────────────────────────────────────────────────
// GET /api/v1/reports/periods/:periodId/flux/:comparePeriodId
// ─────────────────────────────────────────────────────────────────────────────
exports.pdfReportsRouter.get('/periods/:periodId/flux/:comparePeriodId', async (req, res) => {
    const periodId = getPeriodId(req);
    const comparePeriodId = Number(req.params.comparePeriodId);
    if (periodId === null || isNaN(comparePeriodId)) {
        res.status(400).json({ data: null, error: { code: 'INVALID_ID', message: 'Invalid period IDs' } });
        return;
    }
    try {
        const buffer = await (0, reportGenerators_1.generateFluxAnalysisPdf)(db_1.db, periodId, comparePeriodId);
        sendPdf(res, buffer, `flux-analysis-${periodId}-vs-${comparePeriodId}.pdf`, isPreview(req));
    }
    catch (err) {
        const e = err;
        res.status(e.status ?? 500).json({ data: null, error: { code: e.code ?? 'SERVER_ERROR', message: e.message ?? 'Unknown error' } });
    }
});
// ─────────────────────────────────────────────────────────────────────────────
// GET /api/v1/reports/periods/:periodId/trial-balance
// ─────────────────────────────────────────────────────────────────────────────
exports.pdfReportsRouter.get('/periods/:periodId/trial-balance', async (req, res) => {
    const periodId = getPeriodId(req);
    if (periodId === null) {
        res.status(400).json({ data: null, error: { code: 'INVALID_ID', message: 'Invalid period ID' } });
        return;
    }
    try {
        const buffer = await (0, reportGenerators_1.generateTrialBalancePdf)(db_1.db, periodId);
        sendPdf(res, buffer, `trial-balance-${periodId}.pdf`, isPreview(req));
    }
    catch (err) {
        const e = err;
        const status = e.status ?? 500;
        res.status(status).json({ data: null, error: { code: e.code ?? 'SERVER_ERROR', message: e.message ?? 'Unknown error' } });
    }
});
// ─────────────────────────────────────────────────────────────────────────────
// GET /api/v1/reports/periods/:periodId/journal-entries?type=book|tax|all
// ─────────────────────────────────────────────────────────────────────────────
exports.pdfReportsRouter.get('/periods/:periodId/journal-entries', async (req, res) => {
    const periodId = getPeriodId(req);
    if (periodId === null) {
        res.status(400).json({ data: null, error: { code: 'INVALID_ID', message: 'Invalid period ID' } });
        return;
    }
    const typeFilter = typeof req.query.type === 'string' ? req.query.type : 'all';
    try {
        const buffer = await (0, reportGenerators_1.generateJournalEntryListingPdf)(db_1.db, periodId, typeFilter);
        sendPdf(res, buffer, `journal-entries-${periodId}.pdf`, isPreview(req));
    }
    catch (err) {
        const e = err;
        res.status(e.status ?? 500).json({ data: null, error: { code: e.code ?? 'SERVER_ERROR', message: e.message ?? 'Unknown error' } });
    }
});
// ─────────────────────────────────────────────────────────────────────────────
// GET /api/v1/reports/periods/:periodId/aje-listing
// ─────────────────────────────────────────────────────────────────────────────
exports.pdfReportsRouter.get('/periods/:periodId/aje-listing', async (req, res) => {
    const periodId = getPeriodId(req);
    if (periodId === null) {
        res.status(400).json({ data: null, error: { code: 'INVALID_ID', message: 'Invalid period ID' } });
        return;
    }
    try {
        const buffer = await (0, reportGenerators_1.generateAjeListingPdf)(db_1.db, periodId);
        sendPdf(res, buffer, `aje-listing-${periodId}.pdf`, isPreview(req));
    }
    catch (err) {
        const e = err;
        res.status(e.status ?? 500).json({ data: null, error: { code: e.code ?? 'SERVER_ERROR', message: e.message ?? 'Unknown error' } });
    }
});
// ─────────────────────────────────────────────────────────────────────────────
// GET /api/v1/reports/periods/:periodId/general-ledger?accountId=
// ─────────────────────────────────────────────────────────────────────────────
exports.pdfReportsRouter.get('/periods/:periodId/general-ledger', async (req, res) => {
    const periodId = getPeriodId(req);
    if (periodId === null) {
        res.status(400).json({ data: null, error: { code: 'INVALID_ID', message: 'Invalid period ID' } });
        return;
    }
    const accountId = req.query.accountId ? Number(req.query.accountId) : undefined;
    if (req.query.accountId && isNaN(accountId)) {
        res.status(400).json({ data: null, error: { code: 'INVALID_ID', message: 'Invalid account ID' } });
        return;
    }
    try {
        const buffer = await (0, reportGenerators_1.generateGeneralLedgerPdf)(db_1.db, periodId, accountId);
        sendPdf(res, buffer, `general-ledger-${periodId}.pdf`, isPreview(req));
    }
    catch (err) {
        const e = err;
        res.status(e.status ?? 500).json({ data: null, error: { code: e.code ?? 'SERVER_ERROR', message: e.message ?? 'Unknown error' } });
    }
});
// ─────────────────────────────────────────────────────────────────────────────
// GET /api/v1/reports/periods/:periodId/income-statement?priorYear=true
// ─────────────────────────────────────────────────────────────────────────────
exports.pdfReportsRouter.get('/periods/:periodId/income-statement', async (req, res) => {
    const periodId = getPeriodId(req);
    if (periodId === null) {
        res.status(400).json({ data: null, error: { code: 'INVALID_ID', message: 'Invalid period ID' } });
        return;
    }
    const includePY = req.query.priorYear === 'true' || req.query.priorYear === '1';
    try {
        const buffer = await (0, reportGenerators_1.generateIncomeStatementPdf)(db_1.db, periodId, includePY);
        sendPdf(res, buffer, `income-statement-${periodId}.pdf`, isPreview(req));
    }
    catch (err) {
        const e = err;
        res.status(e.status ?? 500).json({ data: null, error: { code: e.code ?? 'SERVER_ERROR', message: e.message ?? 'Unknown error' } });
    }
});
// ─────────────────────────────────────────────────────────────────────────────
// GET /api/v1/reports/periods/:periodId/balance-sheet
// ─────────────────────────────────────────────────────────────────────────────
exports.pdfReportsRouter.get('/periods/:periodId/balance-sheet', async (req, res) => {
    const periodId = getPeriodId(req);
    if (periodId === null) {
        res.status(400).json({ data: null, error: { code: 'INVALID_ID', message: 'Invalid period ID' } });
        return;
    }
    try {
        const buffer = await (0, reportGenerators_1.generateBalanceSheetPdf)(db_1.db, periodId);
        sendPdf(res, buffer, `balance-sheet-${periodId}.pdf`, isPreview(req));
    }
    catch (err) {
        const e = err;
        res.status(e.status ?? 500).json({ data: null, error: { code: e.code ?? 'SERVER_ERROR', message: e.message ?? 'Unknown error' } });
    }
});
// ─────────────────────────────────────────────────────────────────────────────
// GET /api/v1/reports/periods/:periodId/tax-code-report
// ─────────────────────────────────────────────────────────────────────────────
exports.pdfReportsRouter.get('/periods/:periodId/tax-code-report', async (req, res) => {
    const periodId = getPeriodId(req);
    if (periodId === null) {
        res.status(400).json({ data: null, error: { code: 'INVALID_ID', message: 'Invalid period ID' } });
        return;
    }
    try {
        const buffer = await (0, reportGenerators_1.generateTaxCodeReportPdf)(db_1.db, periodId);
        sendPdf(res, buffer, `tax-code-report-${periodId}.pdf`, isPreview(req));
    }
    catch (err) {
        const e = err;
        res.status(e.status ?? 500).json({ data: null, error: { code: e.code ?? 'SERVER_ERROR', message: e.message ?? 'Unknown error' } });
    }
});
// ─────────────────────────────────────────────────────────────────────────────
// GET /api/v1/reports/periods/:periodId/workpaper-index
// ─────────────────────────────────────────────────────────────────────────────
exports.pdfReportsRouter.get('/periods/:periodId/workpaper-index', async (req, res) => {
    const periodId = getPeriodId(req);
    if (periodId === null) {
        res.status(400).json({ data: null, error: { code: 'INVALID_ID', message: 'Invalid period ID' } });
        return;
    }
    try {
        const buffer = await (0, reportGenerators_1.generateWorkpaperIndexPdf)(db_1.db, periodId);
        sendPdf(res, buffer, `workpaper-index-${periodId}.pdf`, isPreview(req));
    }
    catch (err) {
        const e = err;
        res.status(e.status ?? 500).json({ data: null, error: { code: e.code ?? 'SERVER_ERROR', message: e.message ?? 'Unknown error' } });
    }
});
// ─────────────────────────────────────────────────────────────────────────────
// GET /api/v1/reports/periods/:periodId/tax-basis-pl
// ─────────────────────────────────────────────────────────────────────────────
exports.pdfReportsRouter.get('/periods/:periodId/tax-basis-pl', async (req, res) => {
    const periodId = getPeriodId(req);
    if (periodId === null) {
        res.status(400).json({ data: null, error: { code: 'INVALID_ID', message: 'Invalid period ID' } });
        return;
    }
    try {
        const buffer = await (0, reportGenerators_1.generateTaxBasisPlPdf)(db_1.db, periodId);
        sendPdf(res, buffer, `tax-basis-pl-${periodId}.pdf`, isPreview(req));
    }
    catch (err) {
        const e = err;
        res.status(e.status ?? 500).json({ data: null, error: { code: e.code ?? 'SERVER_ERROR', message: e.message ?? 'Unknown error' } });
    }
});
// ─────────────────────────────────────────────────────────────────────────────
// GET /api/v1/reports/periods/:periodId/tax-return-order
// ─────────────────────────────────────────────────────────────────────────────
exports.pdfReportsRouter.get('/periods/:periodId/tax-return-order', async (req, res) => {
    const periodId = getPeriodId(req);
    if (periodId === null) {
        res.status(400).json({ data: null, error: { code: 'INVALID_ID', message: 'Invalid period ID' } });
        return;
    }
    try {
        const buffer = await (0, reportGenerators_1.generateTaxReturnOrderPdf)(db_1.db, periodId);
        sendPdf(res, buffer, `tax-return-order-${periodId}.pdf`, isPreview(req));
    }
    catch (err) {
        const e = err;
        res.status(e.status ?? 500).json({ data: null, error: { code: e.code ?? 'SERVER_ERROR', message: e.message ?? 'Unknown error' } });
    }
});
//# sourceMappingURL=pdfReports.js.map