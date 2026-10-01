// Copyright 2025-2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Use is limited to qualifying small businesses. See LICENSE for terms.

// Statement Writer API (server/src/routes/fs.ts).
//
// Unlike most of this app's API modules, these functions THROW on an error
// envelope instead of returning it: TanStack Query needs a rejected promise
// to enter its error state, and the editor chains several calls per action.
// `FsApiError` carries the server's code and details (finalize returns the
// failing checks in `details`).

import { apiFetch } from './client';
import { API_BASE_URL } from '../lib/baseConfig';
import { useAuthStore } from '../store/uiStore';
import { filenameFromDisposition } from './pdfReports';
import type {
  FsCashFlowClass, FsCheck, FsColumnsConfig, FsCreateReportInput, FsEntityKind, FsEquityRole, FsFramework, FsFrontMatter,
  FsLayout, FsLetterhead, FsLetterheadInput, FsRenderedReport, FsReportSettings, FsSourceData, FsStyle, FsUnresolvedBinding,
} from '../lib/fsEngine';

export class FsApiError extends Error {
  constructor(public code: string, message: string, public details?: unknown) {
    super(message);
  }
}

export const fsErrorMessage = (e: unknown, fallback: string): string => (e instanceof Error && e.message ? e.message : fallback);

async function call<T>(path: string, init: RequestInit = {}): Promise<T> {
  const r = await apiFetch<T>(path, init);
  if (r.error) {
    throw new FsApiError(r.error.code, r.error.message, (r.error as { details?: unknown }).details);
  }
  return r.data as T;
}
const json = (method: string, body?: unknown): RequestInit => ({ method, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });

// ─── Shapes ───────────────────────────────────────────────────────────────

export interface FsPdfEngineStatus {
  available: boolean;
  path: string | null;
  source: 'setting' | 'env' | 'detected' | null;
  configuredPath: string | null;
  message: string;
}

export interface FsLibraryLetter {
  id: number; name: string; letterType: 'compilation' | 'preparation'; title: string | null; bodyHtml: string;
  isActive: boolean; isDefault: boolean; builtin: boolean; updatedAt: string | null;
}
export interface FsLibraryPreset { id: number; name: string; style: FsStyle; isDefault: boolean; builtin: boolean; updatedAt: string | null }
export interface FsLibraryTemplate { id: number; name: string; description: string | null; entityKind: string; layout: FsLayout; isDefault: boolean; updatedAt: string | null }
export type FsLibraryLetterhead = Required<FsLetterheadInput> & { updatedAt: string | null };
export interface FsLibrary {
  letterhead: FsLibraryLetterhead;
  letters: FsLibraryLetter[];
  presets: FsLibraryPreset[];
  templates: FsLibraryTemplate[];
}

export interface FsReportListItem {
  id: number; name: string; status: 'draft' | 'final';
  periodId: number; periodName: string; periodStart: string | null; periodEnd: string | null; periodLocked: boolean;
  framework: FsFramework; columns: FsColumnsConfig; updatedAt: string | null;
  currentVersion: { versionNo: number; finalizedAt: string | null; validationOverride: boolean; stale: boolean } | null;
}

export interface FsVersion {
  id: number; versionNo: number; status: 'final' | 'superseded'; finalizedAt: string | null; finalizedByName: string | null;
  validationOverride: boolean; overrideReason: string | null; pageCount: number | null; supersededAt: string | null;
  reopenedAt: string | null; hasFile: boolean; regenerated: boolean; stale: boolean;
}

export interface FsReportDetail {
  report: {
    id: number; name: string; status: 'draft' | 'final'; clientId: number; periodId: number; currentVersionId: number | null;
    settings: FsReportSettings; frontMatter: FsFrontMatter; updatedAt: string | null;
  };
  period: { id: number; clientId: number; clientName: string; name: string; start: string; end: string; locked: boolean };
  defaultEntityKind: FsEntityKind;
  layout: { id: number; clientId: number; name: string; layout: FsLayout; style: FsStyle; updatedAt: string | null };
  versions: FsVersion[];
}

export interface FsPreviewData {
  source: FsSourceData;
  letterhead: FsLetterhead | null;
  letter: { title: string; bodyHtml: string } | null;
}

export interface FsDraft { layout?: FsLayout; style?: FsStyle; settings?: FsReportSettings; frontMatter?: FsFrontMatter }

export interface FsBindPreview {
  unresolved: FsUnresolvedBinding[];
  groupings: Array<{ id: string; code: string | null; name: string }>;
}

export interface FsCashFlowData {
  classes: FsCashFlowClass[];
  leadSheets: Array<{ id: string; code: string | null; name: string; override: FsCashFlowClass | null }>;
  accounts: Array<{
    id: string; number: string; name: string; accountType: string; leadSheetId: string | null;
    override: FsCashFlowClass | null; fallback: FsCashFlowClass; fallbackSource: 'chart_of_accounts' | 'lead_sheet' | 'default';
  }>;
}

export interface FsEquityRoleAccount { id: string; number: string; name: string; role: FsEquityRole | null; defaultRole: FsEquityRole; isFold: boolean }

// ─── Calls ────────────────────────────────────────────────────────────────

export const fsApi = {
  status: () => call<{ pdfEngine: FsPdfEngineStatus }>('/fs/status'),
  setPdfEnginePath: (chromiumPath: string | null) => call<{ pdfEngine: FsPdfEngineStatus }>('/fs/pdf-engine', json('PUT', { chromiumPath })),
  testPdfEngine: () => call<{ ok: true; bytes: number }>('/fs/pdf-engine/test', json('POST')),

  library: () => call<FsLibrary>('/fs/library'),
  saveLetterhead: (input: FsLetterheadInput) => call<{ letterhead: FsLibraryLetterhead }>('/fs/library/letterhead', json('PUT', input)),
  saveLetter: ({ id, ...body }: { id?: number; name: string; letterType: 'compilation' | 'preparation'; title: string | null; bodyHtml: string; isDefault?: boolean; isActive?: boolean }) =>
    call<{ letter: FsLibraryLetter }>(id ? `/fs/library/letters/${id}` : '/fs/library/letters', json(id ? 'PUT' : 'POST', body)),
  deleteLetter: (id: number) => call<{ ok: true }>(`/fs/library/letters/${id}`, json('DELETE')),
  savePreset: ({ id, ...body }: { id?: number; name: string; style: FsStyle; isDefault?: boolean }) =>
    call<{ preset: FsLibraryPreset }>(id ? `/fs/library/presets/${id}` : '/fs/library/presets', json(id ? 'PUT' : 'POST', body)),
  deletePreset: (id: number) => call<{ ok: true }>(`/fs/library/presets/${id}`, json('DELETE')),
  updateTemplate: (id: number, body: { name?: string; description?: string | null; entityKind?: string; isDefault?: boolean }) =>
    call<{ template: FsLibraryTemplate }>(`/fs/library/templates/${id}`, json('PUT', body)),
  deleteTemplate: (id: number) => call<{ ok: true }>(`/fs/library/templates/${id}`, json('DELETE')),

  reports: (clientId: number) => call<{ reports: FsReportListItem[] }>(`/clients/${clientId}/fs/reports`),
  layouts: (clientId: number) => call<{ layouts: Array<{ id: number; name: string; updatedAt: string | null; sourceTemplateId: number | null }> }>(`/clients/${clientId}/fs/layouts`),
  bindPreview: (clientId: number, templateId: number | null) =>
    call<FsBindPreview>(`/clients/${clientId}/fs/bind-preview${templateId ? `?templateId=${templateId}` : ''}`),
  cashFlow: (clientId: number) => call<FsCashFlowData>(`/clients/${clientId}/fs/cash-flow-overrides`),
  saveCashFlow: (clientId: number, overrides: Array<{ accountId?: string | null; groupingId?: string | null; classification: FsCashFlowClass | null }>) =>
    call<{ ok: true }>(`/clients/${clientId}/fs/cash-flow-overrides`, json('PUT', { overrides })),
  equityRoles: (clientId: number) => call<{ accounts: FsEquityRoleAccount[] }>(`/clients/${clientId}/fs/equity-roles`),
  saveEquityRoles: (clientId: number, roles: Array<{ accountId: string; role: FsEquityRole | null; isFold?: boolean }>) =>
    call<{ ok: true }>(`/clients/${clientId}/fs/equity-roles`, json('PUT', { roles })),

  createReport: (periodId: number, input: FsCreateReportInput) => call<{ report: { id: number } }>(`/periods/${periodId}/fs/reports`, json('POST', input)),
  report: (id: number) => call<FsReportDetail>(`/fs/reports/${id}`),
  updateReport: (id: number, body: { name?: string; settings?: FsReportSettings; frontMatter?: FsFrontMatter }) => call<FsReportDetail>(`/fs/reports/${id}`, json('PATCH', body)),
  archiveReport: (id: number) => call<{ ok: true }>(`/fs/reports/${id}`, json('DELETE')),
  rollForward: (id: number, periodId: number) => call<{ report: { id: number } }>(`/fs/reports/${id}/roll-forward`, json('POST', { periodId })),
  // GET = the saved state (a read-only reviewer may call it); POST = an unsaved draft.
  previewData: (id: number, draft?: FsDraft) =>
    draft ? call<FsPreviewData>(`/fs/reports/${id}/preview-data`, json('POST', draft)) : call<FsPreviewData>(`/fs/reports/${id}/preview-data`),
  compute: (id: number, draft: FsDraft = {}) => call<{ model: FsRenderedReport }>(`/fs/reports/${id}/compute`, json('POST', draft)),
  saveLayout: (layoutId: number, body: { name?: string; layout?: FsLayout; style?: FsStyle; expectedUpdatedAt?: string }) =>
    call<{ layout: FsReportDetail['layout'] }>(`/fs/layouts/${layoutId}`, json('PATCH', body)),
  saveLayoutAsTemplate: (layoutId: number, name: string) => call<{ template: FsLibraryTemplate }>(`/fs/layouts/${layoutId}/save-as-template`, json('POST', { name })),
  finalize: (id: number, body: { overrideValidation?: boolean; reason?: string } = {}) =>
    call<{ versionNo: number; pageCount: number; validationOverride: boolean; periodUnlocked: boolean }>(`/fs/reports/${id}/finalize`, json('POST', body)),
  reopen: (id: number) => call<{ ok: true }>(`/fs/reports/${id}/reopen`, json('POST')),
  impact: (id: number, versionNo: number) => call<{ stale: boolean; changed: boolean }>(`/fs/reports/${id}/versions/${versionNo}/impact`),
  saveToFolder: (id: number, versionNo: number) =>
    call<{ documentId: number; filename: string }>(`/fs/reports/${id}/versions/${versionNo}/save-to-folder`, json('POST')),
};

/** The failing checks a refused finalize carries. */
export function finalizeChecks(e: unknown): FsCheck[] | null {
  if (!(e instanceof FsApiError) || e.code !== 'FS_VALIDATION') return null;
  return ((e.details as { checks?: FsCheck[] } | undefined)?.checks) ?? [];
}

// ─── Binary responses ─────────────────────────────────────────────────────

async function fetchBlob(path: string, init: RequestInit = {}): Promise<{ blob: Blob; filename: string | null }> {
  const token = useAuthStore.getState().token;
  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}${path}`, {
      ...init,
      headers: { ...(init.body ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    });
  } catch {
    throw new FsApiError('NETWORK_ERROR', 'Cannot reach server. Is it running?');
  }
  if (!res.ok) {
    let code = 'HTTP_ERROR';
    let message = `The server returned status ${res.status}.`;
    try {
      const body = (await res.json()) as { error?: { code?: string; message?: string } };
      if (body.error?.code) code = body.error.code;
      if (body.error?.message) message = body.error.message;
    } catch { /* not JSON — a proxy error page */ }
    throw new FsApiError(code, message);
  }
  return { blob: await res.blob(), filename: filenameFromDisposition(res.headers.get('Content-Disposition')) };
}

/** `versionNo` null = the current draft. The server names the file for the engagement. */
export async function downloadFsExport(id: number, format: 'pdf' | 'docx' | 'xlsx', versionNo: number | null): Promise<void> {
  const { blob, filename } = await fetchBlob(`/fs/reports/${id}/export?format=${format}${versionNo ? `&version=${versionNo}` : ''}`);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename ?? `financial-statements.${format}`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/** The exact PDF of the draft. With no `draft` it is a GET, which a read-only reviewer may call. */
export async function fetchFsPreviewPdf(id: number, draft?: FsDraft): Promise<Blob> {
  const path = `/fs/reports/${id}/preview.pdf`;
  return (await fetchBlob(path, draft ? { method: 'POST', body: JSON.stringify(draft) } : {})).blob;
}

/** Base URL of the public preview-font route (lib/fsEngine/render/html.ts appends the file name). */
export const FS_FONT_BASE_URL = `${API_BASE_URL}/fs-fonts`;
