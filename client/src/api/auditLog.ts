// Copyright 2025-2026 Kisaes LLC
// Licensed under the Elastic License 2.0 (ELv2); you may not use this file
// except in compliance with the Elastic License 2.0.
// See LICENSE file in the project root for full license text.

import { apiFetch } from './client';

export interface AuditLogEntry {
  id: number;
  user_id: number | null;
  entity_type: string | null;
  entity_id: number | null;
  action: string;
  description: string | null;
  period_id: number | null;
  created_at: string;
  username: string | null;
}

export interface AuditLogMeta {
  total: number;
  page: number;
  limit: number;
}

export interface AuditLogParams {
  page?: number;
  limit?: number;
  entity_type?: string;
  action?: string;
  from?: string;
  to?: string;
}

export const getAuditLogAdmin = (params: AuditLogParams = {}) => {
  const qs = new URLSearchParams();
  if (params.page)        qs.set('page',        String(params.page));
  if (params.limit)       qs.set('limit',       String(params.limit));
  if (params.entity_type) qs.set('entity_type', params.entity_type);
  if (params.action)      qs.set('action',      params.action);
  if (params.from)        qs.set('from',        params.from);
  if (params.to)          qs.set('to',          params.to);
  const query = qs.toString() ? `?${qs.toString()}` : '';
  return apiFetch<AuditLogEntry[]>(`/audit-log${query}`);
};
