import { apiFetch } from './client';

export type ClassificationStatus = 'unclassified' | 'ai_suggested' | 'confirmed' | 'manual';

export interface BankTransaction {
  id: number;
  client_id: number;
  period_id: number | null;
  transaction_date: string;
  description: string | null;
  amount: number; // cents
  check_number: string | null;
  account_id: number | null;
  ai_suggested_account_id: number | null;
  ai_confidence: number | null;
  classification_status: ClassificationStatus;
  classified_by: number | null;
  imported_at: string;
  account_name: string | null;
  account_number: string | null;
  ai_suggested_account_name: string | null;
  ai_suggested_account_number: string | null;
}

export interface ClassificationRule {
  id: number;
  client_id: number;
  payee_pattern: string;
  account_id: number;
  times_confirmed: number;
  account_name: string;
  account_number: string;
}

export const listBankTransactions = (clientId: number, params?: { periodId?: number; status?: string }) => {
  const qs = new URLSearchParams();
  if (params?.periodId) qs.set('periodId', String(params.periodId));
  if (params?.status) qs.set('status', params.status);
  const q = qs.toString();
  return apiFetch<BankTransaction[]>(`/clients/${clientId}/bank-transactions${q ? `?${q}` : ''}`);
};

export const importBankTransactions = (clientId: number, file: File, periodId?: number) => {
  const formData = new FormData();
  formData.append('file', file);
  if (periodId) formData.append('periodId', String(periodId));
  return apiFetch<{ imported: number }>(`/clients/${clientId}/bank-transactions/import`, {
    method: 'POST',
    body: formData,
  });
};

export const createBankTransaction = (
  clientId: number,
  data: { transactionDate: string; description?: string; amount: number; checkNumber?: string; periodId?: number },
) =>
  apiFetch<BankTransaction>(`/clients/${clientId}/bank-transactions`, {
    method: 'POST',
    body: JSON.stringify(data),
  });

export const classifyTransaction = (
  clientId: number,
  id: number,
  data: { accountId?: number | null; periodId?: number | null; classificationStatus?: ClassificationStatus },
) =>
  apiFetch<BankTransaction>(`/clients/${clientId}/bank-transactions/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });

export const deleteBankTransaction = (clientId: number, id: number) =>
  apiFetch<{ deleted: number }>(`/clients/${clientId}/bank-transactions/${id}`, { method: 'DELETE' });

export const aiClassifyTransactions = (clientId: number, ids: number[]) =>
  apiFetch<{ classified: number; results: Array<{ id: number; accountId: number; confidence: number; reasoning: string }> }>(
    `/clients/${clientId}/bank-transactions/ai-classify`,
    { method: 'POST', body: JSON.stringify({ ids }) },
  );

export const listClassificationRules = (clientId: number) =>
  apiFetch<ClassificationRule[]>(`/clients/${clientId}/classification-rules`);

export const deleteClassificationRule = (clientId: number, id: number) =>
  apiFetch<{ deleted: number }>(`/clients/${clientId}/classification-rules/${id}`, { method: 'DELETE' });
