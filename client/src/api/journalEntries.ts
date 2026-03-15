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
  entry_type: 'book' | 'tax';
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

export const listJournalEntries = (periodId: number) =>
  apiFetch<JournalEntry[]>(`/periods/${periodId}/journal-entries`);

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

export const deleteJournalEntry = (id: number) =>
  apiFetch<{ id: number }>(`/journal-entries/${id}`, { method: 'DELETE' });
