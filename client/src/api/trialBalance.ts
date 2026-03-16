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
  sort_order: number;
  is_active: boolean;
  preparer_notes: string | null;
  reviewer_notes: string | null;
  unadjusted_debit: number;
  unadjusted_credit: number;
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
