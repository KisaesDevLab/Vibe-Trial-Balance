// Copyright 2025-2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Use is limited to qualifying small businesses. See LICENSE for terms.

import { apiFetch } from './client';

// ─── Types ─────────────────────────────────────────────────────────────────

export interface PyComparisonAccount {
  accountId: number;
  accountNumber: string;
  accountName: string;
  category: string;
  rolledPyDebit: number;
  rolledPyCredit: number;
  uploadedPyDebit: number;
  uploadedPyCredit: number;
  varianceDebit: number;
  varianceCredit: number;
  status: 'match' | 'diff';
}

export interface PyComparisonResult {
  source: {
    type: string;
    filename: string | null;
    uploadedAt: string;
  };
  accounts: PyComparisonAccount[];
  summary: {
    totalAccounts: number;
    matched: number;
    variances: number;
    netVarianceCents: number;
  };
}

export interface PyAjeRequest {
  entryType: 'book' | 'tax';
  description?: string;
  offsetAccountId: number;
  accountIds: number[];
  /** Swap debit and credit on every line, offset included — e.g. to back out a previous true-up. */
  reverse?: boolean;
}

// ─── API Functions ─────────────────────────────────────────────────────────

export const getComparison = (periodId: number) =>
  apiFetch<PyComparisonResult | null>(`/periods/${periodId}/py-comparison`);

export const savePyManual = (periodId: number, accounts: Array<{ accountId: number; debit: number; credit: number }>) =>
  apiFetch<{ saved: number }>(`/periods/${periodId}/py-comparison/manual`, {
    method: 'POST',
    body: JSON.stringify({ accounts }),
  });

export const confirmCsvPyImport = (
  periodId: number,
  clientId: number,
  matches: unknown[],
  sourceType: 'csv' | 'excel',
  sourceFilename?: string,
) =>
  apiFetch<{ imported: number; skipped: number; created: number; total: number }>(`/periods/${periodId}/py-comparison/confirm-csv`, {
    method: 'POST',
    body: JSON.stringify({ clientId, matches, sourceType, sourceFilename }),
  });

export const confirmPdfPyImport = (
  periodId: number,
  clientId: number,
  matches: unknown[],
  sourceFilename?: string,
) =>
  apiFetch<{ imported: number; skipped: number; created: number; total: number }>(`/periods/${periodId}/py-comparison/confirm-pdf`, {
    method: 'POST',
    body: JSON.stringify({ clientId, matches, sourceFilename }),
  });

export const clearPyData = (periodId: number) =>
  apiFetch<{ deleted: number }>(`/periods/${periodId}/py-comparison`, {
    method: 'DELETE',
  });

export const createPyAje = (periodId: number, body: PyAjeRequest) =>
  apiFetch<unknown>(`/periods/${periodId}/py-comparison/create-aje`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
