import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import authRoutes from './routes/auth';
import clientRoutes from './routes/clients';
import { coaCollectionRouter, coaItemRouter } from './routes/chartOfAccounts';
import { periodCollectionRouter, periodItemRouter } from './routes/periods';
import { tbPeriodRouter } from './routes/trialBalance';
import { glPeriodRouter } from './routes/generalLedger';
import { dashboardRouter } from './routes/dashboard';
import { rollForwardRouter } from './routes/rollForward';
import { usersRouter } from './routes/users';
import { jeCollectionRouter, jeItemRouter } from './routes/journalEntries';
import { btCollectionRouter, btRulesRouter } from './routes/bankTransactions';
import { settingsRouter } from './routes/settings';
import { diagnosticsRouter } from './routes/diagnostics';
import { reconciliationCollectionRouter, reconciliationItemRouter } from './routes/reconciliations';
import { m1CollectionRouter, m1ItemRouter } from './routes/taxWorkpapers';
import { engagementCollectionRouter, engagementItemRouter, engagementSummaryRouter } from './routes/engagement';
import { cashFlowRouter } from './routes/cashFlow';
import { tickmarkLibraryCollectionRouter, tickmarkLibraryItemRouter, tbTickmarkRouter } from './routes/tickmarks';
import { savedReportCollectionRouter, savedReportItemRouter } from './routes/savedReports';
import { varianceNotesRouter } from './routes/varianceNotes';
import { pdfReportsRouter } from './routes/pdfReports';
import { taxCodesRouter } from './routes/taxCodes';
import { db } from './db';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

app.get('/api/v1/health', async (_req, res) => {
  try {
    const result = await db.raw('SELECT NOW() AS now');
    res.json({
      data: { status: 'ok', database: 'connected', timestamp: result.rows[0].now },
      error: null,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ data: null, error: { code: 'DB_ERROR', message } });
  }
});

app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/clients', clientRoutes);
app.use('/api/v1/clients/:clientId/chart-of-accounts', coaCollectionRouter);
app.use('/api/v1/chart-of-accounts', coaItemRouter);
app.use('/api/v1/clients/:clientId/periods', periodCollectionRouter);
app.use('/api/v1/periods', periodItemRouter);
app.use('/api/v1/periods/:periodId/trial-balance', tbPeriodRouter);
app.use('/api/v1/periods/:periodId/general-ledger', glPeriodRouter);
app.use('/api/v1/periods/:periodId/dashboard', dashboardRouter);
app.use('/api/v1/periods/:id/roll-forward', rollForwardRouter);
app.use('/api/v1/users', usersRouter);
app.use('/api/v1/journal-entries', jeItemRouter);
app.use('/api/v1/periods/:periodId/journal-entries', jeCollectionRouter);
app.use('/api/v1/clients/:clientId/bank-transactions', btCollectionRouter);
app.use('/api/v1/clients/:clientId/classification-rules', btRulesRouter);
app.use('/api/v1/settings', settingsRouter);
app.use('/api/v1/periods/:periodId/diagnostics', diagnosticsRouter);
app.use('/api/v1/clients/:clientId/reconciliations', reconciliationCollectionRouter);
app.use('/api/v1/reconciliations/:id', reconciliationItemRouter);
app.use('/api/v1/periods/:periodId/m1-adjustments', m1CollectionRouter);
app.use('/api/v1/m1-adjustments/:id', m1ItemRouter);
app.use('/api/v1/periods/:periodId/engagement-tasks', engagementCollectionRouter);
app.use('/api/v1/engagement-tasks/:id', engagementItemRouter);
app.use('/api/v1/engagement-summary', engagementSummaryRouter);
app.use('/api/v1/periods/:periodId/cash-flow', cashFlowRouter);
app.use('/api/v1/clients/:clientId/tickmarks', tickmarkLibraryCollectionRouter);
app.use('/api/v1/tickmarks/:id', tickmarkLibraryItemRouter);
app.use('/api/v1/periods/:periodId/tb-tickmarks', tbTickmarkRouter);
app.use('/api/v1/clients/:clientId/saved-reports', savedReportCollectionRouter);
app.use('/api/v1/saved-reports/:id', savedReportItemRouter);
app.use('/api/v1/periods/:periodId/variance-notes', varianceNotesRouter);
app.use('/api/v1/reports', pdfReportsRouter);
app.use('/api/v1/tax-codes', taxCodesRouter);

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/api/v1/health`);
});

export { app, db };
