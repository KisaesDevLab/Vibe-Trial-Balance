// Copyright 2025-2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Use is limited to qualifying small businesses. See LICENSE for terms.

/**
 * Naming for the PDFs the app hands to the browser. Report files carry the
 * engagement they belong to — "FY2024_Acme Holdings LLC_trial-balance-12.pdf" —
 * so a folder of downloads sorts by period and client instead of by report
 * type, and a file that leaves the app still says what it is.
 */

/** Characters no filesystem wants, plus the whitespace runs they leave behind. */
export function safeFilePart(raw: string | null | undefined): string {
  return String(raw ?? '')
    .replace(/[\\\/:*?"<>|\r\n\t]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\.+$/, '');
}

/** `<period>_<client>_<baseName>`, dropping either part that is missing. */
export function engagementFilename(
  periodName: string | null | undefined,
  clientName: string | null | undefined,
  baseName: string,
): string {
  const prefix = [safeFilePart(periodName), safeFilePart(clientName)].filter(Boolean).join('_');
  return prefix ? `${prefix}_${baseName}` : baseName;
}

/**
 * Content-Disposition for a PDF. A client name carries whatever a firm's
 * letterhead does — accents, ampersands, commas — so the header sends both
 * forms: a plain-ASCII fallback and the RFC 5987 encoding browsers prefer.
 */
export function pdfDisposition(filename: string, preview: boolean): string {
  const ascii = filename.replace(/[^\x20-\x7E]/g, '_').replace(/"/g, '');
  const type = preview ? 'inline' : 'attachment';
  return `${type}; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(filename)}`;
}
