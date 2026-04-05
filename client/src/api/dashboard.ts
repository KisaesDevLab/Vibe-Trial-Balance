// Copyright 2025-2026 Kisaes LLC
// Licensed under the Elastic License 2.0 (ELv2); you may not use this file
// except in compliance with the Elastic License 2.0.
// See LICENSE file in the project root for full license text.

import { apiFetch } from './client';
import { type Period } from './periods';

export interface DashboardStats {
  je: { book: number; tax: number; trans: number };
  bank_transactions: { unclassified: number; classified: number; confirmed: number; manual: number };
  trial_balance: { total_debit: number; total_credit: number; is_balanced: boolean };
}

export interface AuditEntry {
  id: number;
  entity_type: string;
  entity_id: number | null;
  action: string;
  description: string | null;
  created_at: string;
  user_name: string | null;
}

export interface DashboardData {
  period: Period & { locked_by_name: string | null; client_name: string | null };
  stats: DashboardStats;
  audit_log: AuditEntry[];
}

export const getDashboard = (periodId: number) =>
  apiFetch<DashboardData>(`/periods/${periodId}/dashboard`);

export const getAuditLog = (periodId: number, limit = 50, offset = 0) =>
  apiFetch<AuditEntry[]>(`/periods/${periodId}/dashboard/audit-log?limit=${limit}&offset=${offset}`);
