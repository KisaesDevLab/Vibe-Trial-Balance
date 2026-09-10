// Copyright 2025-2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Use is limited to qualifying small businesses. See LICENSE for terms.

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
  is_active: boolean;
  in_current: boolean;
  in_compare: boolean;
  current_balance: number;
  compare_balance: number;
  variance_amount: number;
  variance_pct: number | null;
  note: string | null;
  /** Carried so the page can sub-group without a second round trip. */
  lead_sheet_id: number | null;
  lead_sheet_code: string | null;
  lead_sheet_name: string | null;
  lead_sheet_sort: number | null;
}

export type ComparisonBasis = 'unadjusted' | 'book' | 'tax';

export interface ComparisonData {
  period: ComparisonPeriod;
  comparePeriod: ComparisonPeriod;
  /** Echoed back so the page can label what it is showing. */
  basis: ComparisonBasis;
  rows: ComparisonRow[];
}

export const getComparison = (
  periodId: number,
  comparePeriodId: number,
  basis?: ComparisonBasis,
) =>
  apiFetch<ComparisonData>(
    `/periods/${periodId}/compare/${comparePeriodId}${basis ? `?basis=${basis}` : ''}`,
  );

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
