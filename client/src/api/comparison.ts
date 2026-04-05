// Copyright 2025-2026 Kisaes LLC
// Licensed under the Elastic License 2.0 (ELv2); you may not use this file
// except in compliance with the Elastic License 2.0.
// See LICENSE file in the project root for full license text.

import { apiFetch } from './client';

export interface ComparisonPeriod {
  id: number;
  period_name: string;
  start_date: string | null;
  end_date: string | null;
}

export interface ComparisonRow {
  account_id: number;
  account_number: string;
  account_name: string;
  category: string;
  normal_balance: string;
  current_balance: number;
  compare_balance: number;
  variance_amount: number;
  variance_pct: number | null;
  note: string | null;
}

export interface ComparisonData {
  period: ComparisonPeriod;
  comparePeriod: ComparisonPeriod;
  rows: ComparisonRow[];
}

export const getComparison = (periodId: number, comparePeriodId: number) =>
  apiFetch<ComparisonData>(`/periods/${periodId}/compare/${comparePeriodId}`);

export const upsertComparisonNote = (
  periodId: number,
  comparePeriodId: number,
  accountId: number,
  note: string,
) =>
  apiFetch<{ deleted?: boolean }>(`/periods/${periodId}/compare/${comparePeriodId}/variance-notes/${accountId}`, {
    method: 'PUT',
    body: JSON.stringify({ note }),
  });
