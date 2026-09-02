// Copyright 2025-2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Use is limited to qualifying small businesses. See LICENSE for terms.

/**
 * Parser for the QuickBooks Online `TrialBalance` report JSON. Pure.
 *
 * Shape (abridged):
 *   { Header: { ReportBasis, StartPeriod, EndPeriod, Option: [{Name:'NoReportData', Value:'false'}] },
 *     Columns: { Column: [{ColTitle:'', ColType:'Account'}, {ColTitle:'Debit', ColType:'Money'}, {ColTitle:'Credit', ColType:'Money'}] },
 *     Rows: { Row: [ { type:'Data', ColData:[{value:'Checking', id:'35'}, {value:'1201.00'}, {value:''}] },
 *                    { type:'Section', Header:{ColData:[...]}, Rows:{Row:[...]}, Summary:{ColData:[...]} },
 *                    { type:'Section', group:'GrandTotal', Summary:{ColData:[{value:'TOTAL'}, {value:'..'}, {value:'..'}]} } ] } }
 *
 * Only `Data` rows are accounts. A `Section` Header (a parent account with
 * sub-accounts) and any Summary never become accounts — the parent's own
 * balance, when it has one, is emitted by QBO as a Data row inside the section.
 *
 * Money is parsed with string arithmetic: no float ever touches a balance.
 */

export interface QboReportRow {
  /** QBO Account.Id from `ColData[0].id`; null when the report omits it. */
  qboAccountId: string | null;
  /** The account cell as printed (leaf name for sub-accounts). */
  name: string;
  debitCents: number;
  creditCents: number;
  /** Section headers this row sits under, outermost first. */
  path: string[];
}

export interface QboReportHeader {
  reportBasis: string | null;
  startPeriod: string | null;
  endPeriod: string | null;
  currency: string | null;
  time: string | null;
  noReportData: boolean;
}

interface ColData {
  value?: unknown;
  id?: unknown;
}
interface Row {
  type?: unknown;
  group?: unknown;
  ColData?: ColData[];
  Header?: { ColData?: ColData[] };
  Rows?: { Row?: Row[] };
  Summary?: { ColData?: ColData[] };
}
interface Report {
  Header?: Record<string, unknown> & { Option?: Array<{ Name?: unknown; Value?: unknown }> };
  Columns?: { Column?: Array<{ ColTitle?: unknown; ColType?: unknown }> };
  Rows?: { Row?: Row[] };
}

/**
 * "1,234.56" → 123456; "-45.10" → -4510; "(45.10)" → -4510; "" → 0.
 * Anything else throws — a silent 0 for "N/A" would understate a balance.
 */
export function parseMoneyCents(raw: unknown): number {
  if (raw === null || raw === undefined) return 0;
  let s = String(raw).replace(/[,\s$]/g, '');
  if (s === '' || s === '-') return 0;
  let negative = false;
  if (s.startsWith('(') && s.endsWith(')')) {
    negative = true;
    s = s.slice(1, -1);
  }
  if (s.startsWith('-')) {
    negative = !negative;
    s = s.slice(1);
  }
  if (!/^\d+(\.\d{1,2})?$/.test(s)) throw new Error(`Unparseable amount in QuickBooks report: "${String(raw)}"`);
  const [whole, frac = ''] = s.split('.');
  const cents = Number(whole) * 100 + Number((frac + '00').slice(0, 2));
  return negative ? -cents : cents;
}

function str(v: unknown): string {
  return v === null || v === undefined ? '' : String(v);
}

export function parseReportHeader(report: unknown): QboReportHeader {
  const h = ((report ?? {}) as Report).Header ?? {};
  const opts = Array.isArray(h.Option) ? h.Option : [];
  const noData = opts.some((o) => str(o?.Name) === 'NoReportData' && str(o?.Value).toLowerCase() === 'true');
  return {
    reportBasis: h.ReportBasis ? str(h.ReportBasis) : null,
    startPeriod: h.StartPeriod ? str(h.StartPeriod) : null,
    endPeriod: h.EndPeriod ? str(h.EndPeriod) : null,
    currency: h.Currency ? str(h.Currency) : null,
    time: h.Time ? str(h.Time) : null,
    noReportData: noData,
  };
}

/** Debit/credit column positions from `Columns`; QBO's default order when titles are absent. */
function moneyColumns(report: Report): { debit: number; credit: number } {
  const cols = report.Columns?.Column ?? [];
  let debit = -1;
  let credit = -1;
  cols.forEach((c, i) => {
    const title = str(c?.ColTitle).trim().toLowerCase();
    if (title === 'debit') debit = i;
    else if (title === 'credit') credit = i;
  });
  return { debit: debit >= 0 ? debit : 1, credit: credit >= 0 ? credit : 2 };
}

export function flattenTrialBalanceRows(report: unknown): QboReportRow[] {
  const r = (report ?? {}) as Report;
  if (parseReportHeader(r).noReportData) return [];
  const cols = moneyColumns(r);
  const out: QboReportRow[] = [];

  const walk = (rows: Row[] | undefined, path: string[]): void => {
    for (const row of rows ?? []) {
      const type = str(row?.type);
      if (type === 'Data' || (type === '' && Array.isArray(row?.ColData) && !row.Rows)) {
        const cd = row.ColData ?? [];
        const idRaw = cd[0]?.id;
        const id = idRaw === null || idRaw === undefined || str(idRaw).trim() === '' ? null : str(idRaw).trim();
        out.push({
          qboAccountId: id,
          name: str(cd[0]?.value).trim(),
          debitCents: parseMoneyCents(cd[cols.debit]?.value),
          creditCents: parseMoneyCents(cd[cols.credit]?.value),
          path,
        });
        continue;
      }
      if (type === 'Section' || row?.Rows) {
        const headerName = str(row?.Header?.ColData?.[0]?.value).trim();
        walk(row?.Rows?.Row, headerName ? [...path, headerName] : path);
      }
      // Summary rows are totals, never accounts.
    }
  };
  walk(r.Rows?.Row, []);
  return out;
}

export interface SummaryTotals {
  debitCents: number;
  creditCents: number;
}

/** The report's own grand total (the `GrandTotal` section, or a top-level Summary titled TOTAL). */
export function extractSummaryTotals(report: unknown): SummaryTotals | null {
  const r = (report ?? {}) as Report;
  const cols = moneyColumns(r);
  const rows = r.Rows?.Row ?? [];
  const pick = (row: Row): SummaryTotals | null => {
    const cd = row?.Summary?.ColData;
    if (!cd) return null;
    return { debitCents: parseMoneyCents(cd[cols.debit]?.value), creditCents: parseMoneyCents(cd[cols.credit]?.value) };
  };
  const grand = rows.find((row) => str(row?.group) === 'GrandTotal');
  if (grand) return pick(grand);
  const titled = rows.find((row) => str(row?.Summary?.ColData?.[0]?.value).trim().toUpperCase() === 'TOTAL' && !row.Rows);
  return titled ? pick(titled) : null;
}

export interface TotalsValidation {
  debitCents: number;
  creditCents: number;
  balanced: boolean;
  imbalanceCents: number;
  /** false only when the report carries a summary AND our sum disagrees with it. */
  summaryMatches: boolean;
  summaryMissing: boolean;
}

export function validateTotals(rows: QboReportRow[], summary: SummaryTotals | null): TotalsValidation {
  let debitCents = 0;
  let creditCents = 0;
  for (const row of rows) {
    debitCents += row.debitCents;
    creditCents += row.creditCents;
  }
  const summaryMatches = summary ? summary.debitCents === debitCents && summary.creditCents === creditCents : true;
  return {
    debitCents,
    creditCents,
    balanced: debitCents === creditCents,
    imbalanceCents: debitCents - creditCents,
    summaryMatches,
    summaryMissing: summary === null,
  };
}
