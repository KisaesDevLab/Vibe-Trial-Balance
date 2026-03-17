import { apiFetch } from './client';

export type TickmarkColor = 'gray' | 'blue' | 'green' | 'red' | 'purple' | 'amber';

export const TICKMARK_COLOR_CLASSES: Record<TickmarkColor, string> = {
  gray:   'bg-gray-200 text-gray-700',
  blue:   'bg-blue-100 text-blue-700',
  green:  'bg-green-100 text-green-700',
  red:    'bg-red-100 text-red-700',
  purple: 'bg-purple-100 text-purple-700',
  amber:  'bg-amber-100 text-amber-700',
};

export interface Tickmark {
  id: number;
  client_id: number;
  symbol: string;
  description: string;
  color: TickmarkColor;
  sort_order: number;
  created_at: string;
}

export interface TickmarkInput {
  symbol: string;
  description: string;
  color?: TickmarkColor;
  sortOrder?: number;
}

// accountId → assigned tickmarks (subset of library)
export type TBTickmarkMap = Record<number, Pick<Tickmark, 'id' | 'symbol' | 'description' | 'color'>[]>;

export const listTickmarks = (clientId: number) =>
  apiFetch<Tickmark[]>(`/clients/${clientId}/tickmarks`);

export const createTickmark = (clientId: number, input: TickmarkInput) =>
  apiFetch<Tickmark>(`/clients/${clientId}/tickmarks`, {
    method: 'POST',
    body: JSON.stringify(input),
  });

export const updateTickmark = (id: number, input: Partial<TickmarkInput>) =>
  apiFetch<Tickmark>(`/tickmarks/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });

export const deleteTickmark = (id: number) =>
  apiFetch<{ id: number }>(`/tickmarks/${id}`, { method: 'DELETE' });

export const getTBTickmarks = (periodId: number) =>
  apiFetch<TBTickmarkMap>(`/periods/${periodId}/tb-tickmarks`);

export const toggleTBTickmark = (periodId: number, accountId: number, tickmarkId: number) =>
  apiFetch<{ action: 'assigned' | 'removed' }>(`/periods/${periodId}/tb-tickmarks/toggle`, {
    method: 'POST',
    body: JSON.stringify({ accountId, tickmarkId }),
  });
