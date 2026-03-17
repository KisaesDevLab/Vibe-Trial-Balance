import { apiFetch } from './client';

export type ReportColumn = 'book' | 'tax' | 'prior-year';

export interface ReportSection {
  id: string;
  name: string;
  accountIds: number[];
  showSubtotal: boolean;
}

export interface ReportConfig {
  sections: ReportSection[];
  columns: ReportColumn[];
}

export interface SavedReport {
  id: number;
  client_id: number;
  name: string;
  config: ReportConfig;
  created_at: string;
  updated_at: string;
}

export interface SavedReportInput {
  name: string;
  config: ReportConfig;
}

export const listSavedReports = (clientId: number) =>
  apiFetch<SavedReport[]>(`/clients/${clientId}/saved-reports`);

export const createSavedReport = (clientId: number, input: SavedReportInput) =>
  apiFetch<SavedReport>(`/clients/${clientId}/saved-reports`, {
    method: 'POST',
    body: JSON.stringify(input),
  });

export const updateSavedReport = (id: number, input: Partial<SavedReportInput>) =>
  apiFetch<SavedReport>(`/saved-reports/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });

export const deleteSavedReport = (id: number) =>
  apiFetch<{ id: number }>(`/saved-reports/${id}`, { method: 'DELETE' });
