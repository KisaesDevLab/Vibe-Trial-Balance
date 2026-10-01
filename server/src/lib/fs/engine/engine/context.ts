// Copyright 2025-2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Use is limited to qualifying small businesses. See LICENSE for terms.

// Engine context: closed balance sheets per date, P&L activity per income
// statement column, account/grouping lookups, cash-flow classification and
// the shared check list. Built once per compute.

import type { FsCashFlowClass, FsLayout, FsReportSettings, FsStyle } from '../schemas';
import type { FsCheck, FsSourceAccount, FsSourceData, FsSourceGrouping, FsSourcePeriod } from '../model';
import { fsDefaultCashFlowClass } from '../defaults';
import { fsPlanColumns, type FsPlan, type FsPlanRange } from '../periods';
import { isBsType, presUnit, toUnits } from './util';

export interface AmountCol<K extends string = string> {
  key: K;
  label: string;
  sublabel?: string;
  available: boolean;
  // BS column date / IS range.
  date?: string;
  range?: FsPlanRange;
}

export type Balances = Map<string, number>;

export interface EngineCtx {
  settings: FsReportSettings;
  layout: FsLayout;
  style: FsStyle;
  source: FsSourceData;
  plan: FsPlan;
  decimals: 0 | 2;
  unit: number;
  accounts: Map<string, FsSourceAccount>;
  groupingById: Map<string, FsSourceGrouping>;
  groupingByCode: Map<string, FsSourceGrouping>;
  groupingOfAccount: Map<string, FsSourceGrouping>;
  bsCols: AmountCol[];
  plCols: AmountCol[];
  // Closed (P&L folded into RE) balance sheet at a date. 'open' reads the
  // book (Adjusted) column even for tax-basis statements — tax RJEs are
  // current-year only, so beginning balances are book.
  bsClosed(date: string, role?: 'close' | 'open'): Balances | null;
  // P&L activity for a planned range (the snapshot ending on range.end).
  plActivity(range: { start: string; end: string }): Balances | null;
  // Whether a snapshot exists at a date at all. bsClosed() is null both for
  // a known-empty opening (a first-year client: zero) and for an unknown
  // one (no prior period in the app); only this tells them apart.
  hasSnapshot(date: string): boolean;
  cfClass(accountId: string): FsCashFlowClass;
  checks: FsCheck[];
  comparative: boolean;
}

function toMap(p: FsSourcePeriod | undefined, tax = false): Balances | null {
  if (!p || !p.hasData) return null;
  const m = new Map<string, number>();
  for (const [k, v] of Object.entries(tax && p.taxBalances ? p.taxBalances : p.balances)) {
    const u = toUnits(v);
    if (u !== 0) m.set(k, u);
  }
  return m;
}

export function buildContext(settings: FsReportSettings, layout: FsLayout, style: FsStyle, source: FsSourceData): EngineCtx {
  const accounts = new Map(source.accounts.map((a) => [a.id, a]));
  // Cloned: the RE fold below adds a member without touching the caller's source.
  const groupings = source.groupings.map((g) => ({ ...g, accountIds: [...g.accountIds] }));
  const groupingById = new Map(groupings.map((g) => [g.id, g]));
  const groupingByCode = new Map<string, FsSourceGrouping>();
  for (const g of groupings) if (g.code && !groupingByCode.has(g.code)) groupingByCode.set(g.code, g);
  const groupingOfAccount = new Map<string, FsSourceGrouping>();
  for (const g of groupings) for (const a of g.accountIds) groupingOfAccount.set(a, g);

  // The RE fold account (virtual when no system RE) rides with the
  // leadsheet holding the most equity accounts so closed balance sheets
  // (RE + current income) always have a home.
  if (!groupingOfAccount.has(source.reAccountId)) {
    let best: FsSourceGrouping | null = null;
    let bestN = 0;
    for (const g of groupings) {
      const n = g.accountIds.filter((id) => accounts.get(id)?.accountType === 'equity').length;
      if (n > bestN) { best = g; bestN = n; }
    }
    if (!best) best = groupingByCode.get('J') ?? null;
    if (best) {
      groupingOfAccount.set(source.reAccountId, best);
      best.accountIds.push(source.reAccountId);
    }
  }
  if (!accounts.has(source.reAccountId)) {
    accounts.set(source.reAccountId, {
      id: source.reAccountId, number: null, name: 'Retained earnings', accountType: 'equity',
      detailType: 'retained_earnings', isVirtual: true,
    });
  }

  const plan = fsPlanColumns(settings, source);
  const tax = settings.framework === 'tax';
  const isBsAcct = (id: string) => isBsType(accounts.get(id)?.accountType ?? 'expense');

  const rawCache = new Map<string, Balances | null>();
  const raw = (date: string, useTax: boolean): Balances | null => {
    const k = `${useTax ? 'x' : 'b'}|${date}`;
    if (!rawCache.has(k)) rawCache.set(k, toMap(source.snapshots[date], useTax));
    return rawCache.get(k)!;
  };

  const closedCache = new Map<string, Balances | null>();
  const closed = (date: string, role: 'close' | 'open' = 'close'): Balances | null => {
    const key = `${role}|${date}`;
    if (closedCache.has(key)) return closedCache.get(key)!;
    const src = raw(date, tax && role === 'close');
    let out: Balances | null = null;
    if (src) {
      out = new Map();
      let pl = 0;
      for (const [id, v] of src) {
        if (isBsAcct(id)) out.set(id, (out.get(id) ?? 0) + v);
        else pl += v;
      }
      if (pl !== 0) out.set(source.reAccountId, (out.get(source.reAccountId) ?? 0) + pl);
    }
    closedCache.set(key, out);
    return out;
  };

  // A planned range's P&L is the P&L half of the snapshot ending on it: a
  // trial balance period holds the period's own activity, so there is
  // nothing to compose.
  const compose = (range: { start: string; end: string }): Balances | null => {
    const m = raw(range.end, tax);
    if (!m) return null;
    const out: Balances = new Map();
    for (const [id, v] of m) if (!isBsAcct(id)) out.set(id, v);
    return out;
  };

  const bsCols: AmountCol[] = plan.bsPoints.map((p) => ({ key: p.key, label: p.label, date: p.date, available: !!raw(p.date, tax) }));
  const plCols: AmountCol[] = plan.isRanges.map((r) => ({
    key: r.key, label: r.label, sublabel: r.sublabel, range: r,
    available: !!compose(r),
  }));

  const overrideByAccount = new Map<string, FsCashFlowClass>();
  const overrideByGrouping = new Map<string, FsCashFlowClass>();
  for (const o of source.cashFlowOverrides) {
    if (o.accountId) overrideByAccount.set(o.accountId, o.classification);
    else if (o.groupingId) overrideByGrouping.set(o.groupingId, o.classification);
  }
  const cfClass = (accountId: string): FsCashFlowClass => {
    const o = overrideByAccount.get(accountId);
    if (o) return o;
    const g = groupingOfAccount.get(accountId);
    if (g && overrideByGrouping.has(g.id)) return overrideByGrouping.get(g.id)!;
    const a = accounts.get(accountId);
    if (!a) return 'excluded';
    if (accountId === source.reAccountId) return 'financing';
    return fsDefaultCashFlowClass(a, g?.code ?? null);
  };

  const decimals = style.number.decimals;
  return {
    settings, layout, style, source, plan, decimals, unit: presUnit(decimals),
    accounts, groupingById, groupingByCode, groupingOfAccount,
    bsCols, plCols,
    bsClosed: closed,
    plActivity: compose,
    hasSnapshot: (date) => Object.prototype.hasOwnProperty.call(source.snapshots, date),
    cfClass,
    checks: [],
    comparative: plan.bsPoints.length > 1,
  };
}
