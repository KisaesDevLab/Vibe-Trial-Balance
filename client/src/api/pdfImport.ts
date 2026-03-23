import { apiFetch } from './client';

export interface DocumentImport {
  id: number;
  import_type: string;
  document_type: string | null;
  status: string;
  imported_at: string;
}

export interface VerificationDetail {
  accountName: string;
  accountNumber: string;
  pdfAmount: number | null;
  tbAmount: number | null;
  difference: number;
  status: 'match' | 'discrepancy' | 'missing_from_tb' | 'extra_in_tb';
  severity: 'none' | 'low' | 'medium' | 'high';
}

export interface VerificationSummary {
  total: number;
  matched: number;
  discrepancies: number;
  missingFromTb: number;
  extraInTb: number;
}

export interface VerificationResult {
  overallStatus: 'verified' | 'discrepancies';
  summary: VerificationSummary;
  details: VerificationDetail[];
}

export interface PdfMatchRow {
  pdfAccountName: string;
  pdfAccountNumber: string | null;
  pdfAmount: string;
  isDebit: boolean;
  debitCents: number;
  creditCents: number;
  matchedAccountId: number | null;
  matchedAccountNumber: string | null;
  matchedAccountName: string | null;
  confidence: number;
  matchType: 'exact' | 'fuzzy' | 'alias' | 'none';
  action: 'match' | 'create_new' | 'skip';
  category: string;
  // User-editable fields for create_new rows
  newCategory?: 'assets' | 'liabilities' | 'equity' | 'revenue' | 'expenses';
  newNormalBalance?: 'debit' | 'credit';
  newAccountNumber?: string;
}

export interface PdfAnalysisResult {
  documentType: 'trial_balance' | 'pl' | 'balance_sheet';
  detectedPeriod: string | null;
  matches: PdfMatchRow[];
  warnings: string[];
  extractedTextLength: number;
}

export interface PdfConfirmResult {
  accountsMatched: number;
  accountsCreated: number;
  rowsImported: number;
  rowsSkipped: number;
  accountsWithoutTaxCodes: number;
  total: number;
}

export async function analyzePdf(
  file: File,
  periodId: number,
  clientId: number,
): Promise<{ data: PdfAnalysisResult | null; error: { code: string; message: string } | null }> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('periodId', String(periodId));
  formData.append('clientId', String(clientId));
  return apiFetch<PdfAnalysisResult>('/import/pdf/analyze', {
    method: 'POST',
    body: formData,
  });
}

export async function confirmPdfImport(
  periodId: number,
  clientId: number,
  matches: PdfMatchRow[],
  aiExtraction: unknown,
): Promise<{ data: PdfConfirmResult | null; error: { code: string; message: string } | null }> {
  return apiFetch<PdfConfirmResult>('/import/pdf/confirm', {
    method: 'POST',
    body: JSON.stringify({ periodId, clientId, matches, aiExtraction }),
  });
}

export interface PdfChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface PdfChatResult {
  reply: string;
  revisedAnalysis: PdfAnalysisResult | null;
}

export interface PdfAccountNumberSuggestion {
  pdfAccountName: string;
  entryIndex: number;
  suggestedNumber: string;
  suggestedCategory: 'assets' | 'liabilities' | 'equity' | 'revenue' | 'expenses';
  suggestedNormalBalance: 'debit' | 'credit';
}

export async function chatPdfImport(
  analysis: PdfAnalysisResult,
  messages: PdfChatMessage[],
  userMessage: string,
  clientId: number,
): Promise<{ data: PdfChatResult | null; error: { code: string; message: string } | null }> {
  return apiFetch<PdfChatResult>('/import/pdf/chat', {
    method: 'POST',
    body: JSON.stringify({ analysis, messages, userMessage, clientId }),
  });
}

export async function suggestPdfAccountNumbers(
  clientId: number,
  matches: PdfMatchRow[],
): Promise<{ data: { suggestions: PdfAccountNumberSuggestion[] } | null; error: { code: string; message: string } | null }> {
  return apiFetch<{ suggestions: PdfAccountNumberSuggestion[] }>('/import/pdf/suggest-numbers', {
    method: 'POST',
    body: JSON.stringify({ clientId, matches }),
  });
}

export async function listImports(
  periodId: number,
): Promise<{ data: DocumentImport[] | null; error: { code: string; message: string } | null }> {
  return apiFetch<DocumentImport[]>(`/import/pdf/imports?periodId=${periodId}`);
}

export async function verifyImport(
  importId: number,
  periodId: number,
): Promise<{ data: VerificationResult | null; error: { code: string; message: string } | null }> {
  return apiFetch<VerificationResult>(`/import/pdf/verify/${importId}`, {
    method: 'POST',
    body: JSON.stringify({ periodId }),
  });
}

export async function getVerificationResult(
  importId: number,
): Promise<{ data: VerificationResult | null; error: { code: string; message: string } | null }> {
  return apiFetch<VerificationResult>(`/import/pdf/verify/${importId}`);
}
