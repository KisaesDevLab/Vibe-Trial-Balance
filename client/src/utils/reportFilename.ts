// Copyright 2025-2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Use is limited to qualifying small businesses. See LICENSE for terms.

/**
 * Naming for the files the browser builds itself (SheetJS workbooks) — a copy
 * of `server/src/lib/reportFilename.ts`, kept identical so a PDF the server
 * names and a spreadsheet the page names sit next to each other in Downloads:
 * `<period>_<client>_<report>`, e.g. "FY2024_Acme Holdings LLC_general-ledger.xlsx".
 * No internal id ever trails the report name.
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
