// Copyright 2025-2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Use is limited to qualifying small businesses. See LICENSE for terms.

// Engine input (FsSourceData — balances pulled from the adjusted trial
// balance) and output (FsRenderedReport — the one model every renderer
// consumes: HTML preview, PDF, DOCX, XLSX). Amounts in the source are SIGNED
// (+ = debit) integer CENTS.
//
// Ids are the database's integer ids carried as decimal STRINGS: they are
// object keys in the balances maps and in layout JSON, where a number would
// be coerced to a string anyway.

import type { FsCashFlowClass, FsColumnMode, FsEntityKind, FsFramework, FsPageSetup, FsRule, FsStatementKind } from './schemas';

export interface FsSourceAccount {
  id: string;
  number: string | null;
  name: string;
  accountType: string; // asset | liability | equity | revenue | expense (chart_of_accounts.category, singular)
  detailType: string | null; // always null here; kept for the cash-flow default heuristics
  isVirtual: boolean; // FS_VIRTUAL_RE_ID row (the client has no retained-earnings account)
}

export interface FsSourcePeriod {
  date: string;
  // Signed cents by account id, as a PRE-CLOSING trial balance at `date`:
  // balance sheet accounts at that date, P&L accounts for the period ending
  // on it (the engine closes them into retained earnings).
  balances: Record<string, number>;
  // Tax column (income-tax-basis statements): book-adjusted + tax AJEs.
  taxBalances?: Record<string, number>;
  // False when every balance is zero. A snapshot that is PRESENT with
  // hasData false is a known-empty opening (a first-year client); a snapshot
  // that is ABSENT from `snapshots` is an unknown one.
  hasData: boolean;
}

export interface FsSourceGrouping {
  id: string;
  code: string | null;
  name: string;
  sortOrder: number;
  accountIds: string[];
}

export type FsEquityRole = 'retained' | 'distributions' | 'contributions' | 'other';

export interface FsSourceData {
  companyName: string;
  entityKind: FsEntityKind;
  framework: FsFramework;
  // SHA-256 over everything that feeds the numbers (lib/fs/fsStamp.ts).
  sourceStamp: string;
  // This period, and the prior year it is compared with. `priorEnd` is the
  // day before `periodStart` (see FsPlanDates in periods.ts).
  periodStart: string;
  periodEnd: string;
  priorStart: string;
  priorEnd: string;
  accounts: FsSourceAccount[];
  groupings: FsSourceGrouping[];
  // Trial balance snapshots by date: `periodEnd` (this period), `priorEnd`
  // (the stored prior-year balances — always present) and, when the prior
  // period exists in the app, the day before `priorStart` (its opening).
  snapshots: Record<string, FsSourcePeriod>;
  // Account that receives the year-end P&L close (the client's retained
  // earnings account, or the virtual one).
  reAccountId: string;
  equityRoles: Record<string, FsEquityRole>;
  cashFlowOverrides: Array<{ accountId: string | null; groupingId: string | null; classification: FsCashFlowClass }>;
  // True when the prior-year column of an income-tax-basis statement had to
  // fall back to book balances (no prior period to take tax AJEs from).
  taxPriorIsBook?: boolean;
}

// ─── Rendered model ────────────────────────────────────────────────

export type FsColumnKind = 'amount' | 'pct' | 'variance_amt' | 'variance_pct';

export interface FsColumnDef {
  key: string;
  label: string;       // e.g. "2025", "Month", "Year to Date", "% of Revenue"
  sublabel?: string;
  kind: FsColumnKind;
}

export type FsRowKind = 'heading' | 'detail' | 'subtotal' | 'total' | 'text' | 'blank' | 'page_break';
export type FsStyleRole = 'sectionHeading' | 'detail' | 'subtotal' | 'total' | 'text';

export type FsRowFormula =
  | { kind: 'sum'; rows: number[] }                               // row indexes in the same statement
  | { kind: 'terms'; terms: Array<{ row: number; sign: 1 | -1 }> };

export interface FsRow {
  key: string;
  nodeId?: string;
  kind: FsRowKind;
  caption: string;
  level: number;
  styleRole: FsStyleRole;
  bold?: boolean;
  italic?: boolean;
  caps?: boolean;
  sizeDelta?: number;
  // One entry per statement column. Amount columns are rounded display
  // values (dollars, or cents when decimals=2); pct columns are percents
  // (12.3 = 12.3%). null = blank cell.
  values: Array<number | null>;
  dollarSign: boolean;
  ruleAbove: 'none' | 'single';
  ruleBelow: FsRule;
  scheduleRef?: string; // "Schedule 1"
  plug?: Array<number>;   // rounding plug applied, per amount column
  formula?: FsRowFormula; // amount columns only (XLSX)
  breakBefore?: boolean;
}

export interface FsRenderedStatement {
  id: string;
  kind: FsStatementKind | 'schedule';
  title: string;
  dateLine: string;
  scheduleNo?: string;
  pageSetup: FsPageSetup;
  columns: FsColumnDef[];
  rows: FsRow[];
}

export type FsCheckSeverity = 'error' | 'warning' | 'info';

export interface FsCheck {
  code: string;
  severity: FsCheckSeverity;
  message: string;
  statementId?: string;
  nodeId?: string;
  accountIds?: string[];
  amount?: number;
}

export interface FsRenderedReport {
  meta: {
    companyName: string;
    periodStart: string;
    periodEnd: string;
    framework: FsFramework;
    entityKind: FsEntityKind;
    columnMode: FsColumnMode;
    sourceStamp: string;
    decimals: 0 | 2;
    // "December 31, 2025" / "September 30, 2026 and December 31, 2025".
    bsDateLine: string;
  };
  statements: FsRenderedStatement[]; // face statements in layout order
  schedules: FsRenderedStatement[];  // supplementary schedules, numbered
  checks: FsCheck[];
}
