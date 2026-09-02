// Copyright 2025-2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Use is limited to qualifying small businesses. See LICENSE for terms.

import { apiFetch } from './client';

export interface CsvMatchRow {
  csvRow: number;
  csvAccountNumber: string | null;
  csvAccountName: string | null;
  csvDebit: string | null;
  csvCredit: string | null;
  matchedAccountId: number | null;
  matchedAccountNumber: string | null;
  matchedAccountName: string | null;
  confidence: number;
  matchType: 'exact' | 'qbo_id' | 'fuzzy' | 'alias' | 'none';
  action: 'match' | 'create_new' | 'skip';
  debitCents: number;
  creditCents: number;
  // User-editable fields for create_new rows
  newCategory?: 'assets' | 'liabilities' | 'equity' | 'revenue' | 'expenses';
  newNormalBalance?: 'debit' | 'credit';
  newAccountNumber?: string;
  // Present only when the file was a recognised layout (Balances export):
  // the P&L flag that set the type, and the QuickBooks id/name the confirm
  // writes onto the chart of accounts. Round-tripped untouched.
  pnl?: 'Y' | 'N' | null;
  qboAccountId?: string | null;
  qboAccountName?: string | null;
}

/** A file layout the server recognised from its header row; null = generic file. */
export type DetectedImportFormat = 'balances_export';

export interface CsvAnalysisResult {
  delimiter: string;
  hasHeaders: boolean;
  headerRow: number;
  dataStartRow: number;
  amountFormat: 'separate_dr_cr' | 'single_signed' | 'single_parentheses';
  columns: {
    accountNumber: number | null;
    accountName: number | null;
    debit: number | null;
    credit: number | null;
    amount: number | null;
    pnl?: number | null;
    qboAccountName?: number | null;
    qboAccountId?: number | null;
  };
  rowsToSkip: number[];
  matches: CsvMatchRow[];
  detectedFormat?: DetectedImportFormat | null;
  fallbackMode: boolean;
  totalRows: number;
  rawPreview: string[];
}

export interface CsvConfirmResult {
  accountsMatched: number;
  accountsCreated: number;
  rowsImported: number;
  rowsSkipped: number;
  accountsWithoutTaxCodes: number;
  total: number;
  /** QuickBooks ids written onto the chart of accounts (Balances export). */
  qboIdsLinked?: number;
  /** Ids the confirm deliberately left alone, one sentence each. */
  qboWarnings?: string[];
}

export async function analyzeCsv(
  file: File,
  periodId: number,
  clientId: number,
): Promise<{ data: CsvAnalysisResult | null; error: { code: string; message: string } | null }> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('periodId', String(periodId));
  formData.append('clientId', String(clientId));
  const result = await apiFetch<CsvAnalysisResult>('/import/csv/analyze', {
    method: 'POST',
    body: formData,
  });
  return result;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface ChatCsvResult {
  reply: string;
  revisedAnalysis: CsvAnalysisResult | null;
}

export async function chatCsvImport(
  rawPreview: string[],
  analysis: CsvAnalysisResult,
  messages: ChatMessage[],
  userMessage: string,
  clientId: number,
): Promise<{ data: ChatCsvResult | null; error: { code: string; message: string } | null }> {
  return apiFetch<ChatCsvResult>('/import/csv/chat', {
    method: 'POST',
    body: JSON.stringify({ rawPreview, analysis, messages, userMessage, clientId }),
  });
}

export interface AccountNumberSuggestion {
  csvRow: number;
  csvAccountName: string | null;
  suggestedNumber: string;
  suggestedCategory: 'assets' | 'liabilities' | 'equity' | 'revenue' | 'expenses';
  suggestedNormalBalance: 'debit' | 'credit';
}

/**
 * Suggest account numbers for the rows passed in. Call this a chunk at a time
 * (see SUGGEST_CHUNK_SIZE in CsvImportDialog): a whole trial balance in one
 * request runs long enough for the proxy in front of the AI router to abandon
 * it with a 524. `reservedNumbers` carries the numbers earlier chunks already
 * claimed so this one doesn't hand out the same ones.
 */
export async function suggestAccountNumbers(
  clientId: number,
  matches: CsvMatchRow[],
  reservedNumbers: string[] = [],
): Promise<{ data: { suggestions: AccountNumberSuggestion[] } | null; error: { code: string; message: string } | null }> {
  return apiFetch<{ suggestions: AccountNumberSuggestion[] }>('/import/csv/suggest-numbers', {
    method: 'POST',
    body: JSON.stringify({ clientId, matches, reservedNumbers }),
  });
}

export async function confirmCsvImport(
  periodId: number,
  clientId: number,
  matches: CsvMatchRow[],
  aiExtraction: unknown,
): Promise<{ data: CsvConfirmResult | null; error: { code: string; message: string } | null }> {
  return apiFetch<CsvConfirmResult>('/import/csv/confirm', {
    method: 'POST',
    body: JSON.stringify({ periodId, clientId, matches, aiExtraction }),
  });
}
