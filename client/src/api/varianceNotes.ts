import { apiFetch } from './client';

export interface VarianceNote {
  id: number;
  period_id: number;
  account_id: number;
  compare_period_id: number;
  note: string;
  created_by: number;
  created_at: string;
}

export const listVarianceNotes = (periodId: number) =>
  apiFetch<VarianceNote[]>(`/periods/${periodId}/variance-notes`);

export const upsertVarianceNote = (periodId: number, accountId: number, note: string) =>
  apiFetch<VarianceNote | { deleted: boolean }>(`/periods/${periodId}/variance-notes/${accountId}`, {
    method: 'PUT',
    body: JSON.stringify({ note }),
  });
