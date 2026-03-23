import { apiFetch } from './client';
import type { Account } from './chartOfAccounts';

export interface UnitSummary {
  unit: string | null;
  total: number;
  assets: number;
  liabilities: number;
  equity: number;
  revenue: number;
  expenses: number;
}

export interface ClonePreviewRow {
  sourceNumber: string;
  newNumber: string;
  accountName: string;
  category: string;
  duplicate: boolean;
}

export interface ClonePreview {
  preview: ClonePreviewRow[];
  duplicateCount: number;
  wouldInsert: number;
}

export const listUnits = (clientId: number) =>
  apiFetch<UnitSummary[]>(`/clients/${clientId}/units`);

export const listUnitAccounts = (clientId: number, unit: string | null) =>
  apiFetch<Account[]>(`/clients/${clientId}/units/${unit === null ? '__unassigned__' : encodeURIComponent(unit)}/accounts`);

export const renameUnit = (clientId: number, from: string, to: string) =>
  apiFetch<{ updated: number }>(`/clients/${clientId}/units/rename`, {
    method: 'POST',
    body: JSON.stringify({ from, to }),
  });

export const mergeUnit = (clientId: number, from: string, into: string) =>
  apiFetch<{ updated: number }>(`/clients/${clientId}/units/merge`, {
    method: 'POST',
    body: JSON.stringify({ from, into }),
  });

export const clearUnit = (clientId: number, unit: string) =>
  apiFetch<{ updated: number }>(`/clients/${clientId}/units/clear`, {
    method: 'POST',
    body: JSON.stringify({ unit }),
  });

export const bulkAssignUnit = (clientId: number, accountIds: number[], unit: string | null) =>
  apiFetch<{ updated: number }>(`/clients/${clientId}/units/bulk-assign`, {
    method: 'POST',
    body: JSON.stringify({ accountIds, unit }),
  });

export const cloneSelected = (
  clientId: number,
  accountIds: number[],
  newUnit: string,
  strategy: 'prefix' | 'suffix' | 'same',
  strategyValue: string,
  dryRun: boolean,
) =>
  apiFetch<ClonePreview | { inserted: number }>(`/clients/${clientId}/units/clone-selected`, {
    method: 'POST',
    body: JSON.stringify({ accountIds, newUnit, strategy, strategyValue, dryRun }),
  });

export const cloneUnit = (
  clientId: number,
  sourceUnit: string,
  newUnit: string,
  strategy: 'prefix' | 'suffix' | 'same',
  strategyValue: string,
  dryRun: boolean,
) =>
  apiFetch<ClonePreview | { inserted: number }>(`/clients/${clientId}/units/clone`, {
    method: 'POST',
    body: JSON.stringify({ sourceUnit, newUnit, strategy, strategyValue, dryRun }),
  });
