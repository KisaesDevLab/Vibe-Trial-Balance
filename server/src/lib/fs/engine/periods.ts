// Copyright 2025-2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Use is limited to qualifying small businesses. See LICENSE for terms.

// Column planning for financial statements. A statement set belongs to ONE
// trial balance period, so there are two layouts: the period alone, or the
// period beside its prior year (the stored prior-year balances). MyBooks'
// month / quarter / year-to-date / custom-range machinery has no equivalent
// here — this app holds balances per period, not a dated ledger.

import type { FsColumnMode, FsReportSettings } from './schemas';

// ─── Date helpers (UTC, YYYY-MM-DD) ───────────────────────────────

const parts = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number) as [number, number, number];
  return { y, m, d };
};
const fmt = (y: number, m: number, d: number) => `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
const lastDay = (y: number, m: number) => new Date(Date.UTC(y, m, 0)).getUTCDate();

export function fsAddDays(iso: string, days: number): string {
  const dt = new Date(iso + 'T00:00:00Z');
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

// Same calendar day `years` later/earlier; month-ends stay month-ends
// (Feb 28 ↔ Feb 29).
export function fsShiftYears(iso: string, years: number): string {
  const { y, m, d } = parts(iso);
  const ny = y + years;
  const wasLast = d === lastDay(y, m);
  return fmt(ny, m, wasLast ? lastDay(ny, m) : Math.min(d, lastDay(ny, m)));
}

// Whole calendar months covered, when the range is month-aligned.
export function fsWholeMonths(start: string, end: string): number | null {
  const b = parts(end);
  if (parts(start).d !== 1 || b.d !== lastDay(b.y, b.m)) return null;
  const a = parts(start);
  return (b.y - a.y) * 12 + (b.m - a.m) + 1;
}

// ─── Column plan ──────────────────────────────────────────────────

// The dates a plan is built from. The loader supplies them: `priorEnd` is
// always the day before `periodStart` (the prior-year balances ARE this
// period's opening balances), `priorStart` is the adjacent period's own
// start when one exists, otherwise a year before `periodStart`.
export interface FsPlanDates {
  periodStart: string;
  periodEnd: string;
  priorStart: string;
  priorEnd: string;
}

export interface FsPlanRange { key: string; start: string; end: string; label: string; sublabel?: string }
export interface FsPlanPoint { key: string; date: string; label: string }

export interface FsPlan {
  period: { start: string; end: string };
  mode: FsColumnMode;
  isRanges: FsPlanRange[];     // income statement amount columns, in order
  bsPoints: FsPlanPoint[];     // balance sheet columns, in order
  cfRanges: FsPlanRange[];     // cash-flow columns, in order
  equityBlocks: FsPlanRange[]; // equity roll-forwards, chronological
  variance: boolean;           // $ / % change allowed (two comparable columns)
}

const NUMBER_WORDS = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve',
  'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen', 'Twenty', 'Twenty-One', 'Twenty-Two', 'Twenty-Three', 'Twenty-Four'];
const MONTH_ABBR = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

const longDate = (iso: string) => { const p = parts(iso); return `${MONTHS[p.m - 1]} ${p.d}, ${p.y}`; };
const shortDate = (iso: string) => { const p = parts(iso); return `${MONTH_ABBR[p.m - 1]} ${p.d}, ${p.y}`; };

// "Year" / "Three Months" / "Period" — the span word for a range. Twelve
// whole months is a year whichever month it starts in: a period here is
// the client's own fiscal year.
export function fsSpanWords(start: string, end: string): string {
  const n = fsWholeMonths(start, end);
  if (n === 12) return 'Year';
  if (n && n <= 24) return `${NUMBER_WORDS[n]} Month${n === 1 ? '' : 's'}`;
  return 'Period';
}

// "For the Three Months Ended September 30, 2026" or
// "For the Period from July 15, 2026 to September 30, 2026".
export function fsRangePhrase(start: string, end: string): string {
  const w = fsSpanWords(start, end);
  if (w === 'Period') return `For the Period from ${longDate(start)} to ${longDate(end)}`;
  return `For the ${w} Ended ${longDate(end)}`;
}

export function fsPlanColumns(settings: FsReportSettings, dates: FsPlanDates): FsPlan {
  const period = { start: dates.periodStart, end: dates.periodEnd };
  const mode = settings.columns.mode;
  const yr = (iso: string) => String(parts(iso).y);
  const P: FsPlanRange = { key: 'P', start: period.start, end: period.end, label: '' };

  if (mode !== 'cy_py') {
    return {
      period, mode, isRanges: [P], cfRanges: [P], equityBlocks: [P], variance: false,
      bsPoints: [{ key: 'end', date: period.end, label: '' }],
    };
  }

  // A year label only when the two ends are a year apart on the same day;
  // otherwise (a short or stub period) the dates themselves.
  const a = parts(period.end);
  const b = parts(dates.priorEnd);
  const sameMonthDay = a.m === b.m && a.d === b.d && a.y !== b.y;
  const label = (iso: string) => (sameMonthDay ? yr(iso) : shortDate(iso));
  const cur: FsPlanRange = { ...P, label: label(period.end) };
  const prev: FsPlanRange = { key: 'P_py', start: dates.priorStart, end: dates.priorEnd, label: label(dates.priorEnd) };
  return {
    period, mode,
    isRanges: [cur, prev],
    cfRanges: [cur, prev],
    // Oldest first, so contiguous years chain (PY ending = CY beginning).
    equityBlocks: [prev, cur],
    variance: true,
    bsPoints: [
      { key: 'end', date: period.end, label: label(period.end) },
      { key: 'cmp', date: dates.priorEnd, label: label(dates.priorEnd) },
    ],
  };
}

// ─── Date lines ───────────────────────────────────────────────────

export function fsPlanBalanceSheetDateLine(plan: FsPlan): string {
  if (plan.bsPoints.length < 2) return longDate(plan.period.end);
  const [a, b] = plan.bsPoints as [FsPlanPoint, FsPlanPoint];
  const pa = parts(a.date);
  const pb = parts(b.date);
  if (pa.m === pb.m && pa.d === pb.d) return `${longDate(a.date)} and ${pb.y}`;
  return `${longDate(a.date)} and ${longDate(b.date)}`;
}

// Heading for flow statements (income statement, equity, cash flows).
// `ranges` are the ranges the statement actually shows — an equity or cash
// flow statement may show the current year alone beside a two-year income
// statement when the prior year has no opening balances.
export function fsPlanFlowDateLine(plan: FsPlan, ranges: FsPlanRange[]): string {
  const end = plan.period.end;
  const cur = ranges.find((r) => r.end === end) ?? { start: plan.period.start, end };
  const prior = ranges.find((r) => r.end !== end);
  const span = fsSpanWords(cur.start, cur.end);
  if (span === 'Period') {
    return fsRangePhrase(cur.start, cur.end) + (prior ? ` and from ${longDate(prior.start)} to ${longDate(prior.end)}` : '');
  }
  if (!prior) return `For the ${span} Ended ${longDate(end)}`;
  const pe = parts(prior.end);
  const ce = parts(end);
  const plural = span === 'Year' ? 'Years' : span;
  const tail = pe.m === ce.m && pe.d === ce.d ? String(pe.y) : longDate(prior.end);
  return `For the ${plural} Ended ${longDate(end)} and ${tail}`;
}
