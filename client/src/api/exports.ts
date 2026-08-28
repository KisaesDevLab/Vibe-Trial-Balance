// Copyright 2025-2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Use is limited to qualifying small businesses. See LICENSE for terms.

import { apiFetch } from './client';
import { API_BASE_URL } from '../lib/baseConfig';

const BASE_URL = API_BASE_URL;

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

/**
 * How a single export-wide unit number is applied.
 *   column — Unit column only, account number untouched
 *   prefix — unit#-coa#
 *   suffix — coa#-unit#
 * The Unit column is added in every mode; the mode only decides whether the
 * account number is rewritten too.
 */
export type UnitMode = 'column' | 'prefix' | 'suffix';

export interface UnitOption {
  /** Digits only — the server rejects anything else and omits the column. */
  unit: string;
  mode: UnitMode;
}

/** The exports whose layout carries an account number to combine a unit with.
 *  Lacerte and GoSystem export a tax LineCode instead, which must not be
 *  rewritten — they get the Unit column but ignore prefix/suffix. */
export const SOFTWARE_HAS_ACCOUNT_NUMBER: Record<TaxSoftware, boolean> = {
  ultratax: true,
  cch: true,
  generic: true,
  lacerte: false,
  gosystem: false,
};

/** Preview of the account number a unit option will produce, for the UI. */
export function previewUnitAccountNumber(sampleAcct: string, opt: UnitOption | null): string {
  if (!opt || opt.mode === 'column') return sampleAcct;
  if (!sampleAcct) return opt.unit;
  return opt.mode === 'prefix' ? `${opt.unit}-${sampleAcct}` : `${sampleAcct}-${opt.unit}`;
}

/** Returns a URL for a tax software CSV/XLSX export (use as <a href> or window.open) */
export function taxSoftwareExportUrl(
  periodId: number,
  software: TaxSoftware,
  consolidateIds?: number[],
  overrides?: Map<number, { acctNum: string; acctName: string }>,
  unitOption?: UnitOption | null,
): string {
  const params = new URLSearchParams();
  if (consolidateIds && consolidateIds.length > 0) {
    params.set('consolidate', consolidateIds.join(','));
    if (overrides && overrides.size > 0) {
      const obj: Record<string, { n: string; d: string }> = {};
      for (const [id, v] of overrides) {
        if (consolidateIds.includes(id)) obj[String(id)] = { n: v.acctNum, d: v.acctName };
      }
      params.set('overrides', JSON.stringify(obj));
    }
  }
  if (unitOption && /^\d{1,9}$/.test(unitOption.unit)) {
    params.set('unit', unitOption.unit);
    params.set('unitMode', unitOption.mode);
  }
  const qs = params.toString();
  return `${BASE_URL}/periods/${periodId}/exports/${software}${qs ? `?${qs}` : ''}`;
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
