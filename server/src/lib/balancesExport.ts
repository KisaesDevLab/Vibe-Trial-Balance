// Copyright 2025-2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Use is limited to qualifying small businesses. See LICENSE for terms.

/**
 * Recognition of the "Balances export" trial-balance layout — the CSV some
 * write-up packages produce with one row per account and the columns
 *
 *   account_number, account_name, p_n_l, beginning_balance, unadjusted_balance,
 *   adjusted_balance, federal_balance, state_balance, other_balance,
 *   budget_amount, wp_reference, quickbooks_account_description,
 *   qbo_account_id, xero_account_id, category
 *
 * The layout is fixed and machine-written, so it is recognised from its
 * header row deterministically and the AI column-shape call is skipped: the
 * model has nothing to add and a wrong guess (picking `unadjusted_balance`,
 * say) would import the wrong column. What is imported is `adjusted_balance`,
 * signed debit-positive; `p_n_l` (Y/N) says whether the row is an income
 * statement account, which fixes the category of any account the leading
 * digit would misfile; and the two QuickBooks columns are carried onto the
 * chart of accounts so the QuickBooks connector can place those accounts by
 * id or by name on its first import.
 *
 * Pure: no db, no express, so it is unit-tested directly.
 */

export const BALANCES_EXPORT_FORMAT = 'balances_export' as const;
export type DetectedImportFormat = typeof BALANCES_EXPORT_FORMAT;

/** Header cells that must all be present for the layout to be recognised. */
const REQUIRED_HEADERS = ['account_number', 'account_name', 'adjusted_balance', 'p_n_l'] as const;

export interface BalancesExportColumns {
  accountNumber: number;
  accountName: number;
  /** `adjusted_balance` — the amount imported. */
  amount: number;
  /** `p_n_l` Y/N. */
  pnl: number;
  /** `quickbooks_account_description`, when the column exists. */
  qboAccountName: number | null;
  /** `qbo_account_id`, when the column exists. */
  qboAccountId: number | null;
}

function headerKey(cell: string): string {
  return cell.trim().toLowerCase().replace(/^\uFEFF/, '');
}

/**
 * Column indexes for a Balances export, or null when the header row is
 * anything else. Column ORDER is not assumed — only the names — so a
 * regenerated export with the columns shuffled still reads correctly.
 */
export function detectBalancesExport(headerCells: string[]): BalancesExportColumns | null {
  const index = new Map<string, number>();
  headerCells.forEach((c, i) => {
    const key = headerKey(c);
    if (key && !index.has(key)) index.set(key, i);
  });
  for (const h of REQUIRED_HEADERS) {
    if (!index.has(h)) return null;
  }
  return {
    accountNumber: index.get('account_number')!,
    accountName: index.get('account_name')!,
    amount: index.get('adjusted_balance')!,
    pnl: index.get('p_n_l')!,
    qboAccountName: index.get('quickbooks_account_description') ?? null,
    qboAccountId: index.get('qbo_account_id') ?? null,
  };
}

export type PnlFlag = 'Y' | 'N';

/** `Y`/`N` (any case, `yes`/`no`, `true`/`false`, `1`/`0`); anything else is no opinion. */
export function parsePnlFlag(raw: string | null | undefined): PnlFlag | null {
  const v = (raw ?? '').trim().toLowerCase();
  if (v === 'y' || v === 'yes' || v === 'true' || v === '1') return 'Y';
  if (v === 'n' || v === 'no' || v === 'false' || v === '0') return 'N';
  return null;
}

/** A QBO account id as this file writes it — digits only; blank/junk is null. */
export function parseQboAccountId(raw: string | null | undefined): string | null {
  const v = (raw ?? '').trim();
  return /^\d{1,32}$/.test(v) ? v : null;
}

/** A QBO display name, trimmed to the column width; blank is null. */
export function parseQboAccountName(raw: string | null | undefined): string | null {
  const v = (raw ?? '').trim();
  return v ? v.slice(0, 255) : null;
}

/**
 * QBO ids that appear on MORE than one row of the file. The export can carry
 * the same id twice (two ledger accounts that were both mapped to one
 * QuickBooks account), and a link written for both would either trip the
 * unique index or bind the id to whichever row came last — so a duplicated id
 * is linked to neither and reported instead.
 */
export function duplicatedQboIds(ids: Array<string | null | undefined>): Set<string> {
  const seen = new Set<string>();
  const dupes = new Set<string>();
  for (const id of ids) {
    if (!id) continue;
    if (seen.has(id)) dupes.add(id);
    else seen.add(id);
  }
  return dupes;
}
