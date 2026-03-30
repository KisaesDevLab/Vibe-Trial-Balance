// SPDX-License-Identifier: BUSL-1.1
// Copyright (C) 2024–2026 Kisaes LLC

import { apiFetch } from './client';

export interface BankStatementTransaction {
  date: string;
  description: string;
  amount: number;
  checkNumber: string | null;
  payeeName: string | null;
  category: string | null;
}

export interface BankStatementAnalysisResult {
  bankName: string | null;
  accountNumberLast4: string | null;
  statementPeriod: { start: string; end: string } | null;
  openingBalance: number | null;
  closingBalance: number | null;
  transactions: BankStatementTransaction[];
  warnings: string[];
  visionMode: boolean;
  extractedTextLength: number;
}

export interface BankStatementConfirmResult {
  imported: number;
  duplicates: number;
  total: number;
}

export async function analyzeBankStatementPdf(
  file: File,
  clientId: number,
): Promise<{ data: BankStatementAnalysisResult | null; error: { code: string; message: string } | null }> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('clientId', String(clientId));
  return apiFetch<BankStatementAnalysisResult>('/import/bank-statement-pdf/analyze', {
    method: 'POST',
    body: formData,
  });
}

export async function confirmBankStatementPdfImport(
  clientId: number,
  periodId: number | null,
  sourceAccountId: number,
  transactions: BankStatementTransaction[],
): Promise<{ data: BankStatementConfirmResult | null; error: { code: string; message: string } | null }> {
  return apiFetch<BankStatementConfirmResult>('/import/bank-statement-pdf/confirm', {
    method: 'POST',
    body: JSON.stringify({ clientId, periodId, sourceAccountId, transactions }),
  });
}
