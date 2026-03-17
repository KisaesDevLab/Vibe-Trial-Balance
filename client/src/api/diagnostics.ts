import { apiFetch } from './client';

export interface DiagnosticObservation {
  severity: 'error' | 'warning' | 'info';
  category: string;
  message: string;
}

export interface DiagnosticsResult {
  observations: DiagnosticObservation[];
  periodId: number;
}

export const runDiagnostics = (periodId: number) =>
  apiFetch<DiagnosticsResult>(`/periods/${periodId}/diagnostics`, { method: 'POST' });
