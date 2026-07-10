// Copyright 2025-2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Use is limited to qualifying small businesses. See LICENSE for terms.

import { apiFetch } from './client';

export const M1_CATEGORIES = [
  'Meals & Entertainment',
  'Depreciation Difference',
  'Officer Life Insurance',
  'Political Contributions',
  'Penalties & Fines',
  'Tax-Exempt Income',
  'Deferred Revenue',
  'Accrued Expenses',
  'Other Permanent Difference',
  'Other Temporary Difference',
  'Other Income Difference',
] as const;

// Income-side categories: book > tax means book recognized income the return
// does not, so the M-1 adjustment SUBTRACTS from book income; all other
// categories are expense-like and ADD (book − tax). Must stay in sync with
// M1_INCOME_CATEGORIES in server/src/pdf/reportGenerators.ts.
export const M1_INCOME_CATEGORIES: ReadonlySet<string> = new Set([
  'Tax-Exempt Income',
  'Deferred Revenue',
  'Other Income Difference',
]);

export interface M1Adjustment {
  id: number;
  period_id: number;
  description: string;
  category: string | null;
  book_amount: number;   // cents
  tax_amount: number;    // cents
  sort_order: number;
  notes: string | null;
  created_at: string;
}

export interface M1Input {
  description: string;
  category?: string | null;
  bookAmount: number;    // cents
  taxAmount: number;     // cents
  sortOrder?: number;
  notes?: string | null;
}

export const listM1Adjustments = (periodId: number) =>
  apiFetch<M1Adjustment[]>(`/periods/${periodId}/m1-adjustments`);

export const createM1Adjustment = (periodId: number, input: M1Input) =>
  apiFetch<M1Adjustment>(`/periods/${periodId}/m1-adjustments`, {
    method: 'POST',
    body: JSON.stringify(input),
  });

export const updateM1Adjustment = (id: number, input: Partial<M1Input>) =>
  apiFetch<M1Adjustment>(`/m1-adjustments/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });

export const deleteM1Adjustment = (id: number) =>
  apiFetch<{ id: number }>(`/m1-adjustments/${id}`, { method: 'DELETE' });
