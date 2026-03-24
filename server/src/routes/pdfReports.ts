import { Router, Response } from 'express';
import { db } from '../db';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import {
  generateTrialBalancePdf,
  generateJournalEntryListingPdf,
  generateAjeListingPdf,
  generateGeneralLedgerPdf,
  generateIncomeStatementPdf,
  generateBalanceSheetPdf,
  generateTaxCodeReportPdf,
  generateWorkpaperIndexPdf,
  generateTaxBasisPlPdf,
  generateTaxReturnOrderPdf,
  generateFluxAnalysisPdf,
} from '../pdf/reportGenerators';

export const pdfReportsRouter = Router({ mergeParams: true });
pdfReportsRouter.use(authMiddleware);

// ─────────────────────────────────────────────────────────────────────────────
// Shared helpers
// ─────────────────────────────────────────────────────────────────────────────

function sendPdf(
  res: Response,
  buffer: Buffer,
  filename: string,
  preview: boolean,
): void {
  const disposition = preview
    ? `inline; filename="${filename}"`
    : `attachment; filename="${filename}"`;
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', disposition);
  res.setHeader('Content-Length', String(buffer.length));
  res.send(buffer);
}

function getPeriodId(req: AuthRequest): number | null {
  const id = Number(req.params.periodId);
  return isNaN(id) ? null : id;
}

function isPreview(req: AuthRequest): boolean {
  return req.query.preview === 'true' || req.query.preview === '1';
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/v1/reports/periods/:periodId/flux/:comparePeriodId
// ─────────────────────────────────────────────────────────────────────────────
pdfReportsRouter.get('/periods/:periodId/flux/:comparePeriodId', async (req: AuthRequest, res: Response): Promise<void> => {
  const periodId        = getPeriodId(req);
  const comparePeriodId = Number(req.params.comparePeriodId);
  if (periodId === null || isNaN(comparePeriodId)) {
    res.status(400).json({ data: null, error: { code: 'INVALID_ID', message: 'Invalid period IDs' } });
    return;
  }
  try {
    const [period, comparePeriod] = await Promise.all([
      db('periods').where({ id: periodId }).first('id', 'client_id'),
      db('periods').where({ id: comparePeriodId }).first('id', 'client_id'),
    ]);
    if (!period || !comparePeriod) {
      res.status(404).json({ data: null, error: { code: 'NOT_FOUND', message: 'Period not found' } });
      return;
    }
    if (period.client_id !== comparePeriod.client_id) {
      res.status(403).json({ data: null, error: { code: 'FORBIDDEN', message: 'Periods must belong to the same client' } });
      return;
    }
    const buffer = await generateFluxAnalysisPdf(db, periodId, comparePeriodId);
    sendPdf(res, buffer, `flux-analysis-${periodId}-vs-${comparePeriodId}.pdf`, isPreview(req));
  } catch (err: unknown) {
    const e = err as { code?: string; status?: number; message?: string };
    res.status(e.status ?? 500).json({ data: null, error: { code: e.code ?? 'SERVER_ERROR', message: e.message ?? 'Unknown error' } });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/v1/reports/periods/:periodId/trial-balance
// ─────────────────────────────────────────────────────────────────────────────
pdfReportsRouter.get('/periods/:periodId/trial-balance', async (req: AuthRequest, res: Response): Promise<void> => {
  const periodId = getPeriodId(req);
  if (periodId === null) {
    res.status(400).json({ data: null, error: { code: 'INVALID_ID', message: 'Invalid period ID' } });
    return;
  }
  try {
    const columns = typeof req.query.columns === 'string' ? req.query.columns.split(',') : undefined;
    const buffer = await generateTrialBalancePdf(db, periodId, columns);
    sendPdf(res, buffer, `trial-balance-${periodId}.pdf`, isPreview(req));
  } catch (err: unknown) {
    const e = err as { code?: string; status?: number; message?: string };
    const status = e.status ?? 500;
    res.status(status).json({ data: null, error: { code: e.code ?? 'SERVER_ERROR', message: e.message ?? 'Unknown error' } });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/v1/reports/periods/:periodId/journal-entries?type=book|tax|all
// ─────────────────────────────────────────────────────────────────────────────
pdfReportsRouter.get('/periods/:periodId/journal-entries', async (req: AuthRequest, res: Response): Promise<void> => {
  const periodId = getPeriodId(req);
  if (periodId === null) {
    res.status(400).json({ data: null, error: { code: 'INVALID_ID', message: 'Invalid period ID' } });
    return;
  }
  const typeFilter = typeof req.query.type === 'string' ? req.query.type : 'all';
  try {
    const buffer = await generateJournalEntryListingPdf(db, periodId, typeFilter);
    sendPdf(res, buffer, `journal-entries-${periodId}.pdf`, isPreview(req));
  } catch (err: unknown) {
    const e = err as { code?: string; status?: number; message?: string };
    res.status(e.status ?? 500).json({ data: null, error: { code: e.code ?? 'SERVER_ERROR', message: e.message ?? 'Unknown error' } });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/v1/reports/periods/:periodId/aje-listing
// ─────────────────────────────────────────────────────────────────────────────
pdfReportsRouter.get('/periods/:periodId/aje-listing', async (req: AuthRequest, res: Response): Promise<void> => {
  const periodId = getPeriodId(req);
  if (periodId === null) {
    res.status(400).json({ data: null, error: { code: 'INVALID_ID', message: 'Invalid period ID' } });
    return;
  }
  try {
    const buffer = await generateAjeListingPdf(db, periodId);
    sendPdf(res, buffer, `aje-listing-${periodId}.pdf`, isPreview(req));
  } catch (err: unknown) {
    const e = err as { code?: string; status?: number; message?: string };
    res.status(e.status ?? 500).json({ data: null, error: { code: e.code ?? 'SERVER_ERROR', message: e.message ?? 'Unknown error' } });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/v1/reports/periods/:periodId/general-ledger?accountId=
// ─────────────────────────────────────────────────────────────────────────────
pdfReportsRouter.get('/periods/:periodId/general-ledger', async (req: AuthRequest, res: Response): Promise<void> => {
  const periodId = getPeriodId(req);
  if (periodId === null) {
    res.status(400).json({ data: null, error: { code: 'INVALID_ID', message: 'Invalid period ID' } });
    return;
  }
  const accountId = req.query.accountId ? Number(req.query.accountId) : undefined;
  if (req.query.accountId && isNaN(accountId!)) {
    res.status(400).json({ data: null, error: { code: 'INVALID_ID', message: 'Invalid account ID' } });
    return;
  }
  try {
    const buffer = await generateGeneralLedgerPdf(db, periodId, accountId);
    sendPdf(res, buffer, `general-ledger-${periodId}.pdf`, isPreview(req));
  } catch (err: unknown) {
    const e = err as { code?: string; status?: number; message?: string };
    res.status(e.status ?? 500).json({ data: null, error: { code: e.code ?? 'SERVER_ERROR', message: e.message ?? 'Unknown error' } });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/v1/reports/periods/:periodId/income-statement?priorYear=true
// ─────────────────────────────────────────────────────────────────────────────
pdfReportsRouter.get('/periods/:periodId/income-statement', async (req: AuthRequest, res: Response): Promise<void> => {
  const periodId = getPeriodId(req);
  if (periodId === null) {
    res.status(400).json({ data: null, error: { code: 'INVALID_ID', message: 'Invalid period ID' } });
    return;
  }
  const includePY = req.query.priorYear === 'true' || req.query.priorYear === '1';
  try {
    const buffer = await generateIncomeStatementPdf(db, periodId, includePY);
    sendPdf(res, buffer, `income-statement-${periodId}.pdf`, isPreview(req));
  } catch (err: unknown) {
    const e = err as { code?: string; status?: number; message?: string };
    res.status(e.status ?? 500).json({ data: null, error: { code: e.code ?? 'SERVER_ERROR', message: e.message ?? 'Unknown error' } });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/v1/reports/periods/:periodId/balance-sheet
// ─────────────────────────────────────────────────────────────────────────────
pdfReportsRouter.get('/periods/:periodId/balance-sheet', async (req: AuthRequest, res: Response): Promise<void> => {
  const periodId = getPeriodId(req);
  if (periodId === null) {
    res.status(400).json({ data: null, error: { code: 'INVALID_ID', message: 'Invalid period ID' } });
    return;
  }
  try {
    const buffer = await generateBalanceSheetPdf(db, periodId);
    sendPdf(res, buffer, `balance-sheet-${periodId}.pdf`, isPreview(req));
  } catch (err: unknown) {
    const e = err as { code?: string; status?: number; message?: string };
    res.status(e.status ?? 500).json({ data: null, error: { code: e.code ?? 'SERVER_ERROR', message: e.message ?? 'Unknown error' } });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/v1/reports/periods/:periodId/tax-code-report
// ─────────────────────────────────────────────────────────────────────────────
pdfReportsRouter.get('/periods/:periodId/tax-code-report', async (req: AuthRequest, res: Response): Promise<void> => {
  const periodId = getPeriodId(req);
  if (periodId === null) {
    res.status(400).json({ data: null, error: { code: 'INVALID_ID', message: 'Invalid period ID' } });
    return;
  }
  try {
    const buffer = await generateTaxCodeReportPdf(db, periodId);
    sendPdf(res, buffer, `tax-code-report-${periodId}.pdf`, isPreview(req));
  } catch (err: unknown) {
    const e = err as { code?: string; status?: number; message?: string };
    res.status(e.status ?? 500).json({ data: null, error: { code: e.code ?? 'SERVER_ERROR', message: e.message ?? 'Unknown error' } });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/v1/reports/periods/:periodId/workpaper-index
// ─────────────────────────────────────────────────────────────────────────────
pdfReportsRouter.get('/periods/:periodId/workpaper-index', async (req: AuthRequest, res: Response): Promise<void> => {
  const periodId = getPeriodId(req);
  if (periodId === null) {
    res.status(400).json({ data: null, error: { code: 'INVALID_ID', message: 'Invalid period ID' } });
    return;
  }
  try {
    const buffer = await generateWorkpaperIndexPdf(db, periodId);
    sendPdf(res, buffer, `workpaper-index-${periodId}.pdf`, isPreview(req));
  } catch (err: unknown) {
    const e = err as { code?: string; status?: number; message?: string };
    res.status(e.status ?? 500).json({ data: null, error: { code: e.code ?? 'SERVER_ERROR', message: e.message ?? 'Unknown error' } });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/v1/reports/periods/:periodId/tax-basis-pl
// ─────────────────────────────────────────────────────────────────────────────
pdfReportsRouter.get('/periods/:periodId/tax-basis-pl', async (req: AuthRequest, res: Response): Promise<void> => {
  const periodId = getPeriodId(req);
  if (periodId === null) {
    res.status(400).json({ data: null, error: { code: 'INVALID_ID', message: 'Invalid period ID' } });
    return;
  }
  try {
    const buffer = await generateTaxBasisPlPdf(db, periodId);
    sendPdf(res, buffer, `tax-basis-pl-${periodId}.pdf`, isPreview(req));
  } catch (err: unknown) {
    const e = err as { code?: string; status?: number; message?: string };
    res.status(e.status ?? 500).json({ data: null, error: { code: e.code ?? 'SERVER_ERROR', message: e.message ?? 'Unknown error' } });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/v1/reports/periods/:periodId/tax-return-order
// ─────────────────────────────────────────────────────────────────────────────
pdfReportsRouter.get('/periods/:periodId/tax-return-order', async (req: AuthRequest, res: Response): Promise<void> => {
  const periodId = getPeriodId(req);
  if (periodId === null) {
    res.status(400).json({ data: null, error: { code: 'INVALID_ID', message: 'Invalid period ID' } });
    return;
  }
  try {
    const buffer = await generateTaxReturnOrderPdf(db, periodId);
    sendPdf(res, buffer, `tax-return-order-${periodId}.pdf`, isPreview(req));
  } catch (err: unknown) {
    const e = err as { code?: string; status?: number; message?: string };
    res.status(e.status ?? 500).json({ data: null, error: { code: e.code ?? 'SERVER_ERROR', message: e.message ?? 'Unknown error' } });
  }
});
