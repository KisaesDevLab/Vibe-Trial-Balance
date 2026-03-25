"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.db = exports.app = void 0;
require("dotenv/config");
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const auth_1 = __importDefault(require("./routes/auth"));
const clients_1 = __importDefault(require("./routes/clients"));
const chartOfAccounts_1 = require("./routes/chartOfAccounts");
const periods_1 = require("./routes/periods");
const trialBalance_1 = require("./routes/trialBalance");
const generalLedger_1 = require("./routes/generalLedger");
const dashboard_1 = require("./routes/dashboard");
const rollForward_1 = require("./routes/rollForward");
const users_1 = require("./routes/users");
const journalEntries_1 = require("./routes/journalEntries");
const bankTransactions_1 = require("./routes/bankTransactions");
const settings_1 = require("./routes/settings");
const diagnostics_1 = require("./routes/diagnostics");
const reconciliations_1 = require("./routes/reconciliations");
const taxWorkpapers_1 = require("./routes/taxWorkpapers");
const engagement_1 = require("./routes/engagement");
const cashFlow_1 = require("./routes/cashFlow");
const tickmarks_1 = require("./routes/tickmarks");
const savedReports_1 = require("./routes/savedReports");
const varianceNotes_1 = require("./routes/varianceNotes");
const pdfReports_1 = require("./routes/pdfReports");
const taxCodes_1 = require("./routes/taxCodes");
const comparison_1 = require("./routes/comparison");
const exports_1 = require("./routes/exports");
const taxLineAssignment_1 = require("./routes/taxLineAssignment");
const csvImport_1 = require("./routes/csvImport");
const pdfImport_1 = require("./routes/pdfImport");
const documents_1 = require("./routes/documents");
const backup_1 = require("./routes/backup");
const auditLog_1 = require("./routes/auditLog");
const support_1 = require("./routes/support");
const coaTemplates_1 = require("./routes/coaTemplates");
const payees_1 = require("./routes/payees");
const units_1 = require("./routes/units");
const mcpHttp_1 = require("./routes/mcpHttp");
const db_1 = require("./db");
Object.defineProperty(exports, "db", { enumerable: true, get: function () { return db_1.db; } });
const app = (0, express_1.default)();
exports.app = app;
const PORT = process.env.PORT || 3001;
app.use((0, cors_1.default)());
app.use(express_1.default.json());
app.get('/api/v1/health', async (_req, res) => {
    try {
        const result = await db_1.db.raw('SELECT NOW() AS now');
        res.json({
            data: { status: 'ok', database: 'connected', timestamp: result.rows[0].now },
            error: null,
        });
    }
    catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        res.status(500).json({ data: null, error: { code: 'DB_ERROR', message } });
    }
});
app.use('/api/v1/auth', auth_1.default);
app.use('/api/v1/clients', clients_1.default);
app.use('/api/v1/clients/:clientId/chart-of-accounts', chartOfAccounts_1.coaCollectionRouter);
app.use('/api/v1/chart-of-accounts', chartOfAccounts_1.coaItemRouter);
app.use('/api/v1/clients/:clientId/periods', periods_1.periodCollectionRouter);
app.use('/api/v1/periods', periods_1.periodItemRouter);
app.use('/api/v1/periods/:periodId/trial-balance', trialBalance_1.tbPeriodRouter);
app.use('/api/v1/periods/:periodId/general-ledger', generalLedger_1.glPeriodRouter);
app.use('/api/v1/periods/:periodId/dashboard', dashboard_1.dashboardRouter);
app.use('/api/v1/periods/:id/roll-forward', rollForward_1.rollForwardRouter);
app.use('/api/v1/users', users_1.usersRouter);
app.use('/api/v1/journal-entries', journalEntries_1.jeItemRouter);
app.use('/api/v1/periods/:periodId/journal-entries', journalEntries_1.jeCollectionRouter);
app.use('/api/v1/clients/:clientId/bank-transactions', bankTransactions_1.btCollectionRouter);
app.use('/api/v1/clients/:clientId/classification-rules', bankTransactions_1.btRulesRouter);
app.use('/api/v1/settings', settings_1.settingsRouter);
app.use('/api/v1/periods/:periodId/diagnostics', diagnostics_1.diagnosticsRouter);
app.use('/api/v1/clients/:clientId/reconciliations', reconciliations_1.reconciliationCollectionRouter);
app.use('/api/v1/reconciliations/:id', reconciliations_1.reconciliationItemRouter);
app.use('/api/v1/periods/:periodId/m1-adjustments', taxWorkpapers_1.m1CollectionRouter);
app.use('/api/v1/m1-adjustments/:id', taxWorkpapers_1.m1ItemRouter);
app.use('/api/v1/periods/:periodId/engagement-tasks', engagement_1.engagementCollectionRouter);
app.use('/api/v1/engagement-tasks/:id', engagement_1.engagementItemRouter);
app.use('/api/v1/engagement-summary', engagement_1.engagementSummaryRouter);
app.use('/api/v1/periods/:periodId/cash-flow', cashFlow_1.cashFlowRouter);
app.use('/api/v1/clients/:clientId/tickmarks', tickmarks_1.tickmarkLibraryCollectionRouter);
app.use('/api/v1/tickmarks/:id', tickmarks_1.tickmarkLibraryItemRouter);
app.use('/api/v1/periods/:periodId/tb-tickmarks', tickmarks_1.tbTickmarkRouter);
app.use('/api/v1/clients/:clientId/saved-reports', savedReports_1.savedReportCollectionRouter);
app.use('/api/v1/saved-reports/:id', savedReports_1.savedReportItemRouter);
app.use('/api/v1/periods/:periodId/variance-notes', varianceNotes_1.varianceNotesRouter);
app.use('/api/v1/reports', pdfReports_1.pdfReportsRouter);
app.use('/api/v1/tax-codes', taxCodes_1.taxCodesRouter);
app.use('/api/v1/periods/:periodId/compare/:comparePeriodId', comparison_1.comparisonRouter);
app.use('/api/v1/periods/:periodId/exports', exports_1.exportsRouter);
app.use('/api/v1/tax-lines', taxLineAssignment_1.taxLineAssignmentRouter);
app.use('/api/v1/import/csv', csvImport_1.csvImportRouter);
app.use('/api/v1/import/pdf', pdfImport_1.pdfImportRouter);
app.use('/api/v1/clients/:clientId/documents', documents_1.documentsCollectionRouter);
app.use('/api/v1/documents', documents_1.documentsItemRouter);
app.use('/api/v1/backup', backup_1.backupRouter);
app.use('/api/v1/restore', backup_1.restoreRouter);
app.use('/api/v1/audit-log', auditLog_1.auditLogRouter);
app.use('/api/v1/support', support_1.supportRouter);
app.use('/api/v1/coa-templates', coaTemplates_1.coaTemplatesRouter);
app.use('/api/v1/clients/:clientId/payees', payees_1.payeesRouter);
app.use('/api/v1/clients/:clientId/units', units_1.unitsRouter);
app.use('/mcp', mcpHttp_1.mcpRouter);
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log(`Health check: http://localhost:${PORT}/api/v1/health`);
    (0, backup_1.startBackupScheduler)();
});
//# sourceMappingURL=app.js.map