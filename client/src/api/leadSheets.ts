// Copyright 2025-2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Use is limited to qualifying small businesses. See LICENSE for terms.

import { apiFetch } from './client';
import type { TBRow } from './trialBalance';

export type SignoffRole = 'preparer' | 'reviewer';
export type SignoffStatus = 'unsigned' | 'signed' | 'stale';

export interface LeadSheet {
  id: number;
  client_id: number;
  code: string | null;
  name: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
  account_count?: number;
  /** Present only when the list was requested with a periodId. */
  current_stamp?: string;
  signoffs?: Partial<Record<SignoffRole, LeadSheetSignoff>>;
  status?: Record<SignoffRole, SignoffStatus>;
}

export interface LeadSheetSignoff {
  id: number;
  lead_sheet_id: number;
  role: SignoffRole;
  user_id: number | null;
  /** Snapshot taken at signing, so a deleted user still prints on the PDF. */
  user_name: string | null;
  signed_at: string;
  balance_stamp: string;
}

export interface UnassignedAccount {
  id: number;
  account_number: string;
  account_name: string;
  category: string;
  subcategory: string | null;
}

export interface LeadSheetTickmark {
  id: number;
  symbol: string;
  description: string;
  color: string;
}

export type LeadSheetMemberRow = TBRow & { tickmarks: LeadSheetTickmark[] };

export interface LeadSheetPeriodDetail {
  leadSheet: LeadSheet;
  rows: LeadSheetMemberRow[];
  accountCount: number;
  currentStamp: string;
  signoffs: Partial<Record<SignoffRole, LeadSheetSignoff>>;
  status: Record<SignoffRole, SignoffStatus>;
}

export interface LeadSheetSuggestion {
  accountId: number;
  accountNumber: string;
  accountName: string;
  category: string;
  subcategory: string | null;
  currentLeadSheetId: number | null;
  currentCode: string | null;
  suggestedLeadSheetId: number | null;
  suggestedCode: string | null;
  suggestedName: string | null;
  confidence: number;
  source: 'rule' | 'unmatched';
  /** True when applying this suggestion would change the current assignment. */
  changed: boolean;
}

export type AutoAssignMode = 'unassigned_only' | 'all';

/** Badge tone per sign-off state. Dark-mode variants are not optional here. */
export const SIGNOFF_BADGE_CLASSES: Record<SignoffStatus, string> = {
  unsigned: 'bg-gray-200 text-gray-500 dark:bg-gray-700 dark:text-gray-400',
  stale: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400',
  signed: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400',
};

export const SIGNOFF_LABELS: Record<SignoffStatus, string> = {
  unsigned: 'Not signed',
  stale: 'Signed, then balances changed',
  signed: 'Signed',
};

// ─── client-scoped ───────────────────────────────────────────────────────────

export const listLeadSheets = (clientId: number, periodId?: number) =>
  apiFetch<LeadSheet[]>(
    `/clients/${clientId}/lead-sheets${periodId ? `?periodId=${periodId}` : ''}`,
  );

export const listUnassignedAccounts = (clientId: number) =>
  apiFetch<UnassignedAccount[]>(`/clients/${clientId}/lead-sheets/unassigned`);

export const seedLeadSheets = (clientId: number) =>
  apiFetch<{ seeded: boolean; created: number }>(`/clients/${clientId}/lead-sheets/seed`, {
    method: 'POST',
  });

export const createLeadSheet = (clientId: number, input: { code?: string | null; name: string; sortOrder?: number }) =>
  apiFetch<LeadSheet>(`/clients/${clientId}/lead-sheets`, {
    method: 'POST',
    body: JSON.stringify(input),
  });

export const reorderLeadSheets = (clientId: number, order: Array<{ id: number; sortOrder: number }>) =>
  apiFetch<{ updated: number }>(`/clients/${clientId}/lead-sheets/reorder`, {
    method: 'POST',
    body: JSON.stringify({ order }),
  });

/** Bulk set/clear. Also serves the single-row "Assign…" dropdown. */
export const assignAccounts = (clientId: number, accountIds: number[], leadSheetId: number | null) =>
  apiFetch<{ updated: number }>(`/clients/${clientId}/lead-sheets/assign`, {
    method: 'POST',
    body: JSON.stringify({ accountIds, leadSheetId }),
  });

export const previewAutoAssign = (clientId: number, mode: AutoAssignMode = 'unassigned_only') =>
  apiFetch<LeadSheetSuggestion[]>(`/clients/${clientId}/lead-sheets/auto-assign/preview`, {
    method: 'POST',
    body: JSON.stringify({ mode }),
  });

export const confirmAutoAssign = (
  clientId: number,
  assignments: Array<{ accountId: number; leadSheetId: number | null }>,
) =>
  apiFetch<{ applied: number }>(`/clients/${clientId}/lead-sheets/auto-assign/confirm`, {
    method: 'POST',
    body: JSON.stringify({ assignments }),
  });

// ─── item ────────────────────────────────────────────────────────────────────

export const updateLeadSheet = (
  id: number,
  patch: { code?: string | null; name?: string; sortOrder?: number },
) => apiFetch<LeadSheet>(`/lead-sheets/${id}`, { method: 'PATCH', body: JSON.stringify(patch) });

export const deleteLeadSheet = (id: number) =>
  apiFetch<{ id: number; orphanedAccounts: number }>(`/lead-sheets/${id}`, { method: 'DELETE' });

// ─── period-scoped ───────────────────────────────────────────────────────────

export const getPeriodLeadSheets = (periodId: number) =>
  apiFetch<LeadSheetPeriodDetail[]>(`/periods/${periodId}/lead-sheets`);

export const getPeriodLeadSheet = (periodId: number, leadSheetId: number) =>
  apiFetch<LeadSheetPeriodDetail>(`/periods/${periodId}/lead-sheets/${leadSheetId}`);

export const signLeadSheet = (periodId: number, leadSheetId: number, role: SignoffRole) =>
  apiFetch<{ signoff: LeadSheetSignoff; status: SignoffStatus; currentStamp: string }>(
    `/periods/${periodId}/lead-sheets/${leadSheetId}/signoff`,
    { method: 'POST', body: JSON.stringify({ role }) },
  );

export const unsignLeadSheet = (periodId: number, leadSheetId: number, role: SignoffRole) =>
  apiFetch<{ removed: number; status: SignoffStatus }>(
    `/periods/${periodId}/lead-sheets/${leadSheetId}/unsign`,
    { method: 'POST', body: JSON.stringify({ role }) },
  );
