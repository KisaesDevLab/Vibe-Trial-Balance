import { apiFetch } from './client';

const BASE_URL = '/api/v1';

export type TaxSoftware = 'ultratax' | 'cch' | 'lacerte' | 'gosystem' | 'generic';

export interface ValidationResult {
  isBalanced: boolean;
  unmappedAccounts: { account_id: number; account_number: string; account_name: string }[];
  missingMappings: { account_id: number; account_number: string; account_name: string; tax_code: string }[];
  canExport: boolean;
  warnings: string[];
  software: string;
  totalDebit: number;
  totalCredit: number;
}

export const validateExport = (periodId: number, software: TaxSoftware = 'ultratax') =>
  apiFetch<ValidationResult>(`/periods/${periodId}/exports/validate?software=${software}`);

/** Returns a URL for a tax software CSV/XLSX export (use as <a href> or window.open) */
export function taxSoftwareExportUrl(periodId: number, software: TaxSoftware): string {
  return `${BASE_URL}/periods/${periodId}/exports/${software}`;
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
