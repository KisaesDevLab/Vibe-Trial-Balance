// Copyright 2025-2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Use is limited to qualifying small businesses. See LICENSE for terms.

import { API_BASE_URL } from '../lib/baseConfig';

// Helper to open/download a PDF from an authenticated endpoint
// Since fetch with auth headers can't directly trigger download, use this approach:
// 1. Fetch the PDF as a blob with the JWT Authorization header
// 2. Create an object URL from the blob
// 3. Either open in new tab (preview) or trigger download link

export async function openPdfPreview(url: string, token: string): Promise<void> {
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) {
    let detail = '';
    try {
      const body = await res.text();
      const parsed = JSON.parse(body);
      detail = parsed?.error?.message ?? body.slice(0, 200);
    } catch { /* ignore */ }
    throw new Error(`HTTP ${res.status}${detail ? ': ' + detail : ''}`);
  }
  const blob = await res.blob();
  const objectUrl = URL.createObjectURL(blob);
  window.open(objectUrl, '_blank');
}

/**
 * The name the server chose, off Content-Disposition. It carries the period and
 * client the report belongs to, which the caller here does not know — so it
 * wins, and the caller's name is only the fallback (an older server, or a
 * response whose header the browser withheld). RFC 5987 `filename*` is read
 * first: it is the form that survives a client name with an accent in it.
 */
function filenameFromDisposition(header: string | null): string | null {
  if (!header) return null;
  const encoded = /filename\*=UTF-8''([^;]+)/i.exec(header);
  if (encoded) {
    try { return decodeURIComponent(encoded[1].trim()); } catch { /* fall through to the plain form */ }
  }
  const plain = /filename="([^"]+)"/i.exec(header) ?? /filename=([^;]+)/i.exec(header);
  return plain ? plain[1].trim() : null;
}

/** `filename` is a fallback — the server's Content-Disposition name wins. */
export async function downloadPdf(url: string, filename: string, token: string): Promise<void> {
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) {
    let detail = '';
    try {
      const body = await res.text();
      const parsed = JSON.parse(body);
      detail = parsed?.error?.message ?? body.slice(0, 200);
    } catch { /* ignore */ }
    throw new Error(`HTTP ${res.status}${detail ? ': ' + detail : ''}`);
  }
  const serverName = filenameFromDisposition(res.headers.get('Content-Disposition'));
  const blob = await res.blob();
  const objectUrl = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = objectUrl;
  a.download = serverName || filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(objectUrl);
}

// Convenience wrappers for each report type
export const pdfReports = {
  trialBalance: (periodId: number) => `${API_BASE_URL}/reports/periods/${periodId}/trial-balance`,
  journalEntries: (periodId: number, type?: string) => `${API_BASE_URL}/reports/periods/${periodId}/journal-entries${type ? `?type=${type}` : ''}`,
  ajeListing: (periodId: number) => `${API_BASE_URL}/reports/periods/${periodId}/aje-listing`,
  generalLedger: (periodId: number, accountId?: number) => `${API_BASE_URL}/reports/periods/${periodId}/general-ledger${accountId ? `?accountId=${accountId}` : ''}`,
  incomeStatement: (periodId: number) => `${API_BASE_URL}/reports/periods/${periodId}/income-statement`,
  balanceSheet: (periodId: number) => `${API_BASE_URL}/reports/periods/${periodId}/balance-sheet`,
  taxCodeReport: (periodId: number) => `${API_BASE_URL}/reports/periods/${periodId}/tax-code-report`,
  workpaperIndex: (periodId: number) => `${API_BASE_URL}/reports/periods/${periodId}/workpaper-index`,
  taxBasisPl: (periodId: number) => `${API_BASE_URL}/reports/periods/${periodId}/tax-basis-pl`,
  taxReturnOrder: (periodId: number) => `${API_BASE_URL}/reports/periods/${periodId}/tax-return-order`,
  cashFlow: (periodId: number) => `${API_BASE_URL}/reports/periods/${periodId}/cash-flow`,
  m1: (periodId: number) => `${API_BASE_URL}/reports/periods/${periodId}/m1`,
  taxBasisSchedule: (periodId: number) => `${API_BASE_URL}/reports/periods/${periodId}/tax-basis-schedule`,
  workpaperMerged: (periodId: number, reportIds: string[]) =>
    `${API_BASE_URL}/reports/periods/${periodId}/workpaper-merged?reports=${reportIds.join(',')}`,
};
