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
  /** Net effect of the tagged PY true-up entries on this account. */
  trueUpDebit: number;
  trueUpCredit: number;
  /** uploaded + true-up — the prior year the adjustments imply. */
  adjustedPyDebit: number;
  adjustedPyCredit: number;
  /** adjusted − rolled, net debit. 0 = this account ties to the rolled prior year. */
  remainingVarianceCents: number;
}

/**
 * What the tagged PY true-up entries do. They are posted in the CURRENT year
 * because the prior one is closed, so this is the only place their effect on
 * the prior year is visible.
 */
export interface PyTrueUpSummary {
  trueUpEntries: number;
  trueUpDebitCents: number;
  trueUpCreditCents: number;
  /** Σ net debit of the upload as it stands. 0 = the bookkeeper's file balances. */
  uploadedNetCents: number;
  /** Σ net debit after the true-ups. 0 = the adjusted prior year balances. */
  adjustedNetCents: number;
  rolledNetCents: number;
  /** Accounts whose adjusted balance still differs from the rolled one. */
  accountsStillOff: number;
  /** Σ |adjusted − rolled|. Opposite misses do not cancel. */
  remainingAbsCents: number;
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
    trueUp: PyTrueUpSummary;
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
