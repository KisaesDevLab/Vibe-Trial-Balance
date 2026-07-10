// Copyright 2025-2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Use is limited to qualifying small businesses. See LICENSE for terms.

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
