// Copyright 2025-2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Use is limited to qualifying small businesses. See LICENSE for terms.

import { apiFetch } from './client';

export interface TBRow {
  period_id: number;
  account_id: number;
  account_number: string;
  account_name: string;
  category: 'assets' | 'liabilities' | 'equity' | 'revenue' | 'expenses';
  normal_balance: 'debit' | 'credit';
  tax_line: string | null;
  workpaper_ref: string | null;
  unit: string | null;
  lead_sheet_id: number | null;
  lead_sheet_code: string | null;
  lead_sheet_name: string | null;
  lead_sheet_sort: number | null;
  is_active: boolean;
  preparer_notes: string | null;
  reviewer_notes: string | null;
  // ISO timestamp of the underlying trial_balance row — sent back with PUT as
  // expectedUpdatedAt so the server can reject stale writes with a 409.
  // Optional because some derived TBRow-like objects don't carry it.
  row_updated_at?: string | null;
  unadjusted_debit: number;
  unadjusted_credit: number;
  prior_year_debit: number;
  prior_year_credit: number;
  trans_adj_debit: number;
  trans_adj_credit: number;
  post_trans_debit: number;
  post_trans_credit: number;
  /**
   * Book AJEs AND reclassifying entries (RJEs): `getTrialBalance` folds the
   * view's `reclass_adj_*` in, because every screen shows RJEs in the book AJE
   * column (owner 2026-11-22), headed "Book AJEs & reclasses" when any exist,
   * and unadjusted + trans + this then foots to book adjusted.
   */
  book_adj_debit: number;
  book_adj_credit: number;
  tax_adj_debit: number;
  tax_adj_credit: number;
  /** Reclassifying entries alone (already inside book_adj_* above); for the heading. */
  reclass_adj_debit?: number;
  reclass_adj_credit?: number;
  book_adjusted_debit: number;
  book_adjusted_credit: number;
  tax_adjusted_debit: number;
  tax_adjusted_credit: number;
}

export const getTrialBalance = async (periodId: number) => {
  const res = await apiFetch<TBRow[]>(`/periods/${periodId}/trial-balance`);
  return res.data ? { ...res, data: res.data.map(foldReclass) } : res;
};

/** RJEs into the book AJE layer (see `book_adj_debit`). */
export function foldReclass(r: TBRow): TBRow {
  const d = Number(r.reclass_adj_debit ?? 0);
  const c = Number(r.reclass_adj_credit ?? 0);
  return d === 0 && c === 0 ? r : { ...r, book_adj_debit: r.book_adj_debit + d, book_adj_credit: r.book_adj_credit + c };
}

export const initializeTrialBalance = (periodId: number) =>
  apiFetch<{ initialized: number; removed: number }>(`/periods/${periodId}/trial-balance/initialize`, {
    method: 'POST',
  });

export interface TBImportRow {
  accountNumber: string;
  accountName?: string;
  debit: number;
  credit: number;
}

export const importTBBalances = (periodId: number, rows: TBImportRow[]) =>
  apiFetch<{ upserted: number; skipped: number; total: number }>(
    `/periods/${periodId}/trial-balance/import`,
    { method: 'POST', body: JSON.stringify({ rows }) },
  );

export const importPriorYearBalances = (periodId: number, rows: TBImportRow[]) =>
  apiFetch<{ upserted: number; skipped: number; total: number }>(
    `/periods/${periodId}/trial-balance/import-prior-year`,
    { method: 'POST', body: JSON.stringify({ rows }) },
  );

export interface UpdateBalanceResult {
  periodId: number;
  accountId: number;
  unadjustedDebit: number;
  unadjustedCredit: number;
  updatedAt: string | null;
}

export const updateBalance = (
  periodId: number,
  accountId: number,
  unadjustedDebit: number,
  unadjustedCredit: number,
  expectedUpdatedAt?: string | null,
) =>
  apiFetch<UpdateBalanceResult>(`/periods/${periodId}/trial-balance/${accountId}`, {
    method: 'PUT',
    body: JSON.stringify({
      unadjustedDebit,
      unadjustedCredit,
      ...(expectedUpdatedAt ? { expectedUpdatedAt } : {}),
    }),
  });
