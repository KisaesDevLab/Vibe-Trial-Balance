import { apiFetch } from './client';

export interface Client {
  id: number;
  name: string;
  entity_type: '1065' | '1120' | '1120S' | '1040_C';
  tax_year_end: string;
  default_tax_software: 'ultratax' | 'cch' | 'lacerte' | 'drake';
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ClientInput {
  name: string;
  entityType: '1065' | '1120' | '1120S' | '1040_C';
  taxYearEnd?: string;
  defaultTaxSoftware?: 'ultratax' | 'cch' | 'lacerte' | 'drake';
}

export const listClients = () => apiFetch<Client[]>('/clients');

export const createClient = (input: ClientInput) =>
  apiFetch<Client>('/clients', { method: 'POST', body: JSON.stringify(input) });

export const updateClient = (id: number, input: Partial<ClientInput>) =>
  apiFetch<Client>(`/clients/${id}`, { method: 'PATCH', body: JSON.stringify(input) });

export const deleteClient = (id: number) =>
  apiFetch<{ id: number }>(`/clients/${id}`, { method: 'DELETE' });
