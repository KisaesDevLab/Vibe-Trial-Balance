// Copyright 2025-2026 Kisaes LLC
// Licensed under the PolyForm Internal Use License 1.0.0.
// You may not distribute this software. See LICENSE for terms.

import { apiFetch } from './client';
import { API_BASE_URL } from '../lib/baseConfig';

export interface CоaTemplate {
  id: number;
  name: string;
  description?: string;
  business_type: string;
  is_system: boolean;
  is_active: boolean;
  account_count: number;
  created_by?: number;
  created_from_client_id?: number;
  created_at: string;
  updated_at: string;
}

export interface CoaTemplateAccount {
  id: number;
  template_id: number;
  account_number: string;
  account_name: string;
  category: string;
  subcategory?: string;
  normal_balance: string;
  tax_line?: string | null;
  unit?: string | null;
  workpaper_ref?: string;
  sort_order: number;
  is_active: boolean;
}

export interface CoaTemplateWithAccounts extends CоaTemplate {
  accounts: CoaTemplateAccount[];
}

export interface CoaTemplateInput {
  name: string;
  description?: string;
  businessType?: string;
  isActive?: boolean;
}

export interface CoaTemplateAccountInput {
  accountNumber: string;
  accountName: string;
  category: string;
  subcategory?: string;
  normalBalance: string;
  taxLine?: string | null;
  unit?: string | null;
  workpaperRef?: string;
  sortOrder?: number;
  isActive?: boolean;
}

export interface ApplyTemplateResult {
  added: number;
  skipped: number;
  total: number;
}

export interface ImportPreviewRow {
  account_number: string;
  account_name: string;
  category: string;
  subcategory: string;
  normal_balance: string;
  tax_line: string;
  unit: string;
  workpaper_ref: string;
  sort_order: number;
  status: 'new' | 'error';
  error?: string;
}

// List all templates
export const listCoaTemplates = () =>
  apiFetch<CоaTemplate[]>('/coa-templates');

// Get single template with accounts
export const getCoaTemplate = (id: number) =>
  apiFetch<CoaTemplateWithAccounts>(`/coa-templates/${id}`);

// Create custom template
export const createCoaTemplate = (data: CoaTemplateInput) =>
  apiFetch<CоaTemplate>('/coa-templates', {
    method: 'POST',
    body: JSON.stringify(data),
  });

// Update template
export const updateCoaTemplate = (id: number, data: Partial<CoaTemplateInput>) =>
  apiFetch<CоaTemplate>(`/coa-templates/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });

// Delete template
export const deleteCoaTemplate = (id: number) =>
  apiFetch<{ id: number }>(`/coa-templates/${id}`, { method: 'DELETE' });

// Add account to template
export const addTemplateAccount = (templateId: number, data: CoaTemplateAccountInput) =>
  apiFetch<CoaTemplateAccount>(`/coa-templates/${templateId}/accounts`, {
    method: 'POST',
    body: JSON.stringify(data),
  });

// Update template account
export const updateTemplateAccount = (accountId: number, data: Partial<CoaTemplateAccountInput>) =>
  apiFetch<CoaTemplateAccount>(`/coa-templates/accounts/${accountId}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });

// Delete template account
export const deleteTemplateAccount = (accountId: number) =>
  apiFetch<{ id: number }>(`/coa-templates/accounts/${accountId}`, { method: 'DELETE' });

// Create template from client COA
export const createTemplateFromClient = (
  clientId: number,
  data: { name: string; description?: string; businessType?: string },
) =>
  apiFetch<CоaTemplate>(`/coa-templates/from-client/${clientId}`, {
    method: 'POST',
    body: JSON.stringify(data),
  });

// Apply template to client COA
export const applyTemplate = (
  templateId: number,
  clientId: number,
  mode: 'merge' | 'replace',
) =>
  apiFetch<ApplyTemplateResult>(`/coa-templates/${templateId}/apply/${clientId}`, {
    method: 'POST',
    body: JSON.stringify({ mode }),
  });

// Returns the export URL. The endpoint requires Bearer auth, so callers must
// pair this with `downloadExport()` (which fetches as a blob with the JWT
// header) rather than dropping the URL into a bare <a href>.
export const exportTemplateUrl = (templateId: number): string =>
  `${API_BASE_URL}/coa-templates/${templateId}/export`;

// Import preview
export const importTemplatePreview = (csv: string) =>
  apiFetch<ImportPreviewRow[]>('/coa-templates/import/preview', {
    method: 'POST',
    body: JSON.stringify({ csv }),
  });

// Confirm import
export const importTemplate = (
  csv: string,
  opts: { templateId?: number; templateName?: string; description?: string; businessType?: string },
) =>
  apiFetch<{ imported: number; templateId: number }>('/coa-templates/import', {
    method: 'POST',
    body: JSON.stringify({ csv, ...opts }),
  });
