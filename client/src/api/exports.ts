import { apiFetch } from './client';

const BASE_URL = '/api/v1';

export type TaxSoftware = 'ultratax' | 'cch' | 'lacerte' | 'gosystem' | 'generic';

export interface TaxCodeInUseAccount {
  account_number: string;
  account_name: string;
  bookAmt: number;
  taxAmt: number;
}

export interface TaxCodeInUse {
  tax_code_id: number;
  tax_code: string;
  description: string;
  software_code: string | null;
  software_description: string | null;
  export_account_number: string | null;
  export_description: string | null;
  account_count: number;
  totalBookAmt: number;
  totalTaxAmt: number;
  accounts: TaxCodeInUseAccount[];
}

export interface ValidationResult {
  isBalanced: boolean;
  unmappedAccounts: { account_id: number; account_number: string; account_name: string }[];
  missingMappings: { account_id: number; account_number: string; account_name: string; tax_code: string }[];
  canExport: boolean;
  warnings: string[];
  software: string;
  totalDebit: number;
  totalCredit: number;
  taxCodesInUse: TaxCodeInUse[];
}

export const validateExport = (periodId: number, software: TaxSoftware = 'ultratax') =>
  apiFetch<ValidationResult>(`/periods/${periodId}/exports/validate?software=${software}`);

export type ConsolSettings = Record<number, { acctNum: string; acctName: string }>;

export const getConsolSettings = (periodId: number, software: TaxSoftware) =>
  apiFetch<ConsolSettings>(`/periods/${periodId}/exports/consolidation-settings?software=${software}`);

export const saveConsolSettings = (periodId: number, software: TaxSoftware, settings: ConsolSettings) =>
  apiFetch<{ saved: number }>(`/periods/${periodId}/exports/consolidation-settings`, {
    method: 'PUT',
    body: JSON.stringify({ software, settings }),
  });

/** Returns a URL for a tax software CSV/XLSX export (use as <a href> or window.open) */
export function taxSoftwareExportUrl(
  periodId: number,
  software: TaxSoftware,
  consolidateIds?: number[],
  overrides?: Map<number, { acctNum: string; acctName: string }>,
): string {
  let url = `${BASE_URL}/periods/${periodId}/exports/${software}`;
  if (consolidateIds && consolidateIds.length > 0) {
    const params = new URLSearchParams();
    params.set('consolidate', consolidateIds.join(','));
    if (overrides && overrides.size > 0) {
      const obj: Record<string, { n: string; d: string }> = {};
      for (const [id, v] of overrides) {
        if (consolidateIds.includes(id)) obj[String(id)] = { n: v.acctNum, d: v.acctName };
      }
      params.set('overrides', JSON.stringify(obj));
    }
    url += `?${params.toString()}`;
  }
  return url;
}

export function workingTbExportUrl(periodId: number): string {
  return `${BASE_URL}/periods/${periodId}/exports/working-tb`;
}

export function bookkeeperLetterUrl(periodId: number, preview = false): string {
  return `${BASE_URL}/periods/${periodId}/exports/bookkeeper-letter${preview ? '?preview=true' : ''}`;
}

/**
 * Triggers a file download by creating a temporary <a> element.
 * Uses the current auth token via an authenticated fetch, then creates a blob URL.
 */
export async function downloadExport(url: string, filename: string): Promise<void> {
  const stored = localStorage.getItem('auth');
  let token: string | null = null;
  if (stored) {
    try {
      const parsed = JSON.parse(stored) as { state?: { token?: string } };
      token = parsed.state?.token ?? null;
    } catch {
      // ignore
    }
  }

  const response = await fetch(url, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });

  if (!response.ok) {
    throw new Error(`Export failed: ${response.status} ${response.statusText}`);
  }

  const blob = await response.blob();
  const objectUrl = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = objectUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(objectUrl);
}
