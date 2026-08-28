// Copyright 2025-2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Use is limited to qualifying small businesses. See LICENSE for terms.

import { Router, Response } from 'express';
import { PDFDocument } from 'pdf-lib';
import { db } from '../db';
import { z } from 'zod';
import { buildWorkpaperPackage } from '../lib/workpaperPackage';
import { storeDocument, workpaperSection } from '../lib/documentStore';
import { logAudit } from '../lib/periodGuard';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { engagementFilename, pdfDisposition } from '../lib/reportFilename';
import {
  generateTrialBalancePdf,
  generateJournalEntryListingPdf,
  generateAjeListingPdf,
  generateGeneralLedgerPdf,
  generateIncomeStatementPdf,
  generateBalanceSheetPdf,
  generateTaxCodeReportPdf,
  generateWorkpaperIndexPdf,
  generateLeadSheetsPdf,
  generateTaxBasisPlPdf,
  generateTaxReturnOrderPdf,
  generateFluxAnalysisPdf,
  generateCashFlowPdf,
  generateM1Pdf,
  generateTaxBasisSchedulePdf,
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
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', pdfDisposition(filename, preview));
  res.setHeader('Content-Length', String(buffer.length));
  res.send(buffer);
}

/**
 * Name a report for the engagement it belongs to. Falls back to the bare
 * report name if the period has gone missing.
 */
async function reportFilename(periodId: number, baseName: string): Promise<string> {
  const row = await db('periods')
    .join('clients', 'clients.id', 'periods.client_id')
    .where('periods.id', periodId)
    .first('periods.period_name as period_name', 'clients.name as client_name');
  if (!row) return baseName;
  return engagementFilename(row.period_name as string, row.client_name as string, baseName);
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
    sendPdf(res, buffer, await reportFilename(periodId, `flux-analysis-${periodId}-vs-${comparePeriodId}.pdf`), isPreview(req));
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
    sendPdf(res, buffer, await reportFilename(periodId, `trial-balance-${periodId}.pdf`), isPreview(req));
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
    sendPdf(res, buffer, await reportFilename(periodId, `journal-entries-${periodId}.pdf`), isPreview(req));
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
    sendPdf(res, buffer, await reportFilename(periodId, `aje-listing-${periodId}.pdf`), isPreview(req));
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
    sendPdf(res, buffer, await reportFilename(periodId, `general-ledger-${periodId}.pdf`), isPreview(req));
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
    sendPdf(res, buffer, await reportFilename(periodId, `income-statement-${periodId}.pdf`), isPreview(req));
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
    sendPdf(res, buffer, await reportFilename(periodId, `balance-sheet-${periodId}.pdf`), isPreview(req));
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
    // Adjustment layer must follow the user's on-screen selection (book vs tax).
    const columns = req.query.columns === 'book' ? 'book' : 'tax';
    const buffer = await generateTaxCodeReportPdf(db, periodId, columns);
    sendPdf(res, buffer, await reportFilename(periodId, `tax-code-report-${periodId}.pdf`), isPreview(req));
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
    const pageBreak = req.query.pageBreak !== 'false'; // default true
    const buffer = await generateWorkpaperIndexPdf(db, periodId, pageBreak);
    sendPdf(res, buffer, await reportFilename(periodId, `workpaper-index-${periodId}.pdf`), isPreview(req));
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
    sendPdf(res, buffer, await reportFilename(periodId, `tax-basis-pl-${periodId}.pdf`), isPreview(req));
  } catch (err: unknown) {
    const e = err as { code?: string; status?: number; message?: string };
    res.status(e.status ?? 500).json({ data: null, error: { code: e.code ?? 'SERVER_ERROR', message: e.message ?? 'Unknown error' } });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/v1/reports/periods/:periodId/cash-flow
// ─────────────────────────────────────────────────────────────────────────────
pdfReportsRouter.get('/periods/:periodId/cash-flow', async (req: AuthRequest, res: Response): Promise<void> => {
  const periodId = getPeriodId(req);
  if (periodId === null) {
    res.status(400).json({ data: null, error: { code: 'INVALID_ID', message: 'Invalid period ID' } });
    return;
  }
  try {
    const buffer = await generateCashFlowPdf(db, periodId);
    sendPdf(res, buffer, await reportFilename(periodId, `cash-flow-${periodId}.pdf`), isPreview(req));
  } catch (err: unknown) {
    const e = err as { code?: string; status?: number; message?: string };
    res.status(e.status ?? 500).json({ data: null, error: { code: e.code ?? 'SERVER_ERROR', message: e.message ?? 'Unknown error' } });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/v1/reports/periods/:periodId/tax-basis-schedule
// ─────────────────────────────────────────────────────────────────────────────
pdfReportsRouter.get('/periods/:periodId/tax-basis-schedule', async (req: AuthRequest, res: Response): Promise<void> => {
  const periodId = getPeriodId(req);
  if (periodId === null) {
    res.status(400).json({ data: null, error: { code: 'INVALID_ID', message: 'Invalid period ID' } });
    return;
  }
  try {
    const buffer = await generateTaxBasisSchedulePdf(db, periodId);
    sendPdf(res, buffer, await reportFilename(periodId, `tax-basis-schedule-${periodId}.pdf`), isPreview(req));
  } catch (err: unknown) {
    const e = err as { code?: string; status?: number; message?: string };
    res.status(e.status ?? 500).json({ data: null, error: { code: e.code ?? 'SERVER_ERROR', message: e.message ?? 'Unknown error' } });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/v1/reports/periods/:periodId/m1
// ─────────────────────────────────────────────────────────────────────────────
pdfReportsRouter.get('/periods/:periodId/m1', async (req: AuthRequest, res: Response): Promise<void> => {
  const periodId = getPeriodId(req);
  if (periodId === null) {
    res.status(400).json({ data: null, error: { code: 'INVALID_ID', message: 'Invalid period ID' } });
    return;
  }
  try {
    const buffer = await generateM1Pdf(db, periodId);
    sendPdf(res, buffer, await reportFilename(periodId, `m1-reconciliation-${periodId}.pdf`), isPreview(req));
  } catch (err: unknown) {
    const e = err as { code?: string; status?: number; message?: string };
    res.status(e.status ?? 500).json({ data: null, error: { code: e.code ?? 'SERVER_ERROR', message: e.message ?? 'Unknown error' } });
  }
});

// GET /api/v1/reports/periods/:periodId/lead-sheets
// One page per lead sheet, ahead of the trial balance in the binder.
pdfReportsRouter.get('/periods/:periodId/lead-sheets', async (req: AuthRequest, res: Response): Promise<void> => {
  const periodId = getPeriodId(req);
  if (periodId === null) {
    res.status(400).json({ data: null, error: { code: 'INVALID_ID', message: 'Invalid period ID' } });
    return;
  }
  try {
    const buffer = await generateLeadSheetsPdf(db, periodId);
    sendPdf(res, buffer, await reportFilename(periodId, `lead-sheets-${periodId}.pdf`), isPreview(req));
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
    sendPdf(res, buffer, await reportFilename(periodId, `tax-return-order-${periodId}.pdf`), isPreview(req));
  } catch (err: unknown) {
    const e = err as { code?: string; status?: number; message?: string };
    res.status(e.status ?? 500).json({ data: null, error: { code: e.code ?? 'SERVER_ERROR', message: e.message ?? 'Unknown error' } });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/v1/reports/periods/:periodId/workpaper-merged
// Merges selected PDF reports into a single PDF file
// ─────────────────────────────────────────────────────────────────────────────

// Labels are what the table of contents prints, so they must read as binder
// tabs — keep them in step with PDF_REPORT_SECTIONS in WorkpaperPackagePage.
const REPORT_GENERATORS: Record<string, { label: string; generate: (periodId: number) => Promise<Buffer> }> = {
  'pdf-wp-index':   { label: 'Workpaper Index',   generate: (id) => generateWorkpaperIndexPdf(db, id) },
  'pdf-lead-sheets': { label: 'Lead Sheets',      generate: (id) => generateLeadSheetsPdf(db, id) },
  'pdf-tb':         { label: 'Trial Balance',     generate: (id) => generateTrialBalancePdf(db, id) },
  'pdf-is':         { label: 'Income Statement',  generate: (id) => generateIncomeStatementPdf(db, id) },
  'pdf-bs':         { label: 'Balance Sheet',     generate: (id) => generateBalanceSheetPdf(db, id) },
  'pdf-je':         { label: 'Journal Entries',   generate: (id) => generateJournalEntryListingPdf(db, id) },
  'pdf-aje':        { label: 'AJE Listing',       generate: (id) => generateAjeListingPdf(db, id) },
  'pdf-gl':         { label: 'General Ledger',    generate: (id) => generateGeneralLedgerPdf(db, id) },
  'pdf-tax-code':   { label: 'Tax Code Report',   generate: (id) => generateTaxCodeReportPdf(db, id) },
  'pdf-tax-pl':     { label: 'Tax-Basis P&L',     generate: (id) => generateTaxBasisPlPdf(db, id) },
  'pdf-tax-return': { label: 'Tax Return Order',  generate: (id) => generateTaxReturnOrderPdf(db, id) },
  'pdf-m1':         { label: 'M-1 Worksheet',     generate: (id) => generateM1Pdf(db, id) },
};


pdfReportsRouter.get('/periods/:periodId/workpaper-merged', async (req: AuthRequest, res: Response): Promise<void> => {
  const periodId = getPeriodId(req);
  if (periodId === null) {
    res.status(400).json({ data: null, error: { code: 'INVALID_ID', message: 'Invalid period ID' } });
    return;
  }

  const reportIds = ((req.query.reports as string) || '').split(',').filter(Boolean);
  if (reportIds.length === 0) {
    res.status(400).json({ data: null, error: { code: 'VALIDATION_ERROR', message: 'No reports specified. Pass ?reports=pdf-tb,pdf-is,...' } });
    return;
  }
  const includeAttachments = req.query.includeAttachments === '1' || req.query.includeAttachments === 'true';

  try {
    const { buffer, skippedAttachments } = await buildWorkpaperPackage(
      db, periodId, reportIds, REPORT_GENERATORS, { includeAttachments },
    );
    // A corrupt attachment is skipped, not fatal — surface it in a header so
    // the UI can mention it without failing the download.
    if (skippedAttachments.length > 0) {
      res.setHeader('X-Skipped-Attachments', skippedAttachments.map((s) => s.refCode).join(','));
    }
    sendPdf(res, buffer, await reportFilename(periodId, `workpaper-package-${periodId}.pdf`), isPreview(req));
  } catch (err: unknown) {
    const e = err as { code?: string; status?: number; message?: string };
    res.status(e.status ?? 500).json({ data: null, error: { code: e.code ?? 'SERVER_ERROR', message: e.message ?? 'Unknown error' } });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/v1/reports/periods/:periodId/workpaper-merged/save
// Same binder, written into the client's workpaper folder instead of returned.
// Allowed on a LOCKED period: locking is exactly when you archive the binder.
// ─────────────────────────────────────────────────────────────────────────────

pdfReportsRouter.post('/periods/:periodId/workpaper-merged/save', async (req: AuthRequest, res: Response): Promise<void> => {
  const periodId = getPeriodId(req);
  if (periodId === null) {
    res.status(400).json({ data: null, error: { code: 'INVALID_ID', message: 'Invalid period ID' } });
    return;
  }
  const parsed = z.object({
    reports: z.array(z.string()).min(1),
    includeAttachments: z.boolean().optional(),
  }).safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ data: null, error: { code: 'VALIDATION_ERROR', message: parsed.error.message } });
    return;
  }

  try {
    const period = await db('periods').where({ id: periodId }).first('id', 'client_id', 'period_name');
    if (!period) {
      res.status(404).json({ data: null, error: { code: 'NOT_FOUND', message: 'Period not found' } });
      return;
    }

    const { buffer, skippedAttachments } = await buildWorkpaperPackage(
      db, periodId, parsed.data.reports, REPORT_GENERATORS,
      { includeAttachments: parsed.data.includeAttachments ?? false },
    );

    // Same helper and base name the download path uses, so a preparer who
    // downloads and one who saves end up with an identical filename.
    const filename = await reportFilename(periodId, `workpaper-package-${periodId}.pdf`);

    const doc = await storeDocument({
      clientId: period.client_id as number,
      periodId,
      section: await workpaperSection(),
      filename,
      mimeType: 'application/pdf',
      buffer,
      uploadedBy: req.user?.userId ?? null,
    });

    await logAudit({
      userId: req.user?.userId ?? null, periodId, clientId: period.client_id as number,
      entityType: 'client_document', entityId: doc.id as number, action: 'create',
      description: `Saved workpaper package to documents (${parsed.data.reports.length} reports)`,
    });

    res.status(201).json({
      data: {
        documentId: doc.id,
        filename,
        objectKey: doc.object_key,
        sizeBytes: buffer.length,
        skippedAttachments,
      },
      error: null,
    });
  } catch (err: unknown) {
    const e = err as { name?: string; code?: string; status?: number; message?: string };
    res.status(e.status ?? 500).json({ data: null, error: { code: e.code ?? 'SERVER_ERROR', message: e.message ?? 'Unknown error' } });
  }
});
