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
