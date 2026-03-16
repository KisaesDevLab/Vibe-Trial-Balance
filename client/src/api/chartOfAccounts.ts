import { apiFetch } from './client';

export interface Account {
  id: number;
  client_id: number;
  account_number: string;
  account_name: string;
  category: 'assets' | 'liabilities' | 'equity' | 'revenue' | 'expenses';
  subcategory: string | null;
  normal_balance: 'debit' | 'credit';
  tax_line: string | null;
  workpaper_ref: string | null;
  preparer_notes: string | null;
  reviewer_notes: string | null;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface AccountInput {
  accountNumber: string;
  accountName: string;
  category: 'assets' | 'liabilities' | 'equity' | 'revenue' | 'expenses';
  subcategory?: string;
  normalBalance: 'debit' | 'credit';
  taxLine?: string;
  workpaperRef?: string;
  preparerNotes?: string;
  reviewerNotes?: string;
  sortOrder?: number;
}

export const listAccounts = (clientId: number) =>
  apiFetch<Account[]>(`/clients/${clientId}/chart-of-accounts`);

export const createAccount = (clientId: number, input: AccountInput) =>
  apiFetch<Account>(`/clients/${clientId}/chart-of-accounts`, {
    method: 'POST',
    body: JSON.stringify(input),
  });

export const updateAccount = (id: number, input: Partial<AccountInput>) =>
  apiFetch<Account>(`/chart-of-accounts/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });

export const deleteAccount = (id: number) =>
  apiFetch<{ id: number }>(`/chart-of-accounts/${id}`, { method: 'DELETE' });

export const importAccounts = (clientId: number, rows: AccountInput[]) =>
  apiFetch<{ inserted: number; updated: number; total: number }>(
    `/clients/${clientId}/chart-of-accounts/import`,
    { method: 'POST', body: JSON.stringify({ rows }) },
  );

export const copyAccountsFromClient = (clientId: number, sourceClientId: number, overwrite: boolean) =>
  apiFetch<{ inserted: number; updated: number; skipped: number; total: number }>(
    `/clients/${clientId}/chart-of-accounts/copy-from/${sourceClientId}?overwrite=${overwrite}`,
    { method: 'POST' },
  );
