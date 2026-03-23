import { apiFetch } from './client';

export interface JELine {
  id?: number;
  journal_entry_id?: number;
  account_id: number;
  account_number?: string;
  account_name?: string;
  debit: number;
  credit: number;
}

export interface JournalEntry {
  id: number;
  period_id: number;
  entry_number: number;
  entry_type: 'book' | 'tax' | 'trans';
  entry_date: string;
  description: string | null;
  is_recurring: boolean;
  created_by: number | null;
  created_at: string;
  updated_at: string;
  lines: JELine[];
}

export interface JEInput {
  periodId: number;
  entryType: 'book' | 'tax';
  entryDate: string;
  description?: string;
  isRecurring?: boolean;
  lines: { accountId: number; debit: number; credit: number }[];
}

export const listJournalEntries = (periodId: number, type?: 'book' | 'tax' | 'trans', accountId?: number) => {
  const params = new URLSearchParams();
  if (type) params.set('type', type);
  if (accountId !== undefined) params.set('accountId', String(accountId));
  const qs = params.toString() ? `?${params.toString()}` : '';
  return apiFetch<JournalEntry[]>(`/periods/${periodId}/journal-entries${qs}`);
};

export const createJournalEntry = (input: JEInput) =>
  apiFetch<JournalEntry>('/journal-entries', {
    method: 'POST',
    body: JSON.stringify(input),
  });

export const getJournalEntry = (id: number) =>
  apiFetch<JournalEntry>(`/journal-entries/${id}`);

export const updateJELines = (
  id: number,
  lines: { accountId: number; debit: number; credit: number }[],
) =>
  apiFetch<unknown>(`/journal-entries/${id}/lines`, {
    method: 'PUT',
    body: JSON.stringify({ lines }),
  });

export const updateJournalEntry = (
  id: number,
  data: {
    entryType?: 'book' | 'tax';
    entryDate?: string;
    description?: string | null;
    lines?: { accountId: number; debit: number; credit: number }[];
  },
) =>
  apiFetch<JournalEntry>(`/journal-entries/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });

export const deleteJournalEntry = (id: number) =>
  apiFetch<{ id: number }>(`/journal-entries/${id}`, { method: 'DELETE' });
