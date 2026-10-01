// Copyright 2025-2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Use is limited to qualifying small businesses. See LICENSE for terms.

// Integer money helpers for the financial-statement engine. Every amount is
// an integer count of CENTS — the unit this app stores (BIGINT cents, never
// float) — and is rounded to presentation units (whole dollars or cents)
// explicitly.

export const SCALE = 100;

// Source balances arrive as integer cents already; this only guards a
// missing value and a stray fraction.
export const toUnits = (x: number | null | undefined): number => Math.round(x ?? 0);

// Presentation unit size in cents: whole dollars = 100; cents = 1.
export const presUnit = (decimals: 0 | 2): number => (decimals === 0 ? SCALE : 1);

// Round half away from zero to a multiple of `unit`, returning a multiple
// of `unit` (still in cents).
export function roundTo(v: number, unit: number): number {
  const q = Math.abs(v) / unit;
  const r = Math.floor(q + 0.5 + 1e-9) * unit;
  return v < 0 ? -r : r;
}

// Display value (dollars) from cents.
export const toDisplay = (v: number): number => v / SCALE;

export function pct(num: number, den: number): number | null {
  if (!den) return null;
  return Math.round((num / den) * 1000) / 10;
}

export function sum(xs: number[]): number {
  let s = 0;
  for (const x of xs) s += x;
  return s;
}

export const BS_TYPES: ReadonlySet<string> = new Set(['asset', 'liability', 'equity']);
export const isBsType = (t: string): boolean => BS_TYPES.has(t);
const CREDIT_TYPES: ReadonlySet<string> = new Set(['liability', 'equity', 'revenue']);
export const isCreditNatural = (t: string): boolean => CREDIT_TYPES.has(t);

export function compareAccountNumbers(a: { number: string | null; name: string }, b: { number: string | null; name: string }): number {
  const an = a.number ?? '';
  const bn = b.number ?? '';
  if (an && bn && an !== bn) return an.localeCompare(bn, undefined, { numeric: true });
  if (an && !bn) return -1;
  if (!an && bn) return 1;
  return a.name.localeCompare(b.name);
}

export function scheduleLabel(n: number, numbering: 'numeric' | 'alpha'): string {
  if (numbering === 'alpha') {
    let s = '';
    let x = n;
    while (x > 0) {
      const r = (x - 1) % 26;
      s = String.fromCharCode(65 + r) + s;
      x = Math.floor((x - 1) / 26);
    }
    return `Schedule ${s}`;
  }
  return `Schedule ${n}`;
}
