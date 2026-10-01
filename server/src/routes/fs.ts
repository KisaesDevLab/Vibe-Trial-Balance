// Copyright 2025-2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Use is limited to qualifying small businesses. See LICENSE for terms.

/**
 * Statement Writer — report-ready financial statements.
 *
 * Four routers:
 *   fsFontsRouter   /api/v1/fs-fonts            PUBLIC: the bundled fonts for the live preview
 *   fsRouter        /api/v1/fs                  library, layouts, statement sets, PDF engine
 *   fsClientRouter  /api/v1/clients/:clientId/fs
 *   fsPeriodRouter  /api/v1/periods/:periodId/fs
 *
 * Roles. The firm library and the PDF engine setting are admin-only writes.
 * Everything else is open to staff. Reviewers are read-only at the API
 * boundary (app.ts blocks their non-GET requests), so everything a reviewer
 * needs in order to LOOK at a statement set is a GET: the saved preview data,
 * the saved exact PDF, and every export.
 */

import { Router, Response, Request } from 'express';
import { z, ZodError } from 'zod';
import { db } from '../db';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { sendServerError } from '../lib/safeError';
import { logAudit } from '../lib/periodGuard';
import { engagementFilename, fileDisposition } from '../lib/reportFilename';
import { storeDocument, workpaperSection } from '../lib/documentStore';
import {
  FS_CF_CLASSES, FS_ENTITY_KINDS, FS_FONT_FILES, fsCashFlowOverridesSchema, fsCreateReportSchema, fsDefaultCashFlowClass,
  fsDraftOverridesSchema, fsEquityRolesSchema, fsFinalizeSchema, fsLayoutTemplateSchema, fsLetterheadSchema, fsLetterSchema,
  fsStylePresetSchema, fsUpdateClientLayoutSchema, fsUpdateReportSchema,
  type FsCashFlowClass,
} from '../lib/fs/engine';
import * as library from '../lib/fs/fsLibrary';
import * as reports from '../lib/fs/fsReports';
import { fsFontBytes } from '../lib/fs/fsFonts';
import { renderFsPdf } from '../lib/fs/fsRender';
import { CHROMIUM_PATH_SETTING, pdfEngineStatus, testPdfEngine } from '../lib/fs/pdfBrowser';
import { defaultEquityRole } from '../lib/fs/fsSource';

// ─── Shared helpers ──────────────────────────────────────────────────────

type CodedError = { code?: unknown; status?: unknown; message?: string; details?: unknown };

/** FsError, FsSourceError, PdfEngineError and StorageError all carry `code` + `status`. */
function fail(res: Response, err: unknown, tag: string): void {
  if (err instanceof ZodError) {
    res.status(400).json({ data: null, error: { code: 'VALIDATION_ERROR', message: err.issues[0]?.message ?? 'Invalid input' } });
    return;
  }
  const e = err as CodedError;
  if (typeof e?.status === 'number' && typeof e?.code === 'string' && e.status >= 400 && e.status < 600) {
    res.status(e.status).json({
      data: null,
      error: { code: e.code, message: e.message ?? 'Request failed', ...(e.details !== undefined ? { details: e.details } : {}) },
    });
    return;
  }
  sendServerError(res, err, tag);
}

function idParam(req: Request, res: Response, name: string): number | null {
  const id = Number(req.params[name]);
  if (!Number.isInteger(id) || id <= 0) {
    res.status(400).json({ data: null, error: { code: 'INVALID_ID', message: `Invalid ${name}` } });
    return null;
  }
  return id;
}

function parseBody<T>(schema: z.ZodType<T>, req: Request, res: Response): T | null {
  const r = schema.safeParse(req.body ?? {});
  if (!r.success) {
    const issue = r.error.issues[0];
    const where = issue?.path.length ? ` (${issue.path.join('.')})` : '';
    res.status(400).json({ data: null, error: { code: 'VALIDATION_ERROR', message: `${issue?.message ?? 'Invalid input'}${where}` } });
    return null;
  }
  return r.data;
}

function requireAdmin(req: AuthRequest, res: Response): boolean {
  if (req.user?.role !== 'admin') {
    res.status(403).json({ data: null, error: { code: 'FORBIDDEN', message: 'Admin access required' } });
    return false;
  }
  return true;
}

const uid = (req: AuthRequest): number | null => req.user?.userId ?? null;

// ─── Fonts (public) ──────────────────────────────────────────────────────

// The live preview is an HTML document in an iframe; its @font-face rules
// fetch the same font files the PDF embeds, or the two would wrap lines
// differently. Fonts cannot carry an Authorization header, so this is public
// — it serves only the allowlisted, openly licensed (SIL OFL) files that ship
// with the app. The name arrives WITHOUT its .ttf extension: a static-file
// rule in a proxy in front of the API would otherwise claim the request
// (this bit MyBooks, commit 1a80b1b).
export const fsFontsRouter = Router();

fsFontsRouter.get('/:file', (req: Request, res: Response): void => {
  const file = `${req.params.file}.ttf`;
  if (!FS_FONT_FILES.has(file)) {
    res.status(404).json({ data: null, error: { code: 'NOT_FOUND', message: 'Unknown font' } });
    return;
  }
  try {
    const bytes = fsFontBytes(file);
    res.setHeader('Content-Type', 'font/ttf');
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    res.setHeader('Content-Length', String(bytes.length));
    res.send(bytes);
  } catch (err) {
    sendServerError(res, err, 'fs-fonts');
  }
});

// ─── /api/v1/fs ──────────────────────────────────────────────────────────

export const fsRouter = Router({ mergeParams: true });
fsRouter.use(authMiddleware);

// PDF engine ---------------------------------------------------------------

fsRouter.get('/status', async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    res.json({ data: { pdfEngine: await pdfEngineStatus() }, error: null });
  } catch (err) { fail(res, err, 'fs-status'); }
});

const pdfEngineSchema = z.object({ chromiumPath: z.string().trim().max(500).nullable() });

fsRouter.put('/pdf-engine', async (req: AuthRequest, res: Response): Promise<void> => {
  if (!requireAdmin(req, res)) return;
  const body = parseBody(pdfEngineSchema, req, res);
  if (!body) return;
  try {
    const value = body.chromiumPath ?? '';
    await db('settings').insert({ key: CHROMIUM_PATH_SETTING, value, updated_at: db.fn.now() })
      .onConflict('key').merge({ value, updated_at: db.fn.now() });
    await logAudit({
      userId: uid(req), periodId: null, entityType: 'settings', entityId: null, action: 'update',
      description: value ? `Set the PDF engine path to ${value}` : 'Cleared the PDF engine path (auto-detect)',
    });
    res.json({ data: { pdfEngine: await pdfEngineStatus() }, error: null });
  } catch (err) { fail(res, err, 'fs-pdf-engine'); }
});

fsRouter.post('/pdf-engine/test', async (req: AuthRequest, res: Response): Promise<void> => {
  if (!requireAdmin(req, res)) return;
  try {
    res.json({ data: await testPdfEngine(), error: null });
  } catch (err) { fail(res, err, 'fs-pdf-engine-test'); }
});

// Firm library -------------------------------------------------------------

fsRouter.get('/library', async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    res.json({ data: await library.getLibrary(), error: null });
  } catch (err) { fail(res, err, 'fs-library'); }
});

fsRouter.put('/library/letterhead', async (req: AuthRequest, res: Response): Promise<void> => {
  if (!requireAdmin(req, res)) return;
  const body = parseBody(fsLetterheadSchema, req, res);
  if (!body) return;
  try {
    const row = await library.saveLetterhead(body, uid(req));
    // The logo is a data URI; the audit trail records that it changed, not its bytes.
    await logAudit({ userId: uid(req), periodId: null, entityType: 'fs_firm_profile', entityId: row.id, action: 'update', description: 'Updated the statement letterhead' });
    res.json({ data: { letterhead: library.letterheadApi(row) }, error: null });
  } catch (err) { fail(res, err, 'fs-letterhead'); }
});

fsRouter.post('/library/letters', async (req: AuthRequest, res: Response): Promise<void> => {
  if (!requireAdmin(req, res)) return;
  const body = parseBody(fsLetterSchema, req, res);
  if (!body) return;
  try {
    const row = await library.createLetter(body, uid(req));
    await logAudit({ userId: uid(req), periodId: null, entityType: 'fs_letter', entityId: row.id, action: 'create', description: `Created accountant's report "${row.name}"` });
    res.status(201).json({ data: { letter: library.letterApi(row) }, error: null });
  } catch (err) { fail(res, err, 'fs-letters'); }
});

fsRouter.put('/library/letters/:letterId', async (req: AuthRequest, res: Response): Promise<void> => {
  if (!requireAdmin(req, res)) return;
  const id = idParam(req, res, 'letterId');
  if (id === null) return;
  const body = parseBody(fsLetterSchema.partial(), req, res);
  if (!body) return;
  try {
    const row = await library.updateLetter(id, body);
    await logAudit({ userId: uid(req), periodId: null, entityType: 'fs_letter', entityId: id, action: 'update', description: `Updated accountant's report "${row.name}"` });
    res.json({ data: { letter: library.letterApi(row) }, error: null });
  } catch (err) { fail(res, err, 'fs-letters'); }
});

fsRouter.delete('/library/letters/:letterId', async (req: AuthRequest, res: Response): Promise<void> => {
  if (!requireAdmin(req, res)) return;
  const id = idParam(req, res, 'letterId');
  if (id === null) return;
  try {
    await library.deactivateLetter(id);
    await logAudit({ userId: uid(req), periodId: null, entityType: 'fs_letter', entityId: id, action: 'delete', description: "Retired an accountant's report" });
    res.json({ data: { ok: true }, error: null });
  } catch (err) { fail(res, err, 'fs-letters'); }
});

fsRouter.post('/library/presets', async (req: AuthRequest, res: Response): Promise<void> => {
  if (!requireAdmin(req, res)) return;
  const body = parseBody(fsStylePresetSchema, req, res);
  if (!body) return;
  try {
    const row = await library.createPreset(body, uid(req));
    await logAudit({ userId: uid(req), periodId: null, entityType: 'fs_style_preset', entityId: row.id, action: 'create', description: `Created statement style "${row.name}"` });
    res.status(201).json({ data: { preset: library.presetApi(row) }, error: null });
  } catch (err) { fail(res, err, 'fs-presets'); }
});

fsRouter.put('/library/presets/:presetId', async (req: AuthRequest, res: Response): Promise<void> => {
  if (!requireAdmin(req, res)) return;
  const id = idParam(req, res, 'presetId');
  if (id === null) return;
  const body = parseBody(fsStylePresetSchema.partial(), req, res);
  if (!body) return;
  try {
    const row = await library.updatePreset(id, body);
    await logAudit({ userId: uid(req), periodId: null, entityType: 'fs_style_preset', entityId: id, action: 'update', description: `Updated statement style "${row.name}"` });
    res.json({ data: { preset: library.presetApi(row) }, error: null });
  } catch (err) { fail(res, err, 'fs-presets'); }
});

fsRouter.delete('/library/presets/:presetId', async (req: AuthRequest, res: Response): Promise<void> => {
  if (!requireAdmin(req, res)) return;
  const id = idParam(req, res, 'presetId');
  if (id === null) return;
  try {
    await library.deletePreset(id);
    await logAudit({ userId: uid(req), periodId: null, entityType: 'fs_style_preset', entityId: id, action: 'delete', description: 'Deleted a statement style' });
    res.json({ data: { ok: true }, error: null });
  } catch (err) { fail(res, err, 'fs-presets'); }
});

fsRouter.post('/library/templates', async (req: AuthRequest, res: Response): Promise<void> => {
  if (!requireAdmin(req, res)) return;
  const body = parseBody(fsLayoutTemplateSchema, req, res);
  if (!body) return;
  try {
    const row = await library.createTemplate(body, uid(req));
    await logAudit({ userId: uid(req), periodId: null, entityType: 'fs_layout_template', entityId: row.id, action: 'create', description: `Created statement layout template "${row.name}"` });
    res.status(201).json({ data: { template: library.templateApi(row) }, error: null });
  } catch (err) { fail(res, err, 'fs-templates'); }
});

const templatePatchSchema = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  description: z.string().trim().max(1000).nullable().optional(),
  entityKind: z.enum([...FS_ENTITY_KINDS, 'any']).optional(),
  isDefault: z.boolean().optional(),
});

fsRouter.put('/library/templates/:templateId', async (req: AuthRequest, res: Response): Promise<void> => {
  if (!requireAdmin(req, res)) return;
  const id = idParam(req, res, 'templateId');
  if (id === null) return;
  const body = parseBody(templatePatchSchema, req, res);
  if (!body) return;
  try {
    const row = await library.updateTemplate(id, body);
    await logAudit({ userId: uid(req), periodId: null, entityType: 'fs_layout_template', entityId: id, action: 'update', description: `Updated statement layout template "${row.name}"` });
    res.json({ data: { template: library.templateApi(row) }, error: null });
  } catch (err) { fail(res, err, 'fs-templates'); }
});

fsRouter.delete('/library/templates/:templateId', async (req: AuthRequest, res: Response): Promise<void> => {
  if (!requireAdmin(req, res)) return;
  const id = idParam(req, res, 'templateId');
  if (id === null) return;
  try {
    await library.deleteTemplate(id);
    await logAudit({ userId: uid(req), periodId: null, entityType: 'fs_layout_template', entityId: id, action: 'delete', description: 'Deleted a statement layout template' });
    res.json({ data: { ok: true }, error: null });
  } catch (err) { fail(res, err, 'fs-templates'); }
});

// Client layouts -----------------------------------------------------------

fsRouter.get('/layouts/:layoutId', async (req: AuthRequest, res: Response): Promise<void> => {
  const id = idParam(req, res, 'layoutId');
  if (id === null) return;
  try {
    res.json({ data: { layout: reports.layoutApi(await reports.getLayoutRow(id)) }, error: null });
  } catch (err) { fail(res, err, 'fs-layouts'); }
});

fsRouter.patch('/layouts/:layoutId', async (req: AuthRequest, res: Response): Promise<void> => {
  const id = idParam(req, res, 'layoutId');
  if (id === null) return;
  const body = parseBody(fsUpdateClientLayoutSchema, req, res);
  if (!body) return;
  try {
    res.json({ data: { layout: reports.layoutApi(await reports.updateLayout(id, body, uid(req))) }, error: null });
  } catch (err) { fail(res, err, 'fs-layouts'); }
});

const saveAsTemplateSchema = z.object({
  name: z.string().trim().min(1).max(200),
  description: z.string().trim().max(1000).nullable().optional(),
  entityKind: z.enum([...FS_ENTITY_KINDS, 'any']).optional(),
});

fsRouter.post('/layouts/:layoutId/save-as-template', async (req: AuthRequest, res: Response): Promise<void> => {
  if (!requireAdmin(req, res)) return;
  const id = idParam(req, res, 'layoutId');
  if (id === null) return;
  const body = parseBody(saveAsTemplateSchema, req, res);
  if (!body) return;
  try {
    const row = await reports.saveLayoutAsTemplate(id, body, uid(req));
    await logAudit({ userId: uid(req), periodId: null, entityType: 'fs_layout_template', entityId: row.id, action: 'create', description: `Saved a client layout as template "${row.name}"` });
    res.status(201).json({ data: { template: library.templateApi(row) }, error: null });
  } catch (err) { fail(res, err, 'fs-layouts'); }
});

// Statement sets -----------------------------------------------------------

fsRouter.get('/reports/:reportId', async (req: AuthRequest, res: Response): Promise<void> => {
  const id = idParam(req, res, 'reportId');
  if (id === null) return;
  try {
    res.json({ data: await reports.getReport(id), error: null });
  } catch (err) { fail(res, err, 'fs-reports'); }
});

fsRouter.patch('/reports/:reportId', async (req: AuthRequest, res: Response): Promise<void> => {
  const id = idParam(req, res, 'reportId');
  if (id === null) return;
  const body = parseBody(fsUpdateReportSchema, req, res);
  if (!body) return;
  try {
    await reports.updateReport(id, body, uid(req));
    res.json({ data: await reports.getReport(id), error: null });
  } catch (err) { fail(res, err, 'fs-reports'); }
});

fsRouter.delete('/reports/:reportId', async (req: AuthRequest, res: Response): Promise<void> => {
  const id = idParam(req, res, 'reportId');
  if (id === null) return;
  try {
    await reports.archiveReport(id, uid(req));
    res.json({ data: { ok: true }, error: null });
  } catch (err) { fail(res, err, 'fs-reports'); }
});

const rollForwardSchema = z.object({
  periodId: z.number().int().positive(),
  name: z.string().trim().min(1).max(200).optional(),
});

fsRouter.post('/reports/:reportId/roll-forward', async (req: AuthRequest, res: Response): Promise<void> => {
  const id = idParam(req, res, 'reportId');
  if (id === null) return;
  const body = parseBody(rollForwardSchema, req, res);
  if (!body) return;
  try {
    const row = await reports.rollForward(id, body, uid(req));
    res.status(201).json({ data: { report: { id: row.id } }, error: null });
  } catch (err) { fail(res, err, 'fs-reports'); }
});

// What the browser needs to compute and render the live preview itself.
// GET = the saved state (a reviewer can read it); POST = an unsaved draft.
fsRouter.get('/reports/:reportId/preview-data', async (req: AuthRequest, res: Response): Promise<void> => {
  const id = idParam(req, res, 'reportId');
  if (id === null) return;
  try {
    res.json({ data: await reports.previewData(id), error: null });
  } catch (err) { fail(res, err, 'fs-preview-data'); }
});

fsRouter.post('/reports/:reportId/preview-data', async (req: AuthRequest, res: Response): Promise<void> => {
  const id = idParam(req, res, 'reportId');
  if (id === null) return;
  const body = parseBody(fsDraftOverridesSchema, req, res);
  if (!body) return;
  try {
    res.json({ data: await reports.previewData(id, body), error: null });
  } catch (err) { fail(res, err, 'fs-preview-data'); }
});

fsRouter.post('/reports/:reportId/compute', async (req: AuthRequest, res: Response): Promise<void> => {
  const id = idParam(req, res, 'reportId');
  if (id === null) return;
  const body = parseBody(fsDraftOverridesSchema, req, res);
  if (!body) return;
  try {
    const { model } = await reports.computeDraft(id, body);
    res.json({ data: { model }, error: null });
  } catch (err) { fail(res, err, 'fs-compute'); }
});

async function sendDraftPdf(res: Response, id: number, overrides: z.infer<typeof fsDraftOverridesSchema>): Promise<void> {
  const draft = await reports.computeDraft(id, overrides);
  const letterhead = library.letterheadOf(await library.getLetterheadRow());
  const letter = await reports.resolveLetter(draft, draft.source);
  const pdf = await renderFsPdf({
    report: draft.model, style: draft.style, frontMatter: draft.frontMatter, letterhead, letter,
    draft: draft.report.status !== 'final',
  });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', fileDisposition(engagementFilename(draft.period.periodName, draft.period.clientName, 'financial-statements-proof.pdf'), true));
  res.setHeader('Content-Length', String(pdf.bytes.length));
  res.send(pdf.bytes);
}

// The exact PDF of the draft, for the editor's proof view.
fsRouter.get('/reports/:reportId/preview.pdf', async (req: AuthRequest, res: Response): Promise<void> => {
  const id = idParam(req, res, 'reportId');
  if (id === null) return;
  try {
    await sendDraftPdf(res, id, {});
  } catch (err) { fail(res, err, 'fs-preview-pdf'); }
});

fsRouter.post('/reports/:reportId/preview.pdf', async (req: AuthRequest, res: Response): Promise<void> => {
  const id = idParam(req, res, 'reportId');
  if (id === null) return;
  const body = parseBody(fsDraftOverridesSchema, req, res);
  if (!body) return;
  try {
    await sendDraftPdf(res, id, body);
  } catch (err) { fail(res, err, 'fs-preview-pdf'); }
});

const exportQuerySchema = z.object({
  format: z.enum(['pdf', 'docx', 'xlsx']).default('pdf'),
  version: z.coerce.number().int().positive().optional(),
  preview: z.string().optional(),
});

fsRouter.get('/reports/:reportId/export', async (req: AuthRequest, res: Response): Promise<void> => {
  const id = idParam(req, res, 'reportId');
  if (id === null) return;
  const q = exportQuerySchema.safeParse(req.query);
  if (!q.success) {
    res.status(400).json({ data: null, error: { code: 'VALIDATION_ERROR', message: 'Invalid export request' } });
    return;
  }
  try {
    const out = await reports.exportReport(id, q.data.format, q.data.version ?? null);
    const row = await db('periods').join('clients', 'clients.id', 'periods.client_id')
      .where('periods.id', out.report.period_id).first('periods.period_name', 'clients.name as client_name');
    const filename = row ? engagementFilename(row.period_name as string, row.client_name as string, out.baseName) : out.baseName;
    await logAudit({
      userId: uid(req), periodId: out.report.period_id, clientId: out.report.client_id, entityType: 'fs_report', entityId: id, action: 'export',
      description: `Exported financial statements "${out.report.name}" (${q.data.format.toUpperCase()}${out.versionNo ? `, v${out.versionNo}` : ', draft'})`,
    });
    res.setHeader('Content-Type', out.mimeType);
    res.setHeader('Content-Disposition', fileDisposition(filename, q.data.preview === '1' && q.data.format === 'pdf'));
    res.setHeader('Content-Length', String(out.buffer.length));
    res.send(out.buffer);
  } catch (err) { fail(res, err, 'fs-export'); }
});

fsRouter.post('/reports/:reportId/finalize', async (req: AuthRequest, res: Response): Promise<void> => {
  const id = idParam(req, res, 'reportId');
  if (id === null) return;
  const body = parseBody(fsFinalizeSchema, req, res);
  if (!body) return;
  try {
    res.json({ data: await reports.finalize(id, body, uid(req)), error: null });
  } catch (err) { fail(res, err, 'fs-finalize'); }
});

fsRouter.post('/reports/:reportId/reopen', async (req: AuthRequest, res: Response): Promise<void> => {
  const id = idParam(req, res, 'reportId');
  if (id === null) return;
  try {
    await reports.reopen(id, uid(req));
    res.json({ data: { ok: true }, error: null });
  } catch (err) { fail(res, err, 'fs-reopen'); }
});

fsRouter.get('/reports/:reportId/versions/:versionNo', async (req: AuthRequest, res: Response): Promise<void> => {
  const id = idParam(req, res, 'reportId');
  const n = id === null ? null : idParam(req, res, 'versionNo');
  if (id === null || n === null) return;
  try {
    res.json({ data: await reports.versionDetail(id, n), error: null });
  } catch (err) { fail(res, err, 'fs-versions'); }
});

fsRouter.get('/reports/:reportId/versions/:versionNo/impact', async (req: AuthRequest, res: Response): Promise<void> => {
  const id = idParam(req, res, 'reportId');
  const n = id === null ? null : idParam(req, res, 'versionNo');
  if (id === null || n === null) return;
  try {
    res.json({ data: await reports.impact(id, n), error: null });
  } catch (err) { fail(res, err, 'fs-versions'); }
});

// Copies the issued PDF into the client's linked workpaper folder. Linking is
// explicit (see lib/clientFolders.ts): an unlinked client is refused with
// CLIENT_NOT_LINKED rather than having a folder invented for it.
fsRouter.post('/reports/:reportId/versions/:versionNo/save-to-folder', async (req: AuthRequest, res: Response): Promise<void> => {
  const id = idParam(req, res, 'reportId');
  const n = id === null ? null : idParam(req, res, 'versionNo');
  if (id === null || n === null) return;
  try {
    const out = await reports.exportReport(id, 'pdf', n);
    const row = await db('periods').join('clients', 'clients.id', 'periods.client_id')
      .where('periods.id', out.report.period_id).first('periods.period_name', 'clients.name as client_name');
    const filename = row ? engagementFilename(row.period_name as string, row.client_name as string, out.baseName) : out.baseName;
    const doc = await storeDocument({
      clientId: out.report.client_id, periodId: out.report.period_id, section: await workpaperSection(),
      filename, mimeType: 'application/pdf', buffer: out.buffer, uploadedBy: uid(req),
    });
    await logAudit({
      userId: uid(req), periodId: out.report.period_id, clientId: out.report.client_id, entityType: 'client_document', entityId: doc.id as number, action: 'create',
      description: `Saved financial statements "${out.report.name}" v${n} to documents`,
    });
    res.status(201).json({ data: { documentId: doc.id, filename, objectKey: doc.object_key, sizeBytes: out.buffer.length }, error: null });
  } catch (err) { fail(res, err, 'fs-save-to-folder'); }
});

// ─── /api/v1/clients/:clientId/fs ────────────────────────────────────────

export const fsClientRouter = Router({ mergeParams: true });
fsClientRouter.use(authMiddleware);

fsClientRouter.get('/reports', async (req: AuthRequest, res: Response): Promise<void> => {
  const clientId = idParam(req, res, 'clientId');
  if (clientId === null) return;
  try {
    const rows = await reports.listReports(clientId);
    res.json({ data: { reports: rows }, error: null, meta: { count: rows.length } });
  } catch (err) { fail(res, err, 'fs-reports'); }
});

fsClientRouter.get('/layouts', async (req: AuthRequest, res: Response): Promise<void> => {
  const clientId = idParam(req, res, 'clientId');
  if (clientId === null) return;
  try {
    res.json({ data: { layouts: await reports.listLayouts(clientId) }, error: null });
  } catch (err) { fail(res, err, 'fs-layouts'); }
});

// GET with ?templateId= so a reviewer can open the wizard's binding step too
// (nothing is written).
fsClientRouter.get('/bind-preview', async (req: AuthRequest, res: Response): Promise<void> => {
  const clientId = idParam(req, res, 'clientId');
  if (clientId === null) return;
  const raw = req.query.templateId;
  const templateId = raw === undefined || raw === '' ? null : Number(raw);
  if (templateId !== null && (!Number.isInteger(templateId) || templateId <= 0)) {
    res.status(400).json({ data: null, error: { code: 'INVALID_ID', message: 'Invalid templateId' } });
    return;
  }
  try {
    res.json({ data: await reports.bindPreview(clientId, templateId), error: null });
  } catch (err) { fail(res, err, 'fs-bind-preview'); }
});

interface AccountRow { id: number; account_number: string; account_name: string; category: string; lead_sheet_id: number | null; cash_flow_category: string | null }

const ACCOUNT_TYPE: Record<string, string> = { assets: 'asset', liabilities: 'liability', equity: 'equity', revenue: 'revenue', expenses: 'expense' };
const COA_CF: Record<string, FsCashFlowClass> = { cash: 'cash', operating: 'operating', investing: 'investing', financing: 'financing', non_cash: 'noncash_adjustment' };

async function clientAccounts(clientId: number): Promise<AccountRow[]> {
  return db('chart_of_accounts').where({ client_id: clientId, is_active: true }).orderBy('account_number')
    .select('id', 'account_number', 'account_name', 'category', 'lead_sheet_id', 'cash_flow_category') as Promise<AccountRow[]>;
}

// Every active account, for the editor's pickers. Ids are strings — they are
// keys in layout JSON (see lib/fs/engine/model.ts).
fsClientRouter.get('/accounts', async (req: AuthRequest, res: Response): Promise<void> => {
  const clientId = idParam(req, res, 'clientId');
  if (clientId === null) return;
  try {
    const rows = await clientAccounts(clientId);
    res.json({
      data: {
        accounts: rows.map((a) => ({
          id: String(a.id), number: a.account_number, name: a.account_name,
          accountType: ACCOUNT_TYPE[a.category] ?? 'expense', leadSheetId: a.lead_sheet_id === null ? null : String(a.lead_sheet_id),
        })),
      },
      error: null,
    });
  } catch (err) { fail(res, err, 'fs-accounts'); }
});

// Cash-flow classification. The response carries, per balance sheet account
// and per lead sheet, the override (if any) and what applies without one, so
// the panel can show "Operating (default)" beside each choice.
fsClientRouter.get('/cash-flow-overrides', async (req: AuthRequest, res: Response): Promise<void> => {
  const clientId = idParam(req, res, 'clientId');
  if (clientId === null) return;
  try {
    const [accounts, leadSheets, overrides] = await Promise.all([
      clientAccounts(clientId),
      db('lead_sheets').where({ client_id: clientId }).orderBy([{ column: 'sort_order' }, { column: 'id' }]).select('id', 'code', 'name') as Promise<Array<{ id: number; code: string | null; name: string }>>,
      db('fs_cash_flow_overrides').where({ client_id: clientId }).select('account_id', 'lead_sheet_id', 'classification') as Promise<Array<{ account_id: number | null; lead_sheet_id: number | null; classification: FsCashFlowClass }>>,
    ]);
    const byAccount = new Map(overrides.filter((o) => o.account_id !== null).map((o) => [o.account_id!, o.classification]));
    const bySheet = new Map(overrides.filter((o) => o.lead_sheet_id !== null).map((o) => [o.lead_sheet_id!, o.classification]));
    const sheetById = new Map(leadSheets.map((l) => [l.id, l]));
    res.json({
      data: {
        classes: FS_CF_CLASSES,
        leadSheets: leadSheets.map((l) => ({ id: String(l.id), code: l.code, name: l.name, override: bySheet.get(l.id) ?? null })),
        accounts: accounts
          .filter((a) => ['assets', 'liabilities', 'equity'].includes(a.category))
          .map((a) => {
            const sheet = a.lead_sheet_id !== null ? sheetById.get(a.lead_sheet_id) : undefined;
            const type = ACCOUNT_TYPE[a.category]!;
            // What applies with no Statement Writer override on the account.
            const fallback = (a.cash_flow_category ? COA_CF[a.cash_flow_category] : undefined)
              ?? (sheet && bySheet.get(sheet.id))
              ?? fsDefaultCashFlowClass({ accountType: type, name: a.account_name, detailType: null }, sheet?.code ?? null);
            return {
              id: String(a.id), number: a.account_number, name: a.account_name, accountType: type,
              leadSheetId: a.lead_sheet_id === null ? null : String(a.lead_sheet_id),
              override: byAccount.get(a.id) ?? null, fallback,
              fallbackSource: a.cash_flow_category && COA_CF[a.cash_flow_category] ? 'chart_of_accounts' : sheet && bySheet.get(sheet.id) ? 'lead_sheet' : 'default',
            };
          }),
      },
      error: null,
    });
  } catch (err) { fail(res, err, 'fs-cash-flow'); }
});

fsClientRouter.put('/cash-flow-overrides', async (req: AuthRequest, res: Response): Promise<void> => {
  const clientId = idParam(req, res, 'clientId');
  if (clientId === null) return;
  const body = parseBody(fsCashFlowOverridesSchema, req, res);
  if (!body) return;
  try {
    await db.transaction(async (trx) => {
      const ownAccounts = new Set((await trx('chart_of_accounts').where({ client_id: clientId }).pluck('id')) as number[]);
      const ownSheets = new Set((await trx('lead_sheets').where({ client_id: clientId }).pluck('id')) as number[]);
      for (const o of body.overrides) {
        const accountId = o.accountId ? Number(o.accountId) : null;
        const leadSheetId = o.groupingId ? Number(o.groupingId) : null;
        if ((accountId !== null && !ownAccounts.has(accountId)) || (leadSheetId !== null && !ownSheets.has(leadSheetId))) {
          throw new library.FsError('VALIDATION_ERROR', 400, 'An account or lead sheet in the request does not belong to this client.');
        }
        const where = accountId !== null ? { account_id: accountId } : { lead_sheet_id: leadSheetId };
        await trx('fs_cash_flow_overrides').where(where).delete();
        if (o.classification !== null) {
          await trx('fs_cash_flow_overrides').insert({ client_id: clientId, account_id: accountId, lead_sheet_id: leadSheetId, classification: o.classification });
        }
      }
      await logAudit({
        userId: uid(req), periodId: null, clientId, entityType: 'fs_cash_flow_override', entityId: null, action: 'update',
        description: `Changed the cash-flow classification of ${body.overrides.length} item${body.overrides.length === 1 ? '' : 's'}`,
      }, trx);
    });
    res.json({ data: { ok: true }, error: null });
  } catch (err) { fail(res, err, 'fs-cash-flow'); }
});

// Equity roles: which equity accounts are retained earnings, contributions
// and distributions, and which one net income is closed into.
fsClientRouter.get('/equity-roles', async (req: AuthRequest, res: Response): Promise<void> => {
  const clientId = idParam(req, res, 'clientId');
  if (clientId === null) return;
  try {
    const accounts = (await clientAccounts(clientId)).filter((a) => a.category === 'equity');
    const stored = (await db('fs_equity_roles').where({ client_id: clientId }).select('account_id', 'role', 'is_fold')) as Array<{ account_id: number; role: string; is_fold: boolean }>;
    const byId = new Map(stored.map((s) => [s.account_id, s]));
    res.json({
      data: {
        accounts: accounts.map((a) => ({
          id: String(a.id), number: a.account_number, name: a.account_name,
          role: byId.get(a.id)?.role ?? null, defaultRole: defaultEquityRole(a.account_name), isFold: !!byId.get(a.id)?.is_fold,
        })),
      },
      error: null,
    });
  } catch (err) { fail(res, err, 'fs-equity-roles'); }
});

fsClientRouter.put('/equity-roles', async (req: AuthRequest, res: Response): Promise<void> => {
  const clientId = idParam(req, res, 'clientId');
  if (clientId === null) return;
  const body = parseBody(fsEquityRolesSchema, req, res);
  if (!body) return;
  try {
    await db.transaction(async (trx) => {
      const own = new Set((await trx('chart_of_accounts').where({ client_id: clientId, category: 'equity' }).pluck('id')) as number[]);
      const ids = body.roles.map((r) => Number(r.accountId));
      if (ids.some((id) => !own.has(id))) {
        throw new library.FsError('VALIDATION_ERROR', 400, 'Equity roles can only be set on this client\'s equity accounts.');
      }
      // Clear the fold first: the partial unique index allows one per client,
      // and the new one may be a different account.
      if (body.roles.some((r) => r.isFold && r.role)) await trx('fs_equity_roles').where({ client_id: clientId }).update({ is_fold: false });
      for (const r of body.roles) {
        const accountId = Number(r.accountId);
        if (r.role === null) {
          await trx('fs_equity_roles').where({ account_id: accountId }).delete();
        } else {
          await trx('fs_equity_roles')
            .insert({ client_id: clientId, account_id: accountId, role: r.role, is_fold: !!r.isFold })
            .onConflict('account_id').merge({ role: r.role, is_fold: !!r.isFold, updated_at: trx.fn.now() });
        }
      }
      await logAudit({
        userId: uid(req), periodId: null, clientId, entityType: 'fs_equity_role', entityId: null, action: 'update',
        description: `Changed the equity role of ${body.roles.length} account${body.roles.length === 1 ? '' : 's'}`,
      }, trx);
    });
    res.json({ data: { ok: true }, error: null });
  } catch (err) { fail(res, err, 'fs-equity-roles'); }
});

// ─── /api/v1/periods/:periodId/fs ────────────────────────────────────────

export const fsPeriodRouter = Router({ mergeParams: true });
fsPeriodRouter.use(authMiddleware);

fsPeriodRouter.post('/reports', async (req: AuthRequest, res: Response): Promise<void> => {
  const periodId = idParam(req, res, 'periodId');
  if (periodId === null) return;
  const body = parseBody(fsCreateReportSchema, req, res);
  if (!body) return;
  try {
    const row = await reports.createReport(periodId, body, uid(req));
    res.status(201).json({ data: { report: { id: row.id } }, error: null });
  } catch (err) { fail(res, err, 'fs-reports'); }
});
