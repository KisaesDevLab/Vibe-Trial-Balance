// Copyright 2025-2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Use is limited to qualifying small businesses. See LICENSE for terms.

/**
 * The date range to pull from QuickBooks for a PY tie-out. Pure; no DB.
 *
 * When the client has a period in this app that ends the day before the
 * current one starts, that period's own dates are the truth (a short year,
 * a stub period). Otherwise both dates slide back one year, with a leap day
 * landing on the 28th so a 2024 → 2023 shift is still a real date.
 */

export type PriorRangeSource = 'period' | 'derived';

export interface PriorRange {
  startDate: string;
  endDate: string;
  source: PriorRangeSource;
  /** The prior period's id / name when `source === 'period'`. */
  priorPeriodId: number | null;
  priorPeriodName: string | null;
}

export interface CandidatePeriod {
  id: number;
  period_name: string;
  start_date: string;
  end_date: string;
}

export function shiftBackOneYear(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) throw new Error(`Not an ISO date: ${iso}`);
  const year = Number(m[1]) - 1;
  const month = Number(m[2]);
  let day = Number(m[3]);
  // Days in the target month (leap-aware): a 29 Feb only exists every fourth year.
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  if (day > daysInMonth) day = daysInMonth;
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function dayBefore(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

/**
 * `candidates` are the client's OTHER periods (any order). The one whose
 * end_date is exactly the day before `startDate` wins; two such periods
 * would be a data problem, so the lowest id is taken deterministically.
 */
export function priorYearRange(startDate: string, endDate: string, candidates: CandidatePeriod[]): PriorRange {
  const wanted = dayBefore(startDate);
  const hit = candidates
    .filter((p) => p.start_date && p.end_date && p.end_date.slice(0, 10) === wanted)
    .sort((a, b) => a.id - b.id)[0];
  if (hit) {
    return {
      startDate: hit.start_date.slice(0, 10),
      endDate: hit.end_date.slice(0, 10),
      source: 'period',
      priorPeriodId: hit.id,
      priorPeriodName: hit.period_name,
    };
  }
  return {
    startDate: shiftBackOneYear(startDate),
    endDate: shiftBackOneYear(endDate),
    source: 'derived',
    priorPeriodId: null,
    priorPeriodName: null,
  };
}
