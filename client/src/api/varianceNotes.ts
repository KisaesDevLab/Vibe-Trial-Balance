// Copyright 2025-2026 Kisaes LLC
// Licensed under the Elastic License 2.0 (ELv2); you may not use this file
// except in compliance with the Elastic License 2.0.
// See LICENSE file in the project root for full license text.

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
