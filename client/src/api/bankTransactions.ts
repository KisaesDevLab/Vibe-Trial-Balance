import { apiFetch } from './client';

export type ClassificationStatus = 'unclassified' | 'ai_suggested' | 'confirmed' | 'manual';

export interface BankTransaction {
  id: number;
  client_id: number;
  period_id: number | null;
  source_account_id: number | null;
  source_account_name: string | null;
  source_account_number: string | null;
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

export const listBankTransactions = (clientId: number, params?: { periodId?: number; status?: string; sourceAccountId?: number }) => {
  const qs = new URLSearchParams();
  if (params?.periodId) qs.set('periodId', String(params.periodId));
  if (params?.status) qs.set('status', params.status);
  if (params?.sourceAccountId) qs.set('sourceAccountId', String(params.sourceAccountId));
  const q = qs.toString();
  return apiFetch<BankTransaction[]>(`/clients/${clientId}/bank-transactions${q ? `?${q}` : ''}`);
};

export interface CsvMapping {
  dateCol: string;
  descCol: string;
  amountMode: 'single' | 'split';
  amountCol: string;
  debitCol: string;
  creditCol: string;
  checkCol: string;
}

export const importBankTransactions = (
  clientId: number,
  file: File,
  options?: { periodId?: number; sourceAccountId?: number; mapping?: CsvMapping },
) => {
  const formData = new FormData();
  formData.append('file', file);
  if (options?.periodId) formData.append('periodId', String(options.periodId));
  if (options?.sourceAccountId) formData.append('sourceAccountId', String(options.sourceAccountId));
  if (options?.mapping) {
    const m = options.mapping;
    if (m.dateCol) formData.append('dateCol', m.dateCol);
    if (m.descCol) formData.append('descCol', m.descCol);
    if (m.amountMode === 'single' && m.amountCol) formData.append('amountCol', m.amountCol);
    if (m.amountMode === 'split') {
      if (m.debitCol) formData.append('debitCol', m.debitCol);
      if (m.creditCol) formData.append('creditCol', m.creditCol);
    }
    if (m.checkCol) formData.append('checkCol', m.checkCol);
  }
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

const CHUNK = 250;

async function chunked<T extends { data: { deleted?: number; updated?: number } | null; error: { code: string; message: string } | null }>(
  ids: number[],
  fn: (chunk: number[]) => Promise<T>,
): Promise<{ data: { deleted?: number; updated?: number }; error: null }> {
  let total = 0;
  for (let i = 0; i < ids.length; i += CHUNK) {
    const res = await fn(ids.slice(i, i + CHUNK));
    if (res.error) throw new Error(res.error.message);
    total += (res.data?.deleted ?? res.data?.updated ?? 0);
  }
  return { data: { deleted: total, updated: total }, error: null };
}

export const batchDeleteTransactions = (clientId: number, ids: number[]) =>
  chunked(ids, (chunk) =>
    apiFetch<{ deleted: number }>(`/clients/${clientId}/bank-transactions/batch-delete`, {
      method: 'POST',
      body: JSON.stringify({ ids: chunk }),
    }),
  );

export const batchClassifyTransactions = (clientId: number, ids: number[], accountId: number) =>
  chunked(ids, (chunk) =>
    apiFetch<{ updated: number }>(`/clients/${clientId}/bank-transactions/batch-classify`, {
      method: 'POST',
      body: JSON.stringify({ ids: chunk, accountId }),
    }),
  );

export const batchUpdateSourceAccount = (clientId: number, ids: number[], sourceAccountId: number | null) =>
  chunked(ids, (chunk) =>
    apiFetch<{ updated: number }>(`/clients/${clientId}/bank-transactions/batch-update-source`, {
      method: 'POST',
      body: JSON.stringify({ ids: chunk, sourceAccountId }),
    }),
  );

export const aiClassifyTransactions = (clientId: number, ids: number[]) =>
  apiFetch<{ classified: number; results: Array<{ id: number; accountId: number; confidence: number; reasoning: string }> }>(
    `/clients/${clientId}/bank-transactions/ai-classify`,
    { method: 'POST', body: JSON.stringify({ ids }) },
  );

export const listClassificationRules = (clientId: number) =>
  apiFetch<ClassificationRule[]>(`/clients/${clientId}/classification-rules`);

export const deleteClassificationRule = (clientId: number, id: number) =>
  apiFetch<{ deleted: number }>(`/clients/${clientId}/classification-rules/${id}`, { method: 'DELETE' });
