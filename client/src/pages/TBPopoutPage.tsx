// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2024–2026 [Project Author]

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { getTrialBalance, type TBRow } from '../api/trialBalance';

// ─── Helpers ──────────────────────────────────────────────────────────────

function fmt(cents: number): string {
  if (cents === 0) return '—';
  return (cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtTotal(cents: number): string {
  return (cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtNet(dr: number, cr: number): string {
  const net = dr - cr;
  if (net === 0) return '—';
  const abs = (Math.abs(net) / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return net < 0 ? `(${abs})` : abs;
}

const MIN_FONT = 11;
const MAX_FONT = 36;
const CATEGORY_ORDER: Record<string, number> = { assets: 0, liabilities: 1, equity: 2, revenue: 3, expenses: 4 };

function getInitialFontSize(): number {
  try {
    const stored = localStorage.getItem('ui-prefs');
    if (stored) {
      const parsed = JSON.parse(stored);
      const fs = parsed?.state?.fontSize;
      if (typeof fs === 'number' && fs >= MIN_FONT && fs <= MAX_FONT) return fs;
    }
  } catch { /* ignore */ }
  return 16;
}

// ─── Column definitions ───────────────────────────────────────────────────

type ColDef = {
  id: string;
  header: string;
  getValue: (r: TBRow) => string;
  bgClass?: string;
  visible?: (opts: ViewOpts) => boolean;
};

type ViewOpts = { showPY: boolean; showTax: boolean; hasTrans: boolean; single: boolean };

const ALL_COLS: ColDef[] = [
  { id: 'acct', header: 'Acct #', getValue: r => r.account_number },
  { id: 'name', header: 'Account Name', getValue: r => r.account_name },
  { id: 'cat', header: 'Cat.', getValue: r => r.category.slice(0, 3) },
  // PY dual
  { id: 'py_dr', header: 'PY Dr', getValue: r => fmt(r.prior_year_debit), bgClass: 'bg-gray-100/60', visible: o => o.showPY && !o.single },
  { id: 'py_cr', header: 'PY Cr', getValue: r => fmt(r.prior_year_credit), bgClass: 'bg-gray-100/60', visible: o => o.showPY && !o.single },
  // Unadjusted dual
  { id: 'unaj_dr', header: 'Unaj. Dr', getValue: r => fmt(r.unadjusted_debit), visible: o => !o.single },
  { id: 'unaj_cr', header: 'Unaj. Cr', getValue: r => fmt(r.unadjusted_credit), visible: o => !o.single },
  // Trans dual
  { id: 'trans_dr', header: 'Trans Dr', getValue: r => fmt(r.trans_adj_debit), bgClass: 'bg-teal-50/50', visible: o => o.hasTrans && !o.single },
  { id: 'trans_cr', header: 'Trans Cr', getValue: r => fmt(r.trans_adj_credit), bgClass: 'bg-teal-50/50', visible: o => o.hasTrans && !o.single },
  // AJE dual
  { id: 'aje_dr', header: 'AJE Dr', getValue: r => fmt(r.book_adj_debit), visible: o => !o.single },
  { id: 'aje_cr', header: 'AJE Cr', getValue: r => fmt(r.book_adj_credit), visible: o => !o.single },
  // Adjusted dual
  { id: 'adj_dr', header: 'Adj Dr', getValue: r => { const n = r.book_adjusted_debit - r.book_adjusted_credit; return n > 0 ? fmt(n) : '—'; }, bgClass: 'bg-blue-50/50', visible: o => !o.single },
  { id: 'adj_cr', header: 'Adj Cr', getValue: r => { const n = r.book_adjusted_credit - r.book_adjusted_debit; return n > 0 ? fmt(n) : '—'; }, bgClass: 'bg-blue-50/50', visible: o => !o.single },
  // Tax dual
  { id: 'tax_adj_dr', header: 'Tx Adj Dr', getValue: r => fmt(r.tax_adj_debit), visible: o => o.showTax && !o.single },
  { id: 'tax_adj_cr', header: 'Tx Adj Cr', getValue: r => fmt(r.tax_adj_credit), visible: o => o.showTax && !o.single },
  { id: 'tax_dr', header: 'Tx Dr', getValue: r => { const n = r.tax_adjusted_debit - r.tax_adjusted_credit; return n > 0 ? fmt(n) : '—'; }, bgClass: 'bg-purple-50/50', visible: o => o.showTax && !o.single },
  { id: 'tax_cr', header: 'Tx Cr', getValue: r => { const n = r.tax_adjusted_credit - r.tax_adjusted_debit; return n > 0 ? fmt(n) : '—'; }, bgClass: 'bg-purple-50/50', visible: o => o.showTax && !o.single },
  // Single-column variants
  { id: 's_py', header: 'Prior Year', getValue: r => fmtNet(r.prior_year_debit, r.prior_year_credit), bgClass: 'bg-gray-100/60', visible: o => o.showPY && o.single },
  { id: 's_unaj', header: 'Unadjusted', getValue: r => fmtNet(r.unadjusted_debit, r.unadjusted_credit), visible: o => o.single },
  { id: 's_trans', header: 'Trans JEs', getValue: r => fmtNet(r.trans_adj_debit, r.trans_adj_credit), bgClass: 'bg-teal-50/50', visible: o => o.hasTrans && o.single },
  { id: 's_post', header: 'Post-Trans', getValue: r => fmtNet(r.post_trans_debit, r.post_trans_credit), bgClass: 'bg-teal-50/50', visible: o => o.hasTrans && o.single },
  { id: 's_aje', header: 'AJE', getValue: r => fmtNet(r.book_adj_debit, r.book_adj_credit), visible: o => o.single },
  { id: 's_adj', header: 'Adjusted', getValue: r => fmtNet(r.book_adjusted_debit, r.book_adjusted_credit), bgClass: 'bg-blue-50/50', visible: o => o.single },
  { id: 's_txadj', header: 'Tx Adj', getValue: r => fmtNet(r.tax_adj_debit, r.tax_adj_credit), visible: o => o.showTax && o.single },
  { id: 's_tx', header: 'Tax Bal', getValue: r => fmtNet(r.tax_adjusted_debit, r.tax_adjusted_credit), bgClass: 'bg-purple-50/50', visible: o => o.showTax && o.single },
];

// ─── Footer totals ────────────────────────────────────────────────────────

function colTotal(rows: TBRow[], id: string): string {
  const sum = (fn: (r: TBRow) => number) => rows.reduce((s, r) => s + fn(r), 0);
  const netDr = (dk: (r: TBRow) => number, ck: (r: TBRow) => number) => rows.reduce((s, r) => { const n = dk(r) - ck(r); return s + (n > 0 ? n : 0); }, 0);
  const netCr = (dk: (r: TBRow) => number, ck: (r: TBRow) => number) => rows.reduce((s, r) => { const n = ck(r) - dk(r); return s + (n > 0 ? n : 0); }, 0);
  switch (id) {
    case 'py_dr':      return fmtTotal(sum(r => r.prior_year_debit));
    case 'py_cr':      return fmtTotal(sum(r => r.prior_year_credit));
    case 'unaj_dr':    return fmtTotal(sum(r => r.unadjusted_debit));
    case 'unaj_cr':    return fmtTotal(sum(r => r.unadjusted_credit));
    case 'trans_dr':   return fmtTotal(sum(r => r.trans_adj_debit));
    case 'trans_cr':   return fmtTotal(sum(r => r.trans_adj_credit));
    case 'aje_dr':     return fmtTotal(sum(r => r.book_adj_debit));
    case 'aje_cr':     return fmtTotal(sum(r => r.book_adj_credit));
    case 'adj_dr':     return fmtTotal(netDr(r => r.book_adjusted_debit, r => r.book_adjusted_credit));
    case 'adj_cr':     return fmtTotal(netCr(r => r.book_adjusted_debit, r => r.book_adjusted_credit));
    case 'tax_adj_dr': return fmtTotal(sum(r => r.tax_adj_debit));
    case 'tax_adj_cr': return fmtTotal(sum(r => r.tax_adj_credit));
    case 'tax_dr':     return fmtTotal(netDr(r => r.tax_adjusted_debit, r => r.tax_adjusted_credit));
    case 'tax_cr':     return fmtTotal(netCr(r => r.tax_adjusted_debit, r => r.tax_adjusted_credit));
    case 's_py':       return fmtNet(sum(r => r.prior_year_debit), sum(r => r.prior_year_credit));
    case 's_unaj':     return fmtNet(sum(r => r.unadjusted_debit), sum(r => r.unadjusted_credit));
    case 's_trans':    return fmtNet(sum(r => r.trans_adj_debit), sum(r => r.trans_adj_credit));
    case 's_post':     return fmtNet(sum(r => r.post_trans_debit), sum(r => r.post_trans_credit));
    case 's_aje':      return fmtNet(sum(r => r.book_adj_debit), sum(r => r.book_adj_credit));
    case 's_adj':      return fmtNet(sum(r => r.book_adjusted_debit), sum(r => r.book_adjusted_credit));
    case 's_txadj':    return fmtNet(sum(r => r.tax_adj_debit), sum(r => r.tax_adj_credit));
    case 's_tx':       return fmtNet(sum(r => r.tax_adjusted_debit), sum(r => r.tax_adjusted_credit));
    default:           return '';
  }
}

const IS_TEXT_COL = new Set(['acct', 'name', 'cat']);

// ─── Component ────────────────────────────────────────────────────────────

export function TBPopoutPage() {
  const [params] = useSearchParams();
  const periodId = Number(params.get('periodId'));
  const periodName = params.get('name') ?? '';
  const [data, setData] = useState<TBRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showPY, setShowPY] = useState(false);
  const [showTax, setShowTax] = useState(true);
  const [single, setSingle] = useState(false);
  const [fontSize, setFontSize] = useState(getInitialFontSize);

  // Apply font size to document root so all rem-based sizes scale
  useEffect(() => {
    document.documentElement.style.fontSize = `${fontSize}px`;
    return () => { document.documentElement.style.fontSize = ''; };
  }, [fontSize]);

  useEffect(() => {
    if (periodName) document.title = `TB — ${periodName}`;
  }, [periodName]);

  const fetchData = useCallback(async () => {
    if (!periodId) return;
    try {
      const res = await getTrialBalance(periodId);
      if (res.error) { setError(res.error.message); return; }
      setData(res.data ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    }
  }, [periodId]);

  useEffect(() => { fetchData(); }, [fetchData]);
  useEffect(() => {
    const onFocus = () => fetchData();
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [fetchData]);
  useEffect(() => {
    const onMessage = (e: MessageEvent) => { if (e.data === 'tb-refresh') fetchData(); };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [fetchData]);

  const hasTrans = useMemo(
    () => (data ?? []).some(r => r.trans_adj_debit !== 0 || r.trans_adj_credit !== 0),
    [data],
  );

  const opts: ViewOpts = { showPY, showTax, hasTrans, single };
  const visibleCols = useMemo(() => ALL_COLS.filter(c => !c.visible || c.visible(opts)), [showPY, showTax, hasTrans, single]);

  const sorted = useMemo(() =>
    [...(data ?? [])]
      .filter(r => r.is_active)
      .sort((a, b) => {
        const c = (CATEGORY_ORDER[a.category] ?? 9) - (CATEGORY_ORDER[b.category] ?? 9);
        return c !== 0 ? c : a.account_number.localeCompare(b.account_number);
      }),
    [data],
  );

  if (!periodId) return <div className="p-4 text-red-600">Missing periodId parameter.</div>;
  if (error) return <div className="p-4 text-red-600">Error: {error}</div>;
  if (!data) return <div className="p-4 text-gray-500">Loading...</div>;

  const totalDr = sorted.reduce((s, r) => s + r.unadjusted_debit, 0);
  const totalCr = sorted.reduce((s, r) => s + r.unadjusted_credit, 0);
  const balanced = totalDr === totalCr;

  return (
    <div className="h-screen flex flex-col bg-white text-gray-900 select-none" style={{ fontSize: '0.75rem' }}>
      {/* Header — fixed pixel sizes so toggles stay readable at any zoom */}
      <div className="flex items-center justify-between px-3 py-1 bg-gray-100 border-b border-gray-300 shrink-0" style={{ fontSize: '0.7rem' }}>
        <span className="font-semibold text-gray-700 tracking-wide uppercase">
          TB {periodName && `— ${periodName}`}
        </span>
        <div className="flex items-center gap-2.5">
          {/* Font size controls */}
          <span className="flex items-center gap-0.5">
            <button
              onClick={() => setFontSize(s => Math.max(MIN_FONT, s - 1))}
              disabled={fontSize <= MIN_FONT}
              className="w-4 h-4 flex items-center justify-center rounded border border-gray-300 text-gray-500 hover:bg-gray-200 disabled:opacity-30 leading-none"
              title="Decrease font size"
            >
              &minus;
            </button>
            <span className="text-gray-500 w-5 text-center tabular-nums">{fontSize}</span>
            <button
              onClick={() => setFontSize(s => Math.min(MAX_FONT, s + 1))}
              disabled={fontSize >= MAX_FONT}
              className="w-4 h-4 flex items-center justify-center rounded border border-gray-300 text-gray-500 hover:bg-gray-200 disabled:opacity-30 leading-none"
              title="Increase font size"
            >
              +
            </button>
          </span>
          <span className="text-gray-300">|</span>
          {/* Toggles */}
          <label className="flex items-center gap-0.5 cursor-pointer">
            <input type="checkbox" checked={single} onChange={e => setSingle(e.target.checked)} className="rounded border-gray-300 text-blue-600 w-3 h-3" />
            <span className="text-gray-600">Single</span>
          </label>
          <label className="flex items-center gap-0.5 cursor-pointer">
            <input type="checkbox" checked={showPY} onChange={e => setShowPY(e.target.checked)} className="rounded border-gray-300 text-gray-500 w-3 h-3" />
            <span className="text-gray-600">PY</span>
          </label>
          <label className="flex items-center gap-0.5 cursor-pointer">
            <input type="checkbox" checked={showTax} onChange={e => setShowTax(e.target.checked)} className="rounded border-gray-300 text-purple-600 w-3 h-3" />
            <span className="text-gray-600">Tax</span>
          </label>
          <span className="text-gray-300">|</span>
          <span className={`font-medium px-1.5 py-0.5 rounded ${balanced ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
            {balanced ? 'Balanced' : `OOB $${fmtTotal(Math.abs(totalDr - totalCr))}`}
          </span>
          <button onClick={fetchData} title="Refresh" className="text-gray-400 hover:text-gray-700">&#x21bb;</button>
        </div>
      </div>

      {/* Table — inherits 0.75rem from container, scales with root font-size */}
      <div className="flex-1 overflow-auto">
        <table className="w-full border-collapse">
          <thead className="sticky top-0 bg-gray-50 z-10">
            <tr className="border-b border-gray-300">
              {visibleCols.map(c => (
                <th
                  key={c.id}
                  className={`px-1.5 py-1 font-semibold text-gray-600 uppercase tracking-wider whitespace-nowrap ${
                    IS_TEXT_COL.has(c.id) ? 'text-left' : 'text-right'
                  } ${c.bgClass ?? ''}`}
                >
                  {c.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((r, i) => (
              <tr key={r.account_id} className={i % 2 === 0 ? '' : 'bg-gray-50/60'}>
                {visibleCols.map(c => (
                  <td
                    key={c.id}
                    className={`px-1.5 py-px whitespace-nowrap ${
                      c.id === 'acct' ? 'font-mono text-gray-800' :
                      c.id === 'name' ? 'text-gray-700 truncate max-w-[16rem]' :
                      c.id === 'cat' ? 'text-gray-500 capitalize' :
                      'text-right font-mono tabular-nums'
                    } ${c.bgClass ?? ''}`}
                  >
                    {c.getValue(r)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
          <tfoot className="sticky bottom-0 bg-white z-10">
            <tr className="border-t-2 border-gray-400 font-semibold">
              {visibleCols.map(c => {
                if (c.id === 'acct') return <td key={c.id} className="px-1.5 py-1" />;
                if (c.id === 'name') return <td key={c.id} className="px-1.5 py-1 text-right text-gray-500 uppercase tracking-wider">Totals ({sorted.length})</td>;
                if (c.id === 'cat') return <td key={c.id} className="px-1.5 py-1" />;
                return (
                  <td key={c.id} className={`px-1.5 py-1 text-right font-mono tabular-nums ${c.bgClass ?? ''}`}>
                    {colTotal(sorted, c.id)}
                  </td>
                );
              })}
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

/** Open the TB popout window from the main app */
export function openTBPopout(periodId: number, periodName?: string) {
  const width = 900;
  const height = 700;
  const left = window.screenX + window.outerWidth - width - 20;
  const top = window.screenY + 60;
  const nameParam = periodName ? `&name=${encodeURIComponent(periodName)}` : '';
  window.open(
    `/tb-popout?periodId=${periodId}${nameParam}`,
    'tb-popout',
    `width=${width},height=${height},left=${left},top=${top},menubar=no,toolbar=no,location=no,status=no,resizable=yes,scrollbars=yes`,
  );
}
