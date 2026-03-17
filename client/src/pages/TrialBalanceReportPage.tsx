import { useQuery } from '@tanstack/react-query';
import { getTrialBalance, type TBRow } from '../api/trialBalance';
import { useUIStore } from '../store/uiStore';

function fmt(cents: number): string {
  if (cents === 0) return '—';
  return (cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtTotal(cents: number): string {
  return (cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function downloadCsv(filename: string, rows: string[][]): void {
  const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\r\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

const CATEGORIES = ['assets', 'liabilities', 'equity', 'revenue', 'expenses'] as const;
const CAT_LABEL: Record<string, string> = {
  assets: 'Assets', liabilities: 'Liabilities', equity: 'Equity',
  revenue: 'Revenue', expenses: 'Expenses',
};

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

const thCls = 'px-2 py-1.5 text-right text-xs font-semibold text-gray-600 border-r border-gray-200 last:border-r-0 whitespace-nowrap';
const tdCls = 'px-2 py-1 text-right text-sm font-mono text-gray-700 border-r border-gray-200 last:border-r-0';
const tdTotalCls = 'px-2 py-1.5 text-right text-sm font-mono font-semibold text-gray-800 border-r border-gray-200 last:border-r-0 border-t border-gray-400 bg-gray-50';
const tdGrandCls = 'px-2 py-2 text-right text-sm font-mono font-bold text-gray-900 border-r border-gray-200 last:border-r-0 border-t-2 border-gray-700 bg-gray-100';

export function TrialBalanceReportPage() {
  const { selectedPeriodId } = useUIStore();

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
    downloadCsv(`trial-balance-report-${selectedPeriodId}.csv`, [header, ...dataRows]);
  };

  if (!selectedPeriodId) {
    return (
      <div className="flex items-center justify-center h-full text-gray-400">
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
        <h2 className="text-xl font-semibold text-gray-900">Trial Balance Report</h2>
        <div className="flex items-center gap-2">
          <button onClick={handleExport} disabled={!rows.length} className="px-3 py-1.5 text-sm border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-40">Export CSV</button>
          <button onClick={() => window.print()} className="px-3 py-1.5 text-sm border border-gray-300 rounded hover:bg-gray-50">Print</button>
        </div>
      </div>

      {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded text-sm mb-4">{(error as Error).message}</div>}

      {isLoading ? (
        <div className="flex items-center justify-center py-12 text-gray-400">Loading…</div>
      ) : rows.length === 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 px-4 py-10 text-center text-gray-400">No trial balance data for this period.</div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-300">
                <th className="px-2 py-1.5 text-left text-xs font-semibold text-gray-600 w-24 border-r border-gray-200">Acct #</th>
                <th className="px-2 py-1.5 text-left text-xs font-semibold text-gray-600 border-r border-gray-200">Account Name</th>
                <th className="px-2 py-1.5 text-left text-xs font-semibold text-gray-600 w-16 border-r border-gray-200">WP Ref</th>
                {/* Prior Year */}
                <th colSpan={2} className="px-2 py-1 text-center text-xs font-semibold text-gray-500 border-r border-gray-300 bg-gray-50">Prior Year</th>
                {/* Unadjusted */}
                <th colSpan={2} className="px-2 py-1 text-center text-xs font-semibold text-gray-600 border-r border-gray-300 bg-white">Unadjusted</th>
                {/* Book AJE */}
                <th colSpan={2} className="px-2 py-1 text-center text-xs font-semibold text-blue-700 border-r border-gray-300 bg-blue-50">Book AJE</th>
                {/* Book Adjusted */}
                <th colSpan={2} className="px-2 py-1 text-center text-xs font-semibold text-blue-900 border-r border-gray-300 bg-blue-100">Book Adjusted</th>
                {/* Tax AJE */}
                <th colSpan={2} className="px-2 py-1 text-center text-xs font-semibold text-purple-700 border-r border-gray-300 bg-purple-50">Tax AJE</th>
                {/* Tax Adjusted */}
                <th colSpan={2} className="px-2 py-1 text-center text-xs font-semibold text-purple-900 bg-purple-100">Tax Adjusted</th>
              </tr>
              <tr className="bg-gray-50 border-b-2 border-gray-400">
                <th className="border-r border-gray-200" /><th className="border-r border-gray-200" /><th className="border-r border-gray-200" />
                <th className={`${thCls} bg-gray-50`}>Dr</th><th className={`${thCls} bg-gray-50 border-r border-gray-300`}>Cr</th>
                <th className={thCls}>Dr</th><th className={`${thCls} border-r border-gray-300`}>Cr</th>
                <th className={`${thCls} bg-blue-50`}>Dr</th><th className={`${thCls} bg-blue-50 border-r border-gray-300`}>Cr</th>
                <th className={`${thCls} bg-blue-100`}>Dr</th><th className={`${thCls} bg-blue-100 border-r border-gray-300`}>Cr</th>
                <th className={`${thCls} bg-purple-50`}>Dr</th><th className={`${thCls} bg-purple-50 border-r border-gray-300`}>Cr</th>
                <th className={`${thCls} bg-purple-100`}>Dr</th><th className={`${thCls} bg-purple-100`}>Cr</th>
              </tr>
            </thead>
            <tbody>
              {CATEGORIES.map((cat) => {
                const catRows = rows.filter((r) => r.category === cat);
                if (catRows.length === 0) return null;
                const tot = sumRows(catRows);
                return (
                  <>
                    <tr key={`${cat}-hdr`} className="bg-gray-100">
                      <td colSpan={15} className="px-2 py-1 text-xs font-bold text-gray-700 uppercase tracking-wide">{CAT_LABEL[cat]}</td>
                    </tr>
                    {catRows.map((r) => (
                      <tr key={r.account_id} className="border-t border-gray-100 hover:bg-gray-50">
                        <td className="px-2 py-1 text-sm text-gray-600 border-r border-gray-200 whitespace-nowrap">{r.account_number}</td>
                        <td className="px-2 py-1 text-sm text-gray-700 border-r border-gray-200">{r.account_name}</td>
                        <td className="px-2 py-1 text-xs text-gray-500 border-r border-gray-200">{r.workpaper_ref ?? ''}</td>
                        <td className={`${tdCls} bg-gray-50/50 text-gray-500`}>{fmt(r.prior_year_debit)}</td>
                        <td className={`${tdCls} bg-gray-50/50 text-gray-500 border-r border-gray-300`}>{fmt(r.prior_year_credit)}</td>
                        <td className={tdCls}>{fmt(r.unadjusted_debit)}</td>
                        <td className={`${tdCls} border-r border-gray-300`}>{fmt(r.unadjusted_credit)}</td>
                        <td className={`${tdCls} bg-blue-50/50`}>{fmt(r.book_adj_debit)}</td>
                        <td className={`${tdCls} bg-blue-50/50 border-r border-gray-300`}>{fmt(r.book_adj_credit)}</td>
                        <td className={`${tdCls} bg-blue-100/50`}>{fmt(r.book_adjusted_debit)}</td>
                        <td className={`${tdCls} bg-blue-100/50 border-r border-gray-300`}>{fmt(r.book_adjusted_credit)}</td>
                        <td className={`${tdCls} bg-purple-50/50`}>{fmt(r.tax_adj_debit)}</td>
                        <td className={`${tdCls} bg-purple-50/50 border-r border-gray-300`}>{fmt(r.tax_adj_credit)}</td>
                        <td className={`${tdCls} bg-purple-100/50`}>{fmt(r.tax_adjusted_debit)}</td>
                        <td className={`${tdCls} bg-purple-100/50`}>{fmt(r.tax_adjusted_credit)}</td>
                      </tr>
                    ))}
                    <tr key={`${cat}-tot`} className="border-t border-gray-300">
                      <td className="px-2 py-1 border-r border-gray-200" /><td className={`${tdTotalCls} text-left`}>Total {CAT_LABEL[cat]}</td><td className="px-2 border-r border-gray-200 border-t border-gray-400 bg-gray-50" />
                      <td className={`${tdTotalCls} bg-gray-50 text-gray-500`}>{fmtTotal(tot.pyd)}</td><td className={`${tdTotalCls} bg-gray-50 text-gray-500 border-r border-gray-300`}>{fmtTotal(tot.pyc)}</td>
                      <td className={tdTotalCls}>{fmtTotal(tot.ud)}</td><td className={`${tdTotalCls} border-r border-gray-300`}>{fmtTotal(tot.uc)}</td>
                      <td className={`${tdTotalCls} bg-blue-50`}>{fmtTotal(tot.bad)}</td><td className={`${tdTotalCls} bg-blue-50 border-r border-gray-300`}>{fmtTotal(tot.bac)}</td>
                      <td className={`${tdTotalCls} bg-blue-100`}>{fmtTotal(tot.bd)}</td><td className={`${tdTotalCls} bg-blue-100 border-r border-gray-300`}>{fmtTotal(tot.bc)}</td>
                      <td className={`${tdTotalCls} bg-purple-50`}>{fmtTotal(tot.tad)}</td><td className={`${tdTotalCls} bg-purple-50 border-r border-gray-300`}>{fmtTotal(tot.tac)}</td>
                      <td className={`${tdTotalCls} bg-purple-100`}>{fmtTotal(tot.td)}</td><td className={`${tdTotalCls} bg-purple-100`}>{fmtTotal(tot.tc)}</td>
                    </tr>
                    <tr key={`${cat}-sp`}><td colSpan={15} className="py-1" /></tr>
                  </>
                );
              })}
              {/* Grand Total */}
              <tr>
                <td className="px-2 border-r border-gray-200" /><td className={`${tdGrandCls} text-left`}>Grand Total</td><td className="px-2 border-r border-gray-200 border-t-2 border-gray-700 bg-gray-100" />
                <td className={`${tdGrandCls} bg-gray-50 text-gray-500`}>{fmtTotal(grand.pyd)}</td><td className={`${tdGrandCls} bg-gray-50 text-gray-500 border-r border-gray-300`}>{fmtTotal(grand.pyc)}</td>
                <td className={tdGrandCls}>{fmtTotal(grand.ud)}</td><td className={`${tdGrandCls} border-r border-gray-300`}>{fmtTotal(grand.uc)}</td>
                <td className={`${tdGrandCls} bg-blue-50`}>{fmtTotal(grand.bad)}</td><td className={`${tdGrandCls} bg-blue-50 border-r border-gray-300`}>{fmtTotal(grand.bac)}</td>
                <td className={`${tdGrandCls} bg-blue-100`}>{fmtTotal(grand.bd)}</td><td className={`${tdGrandCls} bg-blue-100 border-r border-gray-300`}>{fmtTotal(grand.bc)}</td>
                <td className={`${tdGrandCls} bg-purple-50`}>{fmtTotal(grand.tad)}</td><td className={`${tdGrandCls} bg-purple-50 border-r border-gray-300`}>{fmtTotal(grand.tac)}</td>
                <td className={`${tdGrandCls} bg-purple-100`}>{fmtTotal(grand.td)}</td><td className={`${tdGrandCls} bg-purple-100`}>{fmtTotal(grand.tc)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
