// Copyright 2025-2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Use is limited to qualifying small businesses. See LICENSE for terms.

import { apiFetch } from './client';
import { API_BASE_URL } from '../lib/baseConfig';

export interface AttachmentAnnotation {
  id: string;
  page: number;
  xPct: number;
  yPct: number;
  symbol: string;
  color: string | null;
  note: string | null;
  createdBy?: number | null;
  createdAt?: string;
}

export interface LeadSheetAttachment {
  id: number;
  period_id: number;
  lead_sheet_id: number | null;
  lead_sheet_code: string;
  account_id: number | null;
  ref_code: string;
  document_id: number;
  source_file_name: string;
  annotations: AttachmentAnnotation[];
  created_at: string;
  file_size: number | null;
  file_type: string | null;
  created_by_name: string | null;
}

/** PDF, PNG and JPEG. Images are converted to PDF server-side on upload. */
export const ACCEPTED_ATTACHMENT_TYPES = 'application/pdf,image/png,image/jpeg';
export const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;

export const listAttachments = (periodId: number) =>
  apiFetch<LeadSheetAttachment[]>(`/periods/${periodId}/lead-sheet-attachments`);

export const listAttachmentsByAccount = (periodId: number) =>
  apiFetch<Record<number, Array<{ id: number; refCode: string }>>>(
    `/periods/${periodId}/lead-sheet-attachments/by-account`,
  );

/** The stored file — always the stamped one; there is no pristine variant. */
export const attachmentFileUrl = (id: number): string =>
  `${API_BASE_URL}/lead-sheet-attachments/${id}/file`;

function authToken(): string | null {
  const stored = localStorage.getItem('auth');
  if (!stored) return null;
  try {
    return (JSON.parse(stored) as { state?: { token?: string } }).state?.token ?? null;
  } catch {
    return null;
  }
}

/**
 * Uploads use raw fetch rather than apiFetch: apiFetch sets a JSON
 * Content-Type, which breaks multipart boundary negotiation.
 */
export async function uploadAttachment(
  periodId: number,
  file: File,
  opts: { leadSheetId?: number; accountId?: number },
): Promise<{ ok: true; refCode: string } | { ok: false; message: string }> {
  const form = new FormData();
  form.append('file', file);
  if (opts.leadSheetId) form.append('leadSheetId', String(opts.leadSheetId));
  if (opts.accountId) form.append('accountId', String(opts.accountId));

  const token = authToken();
  const res = await fetch(`${API_BASE_URL}/periods/${periodId}/lead-sheet-attachments`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: form,
  });
  const body = (await res.json().catch(() => null)) as
    | { data?: { ref_code?: string }; error?: { message?: string } }
    | null;
  if (!res.ok || !body?.data) {
    return { ok: false, message: body?.error?.message ?? `Upload failed (${res.status})` };
  }
  return { ok: true, refCode: body.data.ref_code ?? '' };
}

/** Fetch the stored PDF's bytes for rendering. */
export async function fetchAttachmentBytes(id: number): Promise<ArrayBuffer> {
  const token = authToken();
  const res = await fetch(attachmentFileUrl(id), {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) throw new Error(`Could not load the attachment (${res.status})`);
  return res.arrayBuffer();
}

export const addAnnotation = (
  attachmentId: number,
  input: { page: number; xPct: number; yPct: number; tickmarkId: number; note?: string },
) =>
  apiFetch<{ annotation: AttachmentAnnotation; permanent: true }>(
    `/lead-sheet-attachments/${attachmentId}/annotations`,
    { method: 'POST', body: JSON.stringify(input) },
  );

export const deleteAttachment = (id: number) =>
  apiFetch<{ id: number; refCode: string }>(`/lead-sheet-attachments/${id}`, { method: 'DELETE' });
