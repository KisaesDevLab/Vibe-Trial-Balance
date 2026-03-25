import { apiFetch } from './client';

export interface SoftwareMap {
  id: number;
  tax_code_id: number;
  tax_software: string;
  software_code?: string;
  software_description?: string;
}

export interface TaxCode {
  id: number;
  return_form: string;
  activity_type: string;
  tax_code: string;
  description: string;
  sort_order: number;
  is_system: boolean;
  is_active: boolean;
  is_m1_adjustment: boolean;
  notes?: string;
  maps?: SoftwareMap[];
  software_code?: string; // populated by /available endpoint
}

export interface TaxCodeInput {
  returnForm: string;
  activityType: string;
  taxCode: string;
  description: string;
  sortOrder?: number;
  notes?: string;
  isActive?: boolean;
  isM1Adjustment?: boolean;
}

export interface ImportPreviewRow {
  tax_code: string;
  return_form: string;
  activity_type: string;
  description: string;
  sort_order: number;
  status: 'new' | 'update' | 'duplicate' | 'error';
  error?: string;
}

export interface ListTaxCodesParams {
  returnForm?: string;
  activityType?: string;
  taxSoftware?: string;
  search?: string;
  includeInactive?: boolean;
}

export interface SoftwareMapInput {
  taxSoftware: string;
  softwareCode?: string;
  softwareDescription?: string;
}

function buildQuery(params: Record<string, string | boolean | number | undefined>): string {
  const entries = Object.entries(params).filter(([, v]) => v !== undefined && v !== '' && v !== false);
  if (entries.length === 0) return '';
  return '?' + entries.map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`).join('&');
}

export const listTaxCodes = (params?: ListTaxCodesParams) =>
  apiFetch<TaxCode[]>(`/tax-codes${buildQuery({
    returnForm: params?.returnForm,
    activityType: params?.activityType,
    taxSoftware: params?.taxSoftware,
    search: params?.search,
    includeInactive: params?.includeInactive,
  })}`);

export const getAvailableTaxCodes = (
  clientId: number,
  overrides?: { returnForm?: string; activityType?: string; taxSoftware?: string },
) =>
  apiFetch<TaxCode[]>(`/tax-codes/available${buildQuery({
    clientId,
    returnForm: overrides?.returnForm,
    activityType: overrides?.activityType,
    taxSoftware: overrides?.taxSoftware,
  })}`);

export const getTaxCode = (id: number) => apiFetch<TaxCode>(`/tax-codes/${id}`);

export const createTaxCode = (data: TaxCodeInput) =>
  apiFetch<TaxCode>('/tax-codes', { method: 'POST', body: JSON.stringify(data) });

export const updateTaxCode = (id: number, data: Partial<TaxCodeInput>) =>
  apiFetch<TaxCode>(`/tax-codes/${id}`, { method: 'PUT', body: JSON.stringify(data) });

export const deleteTaxCode = (id: number) =>
  apiFetch<void>(`/tax-codes/${id}`, { method: 'DELETE' });

export const importTaxCodePreview = (csvText: string) =>
  apiFetch<ImportPreviewRow[]>('/tax-codes/import/preview', {
    method: 'POST',
    body: JSON.stringify({ csv: csvText }),
  });

export const importTaxCodes = (csvText: string) =>
  apiFetch<{ imported: number }>('/tax-codes/import', {
    method: 'POST',
    body: JSON.stringify({ csv: csvText }),
  });

export const exportTaxCodesUrl = (params?: ListTaxCodesParams): string => {
  const stored = localStorage.getItem('auth');
  let token = '';
  try {
    const parsed = JSON.parse(stored ?? '{}') as { state?: { token?: string } };
    token = parsed.state?.token ?? '';
  } catch {
    // ignore
  }
  const query = buildQuery({
    returnForm: params?.returnForm,
    activityType: params?.activityType,
    taxSoftware: params?.taxSoftware,
    search: params?.search,
    includeInactive: params?.includeInactive,
    token,
  });
  return `/api/v1/tax-codes/export${query}`;
};

export const createSoftwareMap = (taxCodeId: number, data: SoftwareMapInput) =>
  apiFetch<SoftwareMap>(`/tax-codes/${taxCodeId}/mappings`, {
    method: 'POST',
    body: JSON.stringify(data),
  });

export const updateSoftwareMap = (mapId: number, data: Partial<SoftwareMapInput>) =>
  apiFetch<SoftwareMap>(`/tax-codes/mappings/${mapId}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });

export const deleteSoftwareMap = (mapId: number) =>
  apiFetch<void>(`/tax-codes/mappings/${mapId}`, { method: 'DELETE' });
