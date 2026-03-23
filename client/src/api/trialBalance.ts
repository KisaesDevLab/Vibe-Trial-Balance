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
  is_active: boolean;
  preparer_notes: string | null;
  reviewer_notes: string | null;
  unadjusted_debit: number;
  unadjusted_credit: number;
  prior_year_debit: number;
  prior_year_credit: number;
  trans_adj_debit: number;
  trans_adj_credit: number;
  post_trans_debit: number;
  post_trans_credit: number;
  book_adj_debit: number;
  book_adj_credit: number;
  tax_adj_debit: number;
  tax_adj_credit: number;
  book_adjusted_debit: number;
  book_adjusted_credit: number;
  tax_adjusted_debit: number;
  tax_adjusted_credit: number;
}

export const getTrialBalance = (periodId: number) =>
  apiFetch<TBRow[]>(`/periods/${periodId}/trial-balance`);

export const initializeTrialBalance = (periodId: number) =>
  apiFetch<{ initialized: number; removed: number }>(`/periods/${periodId}/trial-balance/initialize`, {
    method: 'POST',
  });

export interface TBImportRow {
  accountNumber: string;
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

export const updateBalance = (
  periodId: number,
  accountId: number,
  unadjustedDebit: number,
  unadjustedCredit: number,
) =>
  apiFetch<unknown>(`/periods/${periodId}/trial-balance/${accountId}`, {
    method: 'PUT',
    body: JSON.stringify({ unadjustedDebit, unadjustedCredit }),
  });
