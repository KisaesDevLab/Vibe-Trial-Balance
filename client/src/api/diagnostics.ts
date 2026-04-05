// Copyright 2025-2026 Kisaes LLC
// Licensed under the Elastic License 2.0 (ELv2); you may not use this file
// except in compliance with the Elastic License 2.0.
// See LICENSE file in the project root for full license text.

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
