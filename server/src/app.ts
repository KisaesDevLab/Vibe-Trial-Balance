// Copyright 2025-2026 Kisaes LLC
// Licensed under the PolyForm Internal Use License 1.0.0.
// You may not distribute this software. See LICENSE for terms.

import 'dotenv/config';
import express from 'express';
import type { Request } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import jwt from 'jsonwebtoken';
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
import { tickmarkLibraryCollectionRouter, tickmarkLibraryItemRouter, tbTickmarkRouter, systemTickmarkCollectionRouter, systemTickmarkItemRouter } from './routes/tickmarks';
import { savedReportCollectionRouter, savedReportItemRouter } from './routes/savedReports';
import { varianceNotesRouter } from './routes/varianceNotes';
import { pdfReportsRouter } from './routes/pdfReports';
import { taxCodesRouter } from './routes/taxCodes';
import { comparisonRouter } from './routes/comparison';
import { exportsRouter } from './routes/exports';
import { taxLineAssignmentRouter } from './routes/taxLineAssignment';
import { csvImportRouter } from './routes/csvImport';
import { pdfImportRouter } from './routes/pdfImport';
import { bankStatementPdfRouter } from './routes/bankStatementPdfImport';
import { documentsCollectionRouter, documentsItemRouter } from './routes/documents';
import { backupRouter, restoreRouter, startBackupScheduler } from './routes/backup';
import { auditLogRouter } from './routes/auditLog';
import { supportRouter } from './routes/support';
import { coaTemplatesRouter } from './routes/coaTemplates';
import { payeesRouter } from './routes/payees';
import { unitsRouter } from './routes/units';
import { pyComparisonRouter } from './routes/pyComparison';
import { mcpRouter } from './routes/mcpHttp';
import { db } from './db';
import { sendServerError } from './lib/safeError';

const app = express();
const PORT = process.env.PORT || 3001;
const isProduction = process.env.NODE_ENV === 'production';

if (isProduction && !process.env.ALLOWED_ORIGIN) {
  console.error('\nFATAL: ALLOWED_ORIGIN environment variable is required in production.\n');
  process.exit(1);
}

// Respect X-Forwarded-For from a trusted reverse proxy (e.g. Nginx on the Pi).
// This lets rate-limit fall back to real client IP for unauthenticated paths
// instead of all requests sharing the proxy IP.
app.set('trust proxy', 1);

app.use(helmet());
app.use(cors({
  origin: process.env.ALLOWED_ORIGIN || 'http://localhost:5173',
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));

// Rate-limit bucketing key: prefer the JWT userId (decoded, not verified — we
// only care about grouping, not trust), fall back to client IP. This prevents
// an entire office behind one NAT/VPN IP from sharing a single rate-limit
// bucket when many users are authenticated.
function rateLimitKey(req: Request): string {
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    try {
      const decoded = jwt.decode(authHeader.slice(7)) as { userId?: number } | null;
      if (decoded?.userId) return `u:${decoded.userId}`;
    } catch {
      // fall through to IP
    }
  }
  // express 4 normalizes req.ip when trust proxy is set; fall back to the
  // unconnected socket's address, then a static string if that's also absent.
  return `ip:${req.ip ?? req.socket?.remoteAddress ?? 'unknown'}`;
}

// Global rate limiter — 200 requests per 15 minutes per user (or per IP if unauth)
app.use('/api/', rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: rateLimitKey,
  message: { data: null, error: { code: 'RATE_LIMITED', message: 'Too many requests. Please try again later.' } },
}));

// Stricter limits for file upload / AI endpoints — 20 per hour per user
const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: rateLimitKey,
  message: { data: null, error: { code: 'RATE_LIMITED', message: 'Too many upload/AI requests. Please try again later.' } },
});
app.use('/api/v1/import/', uploadLimiter);
app.use('/api/v1/support/chat', uploadLimiter);
app.use('/api/v1/periods/:periodId/diagnostics', uploadLimiter);

// Reviewer accounts are read-only. Block mutating HTTP methods at the API
// boundary using the JWT claim's role. Full auth validation still happens
// inside each router's authMiddleware — this is just a fast gate that prevents
// reviewers from reaching any write handler. We deliberately don't hit the DB
// here; if a reviewer was just promoted to staff, there is a ≤30s window
// (matching the auth cache TTL) before writes are accepted.
app.use('/api/v1', (req, res, next) => {
  const method = req.method.toUpperCase();
  if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') return next();
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) return next(); // let authMiddleware send 401
  try {
    const decoded = jwt.decode(authHeader.slice(7)) as { role?: string } | null;
    if (decoded?.role === 'reviewer') {
      res.status(403).json({
        data: null,
        error: { code: 'READ_ONLY', message: 'Reviewer accounts cannot modify data.' },
      });
      return;
    }
  } catch {
    // fall through — authMiddleware will handle bad tokens
  }
  next();
});

app.get('/api/v1/health', async (_req, res) => {
  try {
    const result = await db.raw('SELECT NOW() AS now');
    res.json({
      data: { status: 'ok', database: 'connected', timestamp: result.rows[0].now },
      error: null,
    });
  } catch (err: unknown) {
    sendServerError(res, err, 'health');
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
app.use('/api/v1/system-tickmarks', systemTickmarkCollectionRouter);
app.use('/api/v1/system-tickmarks/:id', systemTickmarkItemRouter);
app.use('/api/v1/clients/:clientId/saved-reports', savedReportCollectionRouter);
app.use('/api/v1/saved-reports/:id', savedReportItemRouter);
app.use('/api/v1/periods/:periodId/variance-notes', varianceNotesRouter);
app.use('/api/v1/reports', pdfReportsRouter);
app.use('/api/v1/tax-codes', taxCodesRouter);
app.use('/api/v1/periods/:periodId/compare/:comparePeriodId', comparisonRouter);
app.use('/api/v1/periods/:periodId/exports', exportsRouter);
app.use('/api/v1/tax-lines', taxLineAssignmentRouter);
app.use('/api/v1/import/csv', csvImportRouter);
app.use('/api/v1/import/pdf', pdfImportRouter);
app.use('/api/v1/import/bank-statement-pdf', bankStatementPdfRouter);
app.use('/api/v1/clients/:clientId/documents', documentsCollectionRouter);
app.use('/api/v1/documents', documentsItemRouter);
app.use('/api/v1/backup', backupRouter);
app.use('/api/v1/restore', restoreRouter);
app.use('/api/v1/audit-log', auditLogRouter);
app.use('/api/v1/support', supportRouter);
app.use('/api/v1/coa-templates', coaTemplatesRouter);
app.use('/api/v1/clients/:clientId/payees', payeesRouter);
app.use('/api/v1/clients/:clientId/units', unitsRouter);
app.use('/api/v1/periods/:periodId/py-comparison', pyComparisonRouter);
app.use('/mcp', mcpRouter);

// 404 for any /api/* path not matched above.
app.use('/api', (req, res) => {
  res.status(404).json({ data: null, error: { code: 'NOT_FOUND', message: `No route matches ${req.method} ${req.path}` } });
});

// Global error handler — last line of defense for any handler that either
// throws synchronously or escapes an async try/catch. Express 4 will not
// auto-catch async rejections; routes must either use try/catch or next(err).
// This keeps us from hanging the socket and from leaking stack traces.
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  if (res.headersSent) {
    // Stream already started; nothing useful to send. Just destroy.
    res.destroy(err);
    return;
  }
  sendServerError(res, err, 'global');
});

const server = app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/api/v1/health`);
  startBackupScheduler();
});

server.on('error', (err: NodeJS.ErrnoException) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`\nError: Port ${PORT} is already in use.`);
    console.error(`Another process is listening on this port. Either:`);
    console.error(`  1. Stop the other process using port ${PORT}`);
    console.error(`  2. Set a different port: PORT=3002 npm run dev\n`);
    process.exit(1);
  }
  throw err;
});

export { app, db };
