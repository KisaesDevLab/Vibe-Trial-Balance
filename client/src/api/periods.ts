import { apiFetch } from './client';

export interface Period {
  id: number;
  client_id: number;
  period_name: string;
  start_date: string | null;
  end_date: string | null;
  is_current: boolean;
  rolled_forward_from: number | null;
  locked_at: string | null;
  locked_by: number | null;
  created_at: string;
}

export interface PeriodInput {
  periodName: string;
  startDate?: string;
  endDate?: string;
  isCurrent?: boolean;
}

export const listPeriods = (clientId: number) =>
  apiFetch<Period[]>(`/clients/${clientId}/periods`);

export const createPeriod = (clientId: number, input: PeriodInput) =>
  apiFetch<Period>(`/clients/${clientId}/periods`, {
    method: 'POST',
    body: JSON.stringify(input),
  });

export const updatePeriod = (id: number, input: Partial<PeriodInput>) =>
  apiFetch<Period>(`/periods/${id}`, { method: 'PATCH', body: JSON.stringify(input) });

export const deletePeriod = (id: number) =>
  apiFetch<{ id: number }>(`/periods/${id}`, { method: 'DELETE' });

export const lockPeriod = (id: number) =>
  apiFetch<Period>(`/periods/${id}/lock`, { method: 'POST' });

export const unlockPeriod = (id: number) =>
  apiFetch<Period>(`/periods/${id}/unlock`, { method: 'POST' });
