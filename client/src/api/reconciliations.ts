import { apiFetch } from './client';

export interface Reconciliation {
  id: number;
  client_id: number;
  source_account_id: number;
  period_id: number | null;
  statement_date: string;
  statement_ending_balance: number;  // cents
  beginning_book_balance: number;    // cents
  status: 'open' | 'completed';
  notes: string | null;
  created_by: number | null;
  completed_by: number | null;
  completed_at: string | null;
  created_at: string;
  // joined
  account_number?: string;
  account_name?: string;
  completed_by_name?: string | null;
}

export interface ReconciliationTransaction {
  id: number;
  transaction_date: string;
  description: string | null;
  amount: number;         // cents
  check_number: string | null;
  classification_status: string;
  is_cleared: boolean;
}

export interface ReconciliationDetail {
  reconciliation: Reconciliation;
  transactions: ReconciliationTransaction[];
}

export interface ReconciliationInput {
  sourceAccountId: number;
  periodId?: number;
  statementDate: string;
  statementEndingBalance: number;   // cents
  beginningBookBalance?: number;    // cents
  notes?: string;
}

export const listReconciliations = (clientId: number) =>
  apiFetch<Reconciliation[]>(`/clients/${clientId}/reconciliations`);

export const createReconciliation = (clientId: number, input: ReconciliationInput) =>
  apiFetch<Reconciliation>(`/clients/${clientId}/reconciliations`, {
    method: 'POST',
    body: JSON.stringify(input),
  });

export const getReconciliation = (id: number) =>
  apiFetch<ReconciliationDetail>(`/reconciliations/${id}`);

export const updateReconciliation = (id: number, input: { statementEndingBalance?: number; beginningBookBalance?: number; notes?: string | null }) =>
  apiFetch<Reconciliation>(`/reconciliations/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });

export const toggleReconciliationItem = (id: number, transactionId: number) =>
  apiFetch<{ cleared: boolean; transactionId: number }>(`/reconciliations/${id}/toggle-item`, {
    method: 'POST',
    body: JSON.stringify({ transactionId }),
  });

export const completeReconciliation = (id: number) =>
  apiFetch<Reconciliation>(`/reconciliations/${id}/complete`, { method: 'POST' });

export const deleteReconciliation = (id: number) =>
  apiFetch<{ id: number }>(`/reconciliations/${id}`, { method: 'DELETE' });

export const reopenReconciliation = (id: number) =>
  apiFetch<Reconciliation>(`/reconciliations/${id}/reopen`, { method: 'POST' });
