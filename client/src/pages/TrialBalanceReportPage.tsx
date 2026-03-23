import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getTrialBalance, type TBRow } from '../api/trialBalance';
import { listClients } from '../api/clients';
import { listPeriods } from '../api/periods';
import { useUIStore, useAuthStore } from '../store/uiStore';
import { getTBTickmarks, TICKMARK_COLOR_CLASSES, type TBTickmarkMap } from '../api/tickmarks';
import { openPdfPreview, downloadPdf, pdfReports } from '../api/pdfReports';
import { downloadXlsx } from '../utils/downloadXlsx';

function fmt(cents: number): string {
  if (cents === 0) return '—';
  return (cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtTotal(cents: number): string {
  return (cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const CATEGORIES = ['assets', 'liabilities', 'equity', 'revenue', 'expenses'] as const;
const CAT_LABEL: Record<string, string> = {
  assets: 'Assets', liabilities: 'Liabilities', equity: 'Equity',
  revenue: 'Revenue', expenses: 'Expenses',
};

function netRow(r: TBRow, dk: keyof TBRow, ck: keyof TBRow): number {
  const dr = r[dk] as number;
  const cr = r[ck] as number;
  return r.normal_balance === 'debit' ? dr - cr : cr - dr;
}

function fmtPct(pct: number | null): React.ReactNode {
  if (pct === null) return <span className="text-gray-400 dark:text-gray-500">—</span>;
  const cls = pct > 0 ? 'text-green-700 dark:text-green-400' : pct < 0 ? 'text-red-600 dark:text-red-400' : 'text-gray-400 dark:text-gray-500';
  return <span className={cls}>{pct > 0 ? '+' : ''}{pct.toFixed(1)}%</span>;
}

interface Totals { pyd: number; pyc: number; ud: number; uc: number; bad: number; bac: number; bd: number; bc: number; tad: number; tac: number; td: number; tc: number; }

function sumRows(rows: TBRow[]): Totals {
  return rows.reduce((s, r) => ({
    pyd: s.pyd + r.prior_year_debit, pyc: s.pyc + r.prior_year_credit,
    ud: s.ud + r.unadjusted_debit, uc: s.uc + r.unadjusted_credit,
    bad: s.bad + r.book_adj_debit, bac: s.bac + r.book_adj_credit,
    bd: s.bd + r.book_adjusted_debit, bc: s.bc + r.book_adjusted_credit,
    tad: s.tad + r.tax_adj_debit, tac: s.tac + r.tax_adj_credit,
    td: s.td + r.tax_adjusted_debit, tc: s.tc + r.tax_adjusted_credit,
  }), { pyd:0,pyc:0,ud:0,uc:0,bad:0,bac:0,bd:0,bc:0,tad:0,tac:0,td:0,tc:0 });
}

const thCls = 'px-2 py-1.5 text-right text-xs font-semibold text-gray-600 dark:text-gray-400 border-r border-gray-200 dark:border-gray-700 last:border-r-0 whitespace-nowrap';
const tdCls = 'px-2 py-1 text-right text-sm font-mono text-gray-700 dark:text-gray-300 border-r border-gray-200 dark:border-gray-700 last:border-r-0';
const tdTotalCls = 'px-2 py-1.5 text-right text-sm font-mono font-semibold text-gray-800 dark:text-gray-200 border-r border-gray-200 dark:border-gray-700 last:border-r-0 border-t border-gray-400 dark:border-gray-500 bg-gray-50 dark:bg-gray-800/60';
const tdGrandCls = 'px-2 py-2 text-right text-sm font-mono font-bold text-gray-900 dark:text-white border-r border-gray-200 dark:border-gray-700 last:border-r-0 border-t-2 border-gray-700 dark:border-gray-500 bg-gray-100 dark:bg-gray-700';

export function TrialBalanceReportPage() {
  const { selectedPeriodId, selectedClientId } = useUIStore();
  const token = useAuthStore((s) => s.token);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);

  const handlePreview = async () => {
    if (!selectedPeriodId || !token) return;
    setPdfLoading(true);
    setPdfError(null);
    try {
      await openPdfPreview(pdfReports.trialBalance(selectedPeriodId) + '?preview=true', token);
    } catch (e) {
      setPdfError((e as Error).message);
    } finally {
      setPdfLoading(false);
    }
  };

  const handleDownload = async () => {
    if (!selectedPeriodId || !token) return;
    setPdfLoading(true);
    setPdfError(null);
    try {
      await downloadPdf(pdfReports.trialBalance(selectedPeriodId), `trial-balance-${selectedPeriodId}.pdf`, token);
    } catch (e) {
      setPdfError((e as Error).message);
    } finally {
      setPdfLoading(false);
    }
  };

  const { data, isLoading, error } = useQuery({
    queryKey: ['trial-balance', selectedPeriodId],
    queryFn: async () => {
      if (!selectedPeriodId) return [];
      const res = await getTrialBalance(selectedPeriodId);
      if (res.error) throw new Error(res.error.message);
      return res.data ?? [];
    },
    enabled: selectedPeriodId !== null,
  });

  const { data: clients } = useQuery({
    queryKey: ['clients'],
    queryFn: async () => { const r = await listClients(); return r.data ?? []; },
  });

  const { data: periods } = useQuery({
    queryKey: ['periods', selectedClientId],
    queryFn: async () => { const r = await listPeriods(selectedClientId!); return r.data ?? []; },
    enabled: selectedClientId !== null,
  });

  const { data: tbTickmarks } = useQuery({
    queryKey: ['tb-tickmarks', selectedPeriodId],
    queryFn: async () => {
      if (!selectedPeriodId) return {} as TBTickmarkMap;
      const res = await getTBTickmarks(selectedPeriodId);
      if (res.error) throw new Error(res.error.message);
      return res.data;
    },
    enabled: selectedPeriodId !== null,
  });

  const client = clients?.find((c) => c.id === selectedClientId);
  const period = periods?.find((p) => p.id === selectedPeriodId);

  const rows = (data ?? []).filter((r) => r.is_active);

  const handleExport = () => {
    const header = [
      'Account #', 'Account Name', 'Category', 'Tax Line', 'Workpaper Ref',
      'PY Dr', 'PY Cr',
      'Unadj Dr', 'Unadj Cr',
      'Book AJE Dr', 'Book AJE Cr',
      'Book Adj Dr', 'Book Adj Cr',
      'Tax AJE Dr', 'Tax AJE Cr',
      'Tax Adj Dr', 'Tax Adj Cr',
    ];
    const dataRows = rows.map((r) => [
      r.account_number, r.account_name, r.category, r.tax_line ?? '', r.workpaper_ref ?? '',
      String(r.prior_year_debit / 100), String(r.prior_year_credit / 100),
      String(r.unadjusted_debit / 100), String(r.unadjusted_credit / 100),
      String(r.book_adj_debit / 100), String(r.book_adj_credit / 100),
      String(r.book_adjusted_debit / 100), String(r.book_adjusted_credit / 100),
      String(r.tax_adj_debit / 100), String(r.tax_adj_credit / 100),
      String(r.tax_adjusted_debit / 100), String(r.tax_adjusted_credit / 100),
    ]);
    downloadXlsx(`trial-balance-report-${selectedPeriodId}.xlsx`, [header, ...dataRows]);
  };

  if (!selectedPeriodId) {
    return (
      <div className="flex items-center justify-center h-full text-gray-400 dark:text-gray-500">
        <div className="text-center">
          <p className="text-lg font-medium">No period selected</p>
          <p className="text-sm mt-1">Choose a client and period from the sidebar.</p>
        </div>
      </div>
    );
  }

  const grand = sumRows(rows);

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Trial Balance Report</h2>
        <div className="flex items-center gap-2">
          <button onClick={handleExport} disabled={!rows.length} className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-700/50 dark:text-gray-300 disabled:opacity-40">Export Excel</button>
          <button
            onClick={handlePreview}
            disabled={pdfLoading}
            className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-700/50 dark:text-gray-300 disabled:opacity-50"
          >
            {pdfLoading ? 'Generating…' : '↗ Preview PDF'}
          </button>
          <button
            onClick={handleDownload}
            disabled={pdfLoading}
            className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
          >
            {pdfLoading ? 'Generating…' : '⬇ Download PDF'}
          </button>
        </div>
      </div>

      {pdfError && (
        <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 text-red-700 dark:text-red-400 text-sm px-3 py-2 rounded mt-2 mb-4">
          {pdfError}
        </div>
      )}

      {/* Report header */}
      {client && (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 px-5 py-3 mb-4 text-sm">
          <div className="flex items-start justify-between">
            <div>
              <p className="font-semibold text-gray-900 dark:text-white text-base">{client.name}</p>
              <p className="text-gray-500 dark:text-gray-400 text-xs mt-0.5">{client.entity_type}{client.tax_id ? ` · EIN: ${client.tax_id}` : ''}</p>
            </div>
            {period && (
              <div className="text-right text-xs text-gray-500 dark:text-gray-400">
                <p className="font-medium text-gray-700 dark:text-gray-300">{period.period_name}</p>
                {period.start_date && period.end_date && (
                  <p>{period.start_date} – {period.end_date}</p>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {error && <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 text-red-700 dark:text-red-400 px-4 py-3 rounded text-sm mb-4">{(error as Error).message}</div>}

      {isLoading ? (
        <div className="flex items-center justify-center py-12 text-gray-400 dark:text-gray-500">Loading…</div>
      ) : rows.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 px-4 py-10 text-center text-gray-400 dark:text-gray-500">No trial balance data for this period.</div>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-gray-50 dark:bg-gray-800/60 border-b border-gray-300 dark:border-gray-600">
                <th className="px-2 py-1.5 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 w-24 border-r border-gray-200 dark:border-gray-700">Acct #</th>
                <th className="px-2 py-1.5 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 border-r border-gray-200 dark:border-gray-700">Account Name</th>
                <th className="px-2 py-1.5 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 w-16 border-r border-gray-200 dark:border-gray-700">WP Ref</th>
                {/* Prior Year */}
                <th colSpan={2} className="px-2 py-1 text-center text-xs font-semibold text-gray-500 dark:text-gray-400 border-r border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800/60">Prior Year</th>
                {/* Unadjusted */}
                <th colSpan={2} className="px-2 py-1 text-center text-xs font-semibold text-gray-600 dark:text-gray-300 border-r border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800">Unadjusted</th>
                {/* Book AJE */}
                <th colSpan={2} className="px-2 py-1 text-center text-xs font-semibold text-blue-700 dark:text-blue-400 border-r border-gray-300 dark:border-gray-600 bg-blue-50 dark:bg-blue-900/20">Book AJE</th>
                {/* Book Adjusted */}
                <th colSpan={2} className="px-2 py-1 text-center text-xs font-semibold text-blue-900 dark:text-blue-300 border-r border-gray-300 dark:border-gray-600 bg-blue-100 dark:bg-blue-900/40">Book Adjusted</th>
                {/* Tax AJE */}
                <th colSpan={2} className="px-2 py-1 text-center text-xs font-semibold text-purple-700 dark:text-purple-400 border-r border-gray-300 dark:border-gray-600 bg-purple-50 dark:bg-purple-900/20">Tax AJE</th>
                {/* Tax Adjusted */}
                <th colSpan={2} className="px-2 py-1 text-center text-xs font-semibold text-purple-900 dark:text-purple-300 border-r border-gray-300 dark:border-gray-600 bg-purple-100 dark:bg-purple-900/40">Tax Adjusted</th>
                {/* Variance */}
                <th colSpan={3} className="px-2 py-1 text-center text-xs font-semibold text-teal-700 dark:text-teal-400 bg-teal-50 dark:bg-teal-900/20">CY vs PY</th>
              </tr>
              <tr className="bg-gray-50 dark:bg-gray-800/60 border-b-2 border-gray-400 dark:border-gray-600">
                <th className="border-r border-gray-200 dark:border-gray-700" /><th className="border-r border-gray-200 dark:border-gray-700" /><th className="border-r border-gray-200 dark:border-gray-700" />
                <th className={`${thCls} bg-gray-50 dark:bg-gray-800/60`}>Dr</th><th className={`${thCls} bg-gray-50 dark:bg-gray-800/60 border-r border-gray-300 dark:border-gray-600`}>Cr</th>
                <th className={thCls}>Dr</th><th className={`${thCls} border-r border-gray-300 dark:border-gray-600`}>Cr</th>
                <th className={`${thCls} bg-blue-50 dark:bg-blue-900/20`}>Dr</th><th className={`${thCls} bg-blue-50 dark:bg-blue-900/20 border-r border-gray-300 dark:border-gray-600`}>Cr</th>
                <th className={`${thCls} bg-blue-100 dark:bg-blue-900/40`}>Dr</th><th className={`${thCls} bg-blue-100 dark:bg-blue-900/40 border-r border-gray-300 dark:border-gray-600`}>Cr</th>
                <th className={`${thCls} bg-purple-50 dark:bg-purple-900/20`}>Dr</th><th className={`${thCls} bg-purple-50 dark:bg-purple-900/20 border-r border-gray-300 dark:border-gray-600`}>Cr</th>
                <th className={`${thCls} bg-purple-100 dark:bg-purple-900/40`}>Dr</th><th className={`${thCls} bg-purple-100 dark:bg-purple-900/40 border-r border-gray-300 dark:border-gray-600`}>Cr</th>
                <th className={`${thCls} bg-teal-50 dark:bg-teal-900/20`}>PY Net</th>
                <th className={`${thCls} bg-teal-50 dark:bg-teal-900/20`}>CY Net</th>
                <th className={`${thCls} bg-teal-50 dark:bg-teal-900/20`}>Var %</th>
              </tr>
            </thead>
            <tbody>
              {CATEGORIES.map((cat) => {
                const catRows = rows.filter((r) => r.category === cat);
                if (catRows.length === 0) return null;
                const tot = sumRows(catRows);
                return (
                  <>
                    <tr key={`${cat}-hdr`} className="bg-gray-100 dark:bg-gray-700">
                      <td colSpan={18} className="px-2 py-1 text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wide">{CAT_LABEL[cat]}</td>
                    </tr>
                    {catRows.map((r) => {
                      const pyNet = netRow(r, 'prior_year_debit', 'prior_year_credit');
                      const cyNet = netRow(r, 'book_adjusted_debit', 'book_adjusted_credit');
                      const varAmt = cyNet - pyNet;
                      const varPct = pyNet !== 0 ? (varAmt / Math.abs(pyNet)) * 100 : null;
                      return (
                        <tr key={r.account_id} className="border-t border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50">
                          <td className="px-2 py-1 text-sm font-mono text-gray-600 dark:text-gray-400 border-r border-gray-200 dark:border-gray-700 whitespace-nowrap">{r.account_number}</td>
                          <td className="px-2 py-1 text-sm text-gray-700 dark:text-gray-300 border-r border-gray-200 dark:border-gray-700">
                            <span className="flex items-center gap-1 flex-wrap">
                              {r.account_name}
                              {(tbTickmarks?.[r.account_id] ?? []).map((tm) => (
                                <span key={tm.id} className={`inline-flex items-center justify-center w-4 h-4 rounded text-[10px] font-bold ${TICKMARK_COLOR_CLASSES[tm.color]}`} title={tm.description}>
                                  {tm.symbol}
                                </span>
                              ))}
                            </span>
                          </td>
                          <td className="px-2 py-1 text-xs text-gray-500 dark:text-gray-400 border-r border-gray-200 dark:border-gray-700">{r.workpaper_ref ?? ''}</td>
                          <td className={`${tdCls} bg-gray-50/50 dark:bg-gray-800/30 text-gray-500 dark:text-gray-400`}>{fmt(r.prior_year_debit)}</td>
                          <td className={`${tdCls} bg-gray-50/50 dark:bg-gray-800/30 text-gray-500 dark:text-gray-400 border-r border-gray-300 dark:border-gray-600`}>{fmt(r.prior_year_credit)}</td>
                          <td className={tdCls}>{fmt(r.unadjusted_debit)}</td>
                          <td className={`${tdCls} border-r border-gray-300 dark:border-gray-600`}>{fmt(r.unadjusted_credit)}</td>
                          <td className={`${tdCls} bg-blue-50/50 dark:bg-blue-900/10`}>{fmt(r.book_adj_debit)}</td>
                          <td className={`${tdCls} bg-blue-50/50 dark:bg-blue-900/10 border-r border-gray-300 dark:border-gray-600`}>{fmt(r.book_adj_credit)}</td>
                          <td className={`${tdCls} bg-blue-100/50 dark:bg-blue-900/20`}>{fmt(r.book_adjusted_debit)}</td>
                          <td className={`${tdCls} bg-blue-100/50 dark:bg-blue-900/20 border-r border-gray-300 dark:border-gray-600`}>{fmt(r.book_adjusted_credit)}</td>
                          <td className={`${tdCls} bg-purple-50/50 dark:bg-purple-900/10`}>{fmt(r.tax_adj_debit)}</td>
                          <td className={`${tdCls} bg-purple-50/50 dark:bg-purple-900/10 border-r border-gray-300 dark:border-gray-600`}>{fmt(r.tax_adj_credit)}</td>
                          <td className={`${tdCls} bg-purple-100/50 dark:bg-purple-900/20`}>{fmt(r.tax_adjusted_debit)}</td>
                          <td className={`${tdCls} bg-purple-100/50 dark:bg-purple-900/20 border-r border-gray-300 dark:border-gray-600`}>{fmt(r.tax_adjusted_credit)}</td>
                          <td className={`${tdCls} bg-teal-50/50 dark:bg-teal-900/10 text-gray-600 dark:text-gray-400`}>{fmtTotal(pyNet)}</td>
                          <td className={`${tdCls} bg-teal-50/50 dark:bg-teal-900/10 text-gray-700 dark:text-gray-300`}>{fmtTotal(cyNet)}</td>
                          <td className={`${tdCls} bg-teal-50/50 dark:bg-teal-900/10`}>{fmtPct(varPct)}</td>
                        </tr>
                      );
                    })}
                    <tr key={`${cat}-tot`} className="border-t border-gray-300 dark:border-gray-600">
                      <td className="px-2 py-1 border-r border-gray-200 dark:border-gray-700" /><td className={`${tdTotalCls} text-left`}>Total {CAT_LABEL[cat]}</td><td className="px-2 border-r border-gray-200 dark:border-gray-700 border-t border-gray-400 dark:border-gray-500 bg-gray-50 dark:bg-gray-800/60" />
                      <td className={`${tdTotalCls} bg-gray-50 dark:bg-gray-800/60 text-gray-500 dark:text-gray-400`}>{fmtTotal(tot.pyd)}</td><td className={`${tdTotalCls} bg-gray-50 dark:bg-gray-800/60 text-gray-500 dark:text-gray-400 border-r border-gray-300 dark:border-gray-600`}>{fmtTotal(tot.pyc)}</td>
                      <td className={tdTotalCls}>{fmtTotal(tot.ud)}</td><td className={`${tdTotalCls} border-r border-gray-300 dark:border-gray-600`}>{fmtTotal(tot.uc)}</td>
                      <td className={`${tdTotalCls} bg-blue-50 dark:bg-blue-900/20`}>{fmtTotal(tot.bad)}</td><td className={`${tdTotalCls} bg-blue-50 dark:bg-blue-900/20 border-r border-gray-300 dark:border-gray-600`}>{fmtTotal(tot.bac)}</td>
                      <td className={`${tdTotalCls} bg-blue-100 dark:bg-blue-900/40`}>{fmtTotal(tot.bd)}</td><td className={`${tdTotalCls} bg-blue-100 dark:bg-blue-900/40 border-r border-gray-300 dark:border-gray-600`}>{fmtTotal(tot.bc)}</td>
                      <td className={`${tdTotalCls} bg-purple-50 dark:bg-purple-900/20`}>{fmtTotal(tot.tad)}</td><td className={`${tdTotalCls} bg-purple-50 dark:bg-purple-900/20 border-r border-gray-300 dark:border-gray-600`}>{fmtTotal(tot.tac)}</td>
                      <td className={`${tdTotalCls} bg-purple-100 dark:bg-purple-900/40`}>{fmtTotal(tot.td)}</td><td className={`${tdTotalCls} bg-purple-100 dark:bg-purple-900/40 border-r border-gray-300 dark:border-gray-600`}>{fmtTotal(tot.tc)}</td>
                      <td colSpan={3} className={`${tdTotalCls} bg-teal-50 dark:bg-teal-900/20`}></td>
                    </tr>
                    <tr key={`${cat}-sp`}><td colSpan={18} className="py-1" /></tr>
                  </>
                );
              })}
              {/* Grand Total */}
              <tr>
                <td className="px-2 border-r border-gray-200 dark:border-gray-700" /><td className={`${tdGrandCls} text-left`}>Grand Total</td><td className="px-2 border-r border-gray-200 dark:border-gray-700 border-t-2 border-gray-700 dark:border-gray-500 bg-gray-100 dark:bg-gray-700" />
                <td className={`${tdGrandCls} bg-gray-50 dark:bg-gray-800/60 text-gray-500 dark:text-gray-400`}>{fmtTotal(grand.pyd)}</td><td className={`${tdGrandCls} bg-gray-50 dark:bg-gray-800/60 text-gray-500 dark:text-gray-400 border-r border-gray-300 dark:border-gray-600`}>{fmtTotal(grand.pyc)}</td>
                <td className={tdGrandCls}>{fmtTotal(grand.ud)}</td><td className={`${tdGrandCls} border-r border-gray-300 dark:border-gray-600`}>{fmtTotal(grand.uc)}</td>
                <td className={`${tdGrandCls} bg-blue-50 dark:bg-blue-900/20`}>{fmtTotal(grand.bad)}</td><td className={`${tdGrandCls} bg-blue-50 dark:bg-blue-900/20 border-r border-gray-300 dark:border-gray-600`}>{fmtTotal(grand.bac)}</td>
                <td className={`${tdGrandCls} bg-blue-100 dark:bg-blue-900/40`}>{fmtTotal(grand.bd)}</td><td className={`${tdGrandCls} bg-blue-100 dark:bg-blue-900/40 border-r border-gray-300 dark:border-gray-600`}>{fmtTotal(grand.bc)}</td>
                <td className={`${tdGrandCls} bg-purple-50 dark:bg-purple-900/20`}>{fmtTotal(grand.tad)}</td><td className={`${tdGrandCls} bg-purple-50 dark:bg-purple-900/20 border-r border-gray-300 dark:border-gray-600`}>{fmtTotal(grand.tac)}</td>
                <td className={`${tdGrandCls} bg-purple-100 dark:bg-purple-900/40`}>{fmtTotal(grand.td)}</td><td className={`${tdGrandCls} bg-purple-100 dark:bg-purple-900/40 border-r border-gray-300 dark:border-gray-600`}>{fmtTotal(grand.tc)}</td>
                <td colSpan={3} className={`${tdGrandCls} bg-teal-50 dark:bg-teal-900/20`}></td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {/* Tickmark legend */}
      {tbTickmarks && Object.keys(tbTickmarks).length > 0 && (() => {
        // Collect unique tickmarks across all accounts
        const seen = new Map<number, { symbol: string; description: string; color: string }>();
        for (const marks of Object.values(tbTickmarks)) {
          for (const m of marks) {
            if (!seen.has(m.id)) seen.set(m.id, m);
          }
        }
        const unique = Array.from(seen.values());
        if (unique.length === 0) return null;
        return (
          <div className="mt-4 border border-gray-200 dark:border-gray-700 rounded-lg px-4 py-3 bg-white dark:bg-gray-800">
            <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">Tickmark Legend</p>
            <div className="flex flex-wrap gap-3">
              {unique.map((tm) => (
                <div key={tm.symbol} className="flex items-center gap-1.5 text-sm text-gray-700 dark:text-gray-300">
                  <span className={`inline-flex items-center justify-center w-5 h-5 rounded text-xs font-bold ${TICKMARK_COLOR_CLASSES[tm.color as keyof typeof TICKMARK_COLOR_CLASSES]}`}>
                    {tm.symbol}
                  </span>
                  <span>{tm.description}</span>
                </div>
              ))}
            </div>
          </div>
        );
      })()}
    </div>
  );
}
