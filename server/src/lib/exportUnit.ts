// Copyright 2025-2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Use is limited to qualifying small businesses. See LICENSE for terms.

/**
 * Export unit number — a single unit applied to an entire tax export.
 *
 * Tax packages key an activity/entity off a unit number, and firms differ on
 * whether that unit rides in its own column or is baked into the account
 * number. Pure functions, no DB: `routes/exports.ts` is the only caller, and
 * the client mirrors the preview logic in `client/src/api/exports.ts`.
 */

/**
 *   column — Unit column only, account number untouched
 *   prefix — unit#-coa#
 *   suffix — coa#-unit#
 * The Unit column is added in all three modes; the mode only decides whether
 * the account number is rewritten as well.
 */
export type UnitMode = 'column' | 'prefix' | 'suffix';

export interface UnitOption {
  unit: string;
  mode: UnitMode;
}

/** Separator between the unit and the account number in prefix/suffix modes. */
export const UNIT_SEPARATOR = '-';

/**
 * Parse ?unit=3&unitMode=prefix. Digits only — a unit is a number in every
 * package we export to, and letting free text through would silently produce
 * account numbers the target software rejects on import.
 *
 * Returns null when no usable unit was supplied, which leaves the export
 * byte-for-byte identical to one taken without the option.
 */
export function parseUnitParam(query: Record<string, unknown>): UnitOption | null {
  const raw = typeof query.unit === 'string' ? query.unit.trim() : '';
  if (!/^\d{1,9}$/.test(raw)) return null;
  const m = query.unitMode;
  const mode: UnitMode = m === 'prefix' || m === 'suffix' ? m : 'column';
  return { unit: raw, mode };
}

/** Account number with the unit prepended or appended, per the chosen mode. */
export function unitAccountNumber(accountNumber: unknown, opt: UnitOption | null): string {
  const acct = accountNumber == null ? '' : String(accountNumber);
  if (!opt || opt.mode === 'column') return acct;
  // An account with no number has nothing to join to — the unit alone is the
  // best available identifier, and an orphan separator would be worse.
  if (!acct) return opt.unit;
  return opt.mode === 'prefix'
    ? `${opt.unit}${UNIT_SEPARATOR}${acct}`
    : `${acct}${UNIT_SEPARATOR}${opt.unit}`;
}

/** Prepend the Unit column to a column spec — leading, as tax packages expect. */
export function withUnitColumn<T extends { header: string; key: string; width: number }>(
  columns: T[],
  opt: UnitOption | null,
): Array<T | { header: string; key: string; width: number }> {
  if (!opt) return columns;
  return [{ header: 'Unit', key: 'unit', width: 8 }, ...columns];
}
