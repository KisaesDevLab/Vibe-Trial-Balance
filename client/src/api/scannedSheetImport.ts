// Copyright 2025-2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Use is limited to qualifying small businesses. See LICENSE for terms.

import { apiFetch, type ApiResult } from './client';

// Mirrors server/src/routes/scannedSheetImport.ts

export type UncertainField = 'amount' | 'description' | 'sign' | 'date' | 'ref';

export interface ScannedSheetRow {
  page: number;
  line: number;
  description: string;
  rawText: string | null;
  /** Signed integer cents: positive = money in, negative = money out. */
  amount: number;
  direction: 'in' | 'out' | 'unknown';
  /** Only when a date was actually written on the line. */
  date: string | null;
  ref: string | null;
  /** Exact name from the client's known payees, or null. */
  matchedPayee: string | null;
  /** 0..1 for the row as a whole. */
  confidence: number;
  uncertain: UncertainField[];
}

export interface ScannedSheetPage {
  page: number;
  /** data:image/jpeg;base64,… */
  imageDataUrl: string;
}

export interface ScannedSheetAnalysisResult {
  rows: ScannedSheetRow[];
  pages: ScannedSheetPage[];
  pageCount: number;
  processedPages: number;
  sheetDate: string;
  warnings: string[];
  visionMode: boolean;
  ocrMode: boolean;
}

export async function analyzeScannedSheet(
  file: File,
  clientId: number,
  opts: { sheetDate: string; useOcr?: boolean; payeeHints?: boolean; signal?: AbortSignal },
): Promise<ApiResult<ScannedSheetAnalysisResult>> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('clientId', String(clientId));
  formData.append('sheetDate', opts.sheetDate);
  if (opts.useOcr) formData.append('useOcr', 'true');
  if (opts.payeeHints === false) formData.append('payeeHints', 'false');
  return apiFetch<ScannedSheetAnalysisResult>('/import/scanned-sheet/analyze', {
    method: 'POST',
    body: formData,
    signal: opts.signal,
  });
}

// ── AI category suggestions (second pass) ────────────────────────────────────

export interface CategorizeRowInput {
  key: number;
  payee: string;
  description?: string;
  /** Signed cents. */
  amount: number;
  date?: string;
}

export interface CategorySuggestion {
  key: number;
  accountId: number;
  confidence: number;
  reasoning: string;
}

export const categorizeScannedRows = (clientId: number, rows: CategorizeRowInput[], signal?: AbortSignal) =>
  apiFetch<{ suggestions: CategorySuggestion[] }>('/import/scanned-sheet/categorize', {
    method: 'POST',
    body: JSON.stringify({ clientId, rows }),
    signal,
  });
