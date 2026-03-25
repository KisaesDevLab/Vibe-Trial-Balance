import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getTrialBalance, type TBRow } from '../api/trialBalance';
import { useUIStore, useAuthStore } from '../store/uiStore';
import { openPdfPreview, downloadPdf, pdfReports } from '../api/pdfReports';
import { downloadXlsx } from '../utils/downloadXlsx';

type ColSet = 'book' | 'tax' | 'both';

function netBalance(row: TBRow, colSet: 'book' | 'tax'): number {
  const dr = colSet === 'book' ? row.book_adjusted_debit : row.tax_adjusted_debit;
  const cr = colSet === 'book' ? row.book_adjusted_credit : row.tax_adjusted_credit;
  return row.normal_balance === 'debit' ? dr - cr : cr - dr;
}

function fmt(cents: number): string {
  if (cents === 0) return '—';
  const abs = Math.abs(cents);
  const str = (abs / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return cents < 0 ? `(${str})` : str;
}

export function WorkpaperIndexPage() {
  const { selectedPeriodId } = useUIStore();
  const token = useAuthStore((s) => s.token);
  const [colSet, setColSet] = useState<ColSet>('both');
  const [pdfLoading, setPdfLoading] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);

  const handlePreview = async () => {
    if (!selectedPeriodId || !token) return;
    setPdfLoading(true);
    setPdfError(null);
    try {
      await openPdfPreview(pdfReports.workpaperIndex(selectedPeriodId) + '?preview=true', token);
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
      await downloadPdf(pdfReports.workpaperIndex(selectedPeriodId), `workpaper-index-${selectedPeriodId}.pdf`, token);
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

  const rows = (data ?? []).filter((r) => r.is_active);

  // Group by workpaper_ref; null → 'Unassigned'
  const groups = new Map<string, TBRow[]>();
  for (const row of rows) {
    const key = row.workpaper_ref ?? 'Unassigned';
    const existing = groups.get(key) ?? [];
    existing.push(row);
    groups.set(key, existing);
  }

  const sortedGroups = [...groups.entries()].sort(([a], [b]) => {
    if (a === 'Unassigned') return 1;
    if (b === 'Unassigned') return -1;
    return a.localeCompare(b);
  });

  const showBook = colSet === 'book' || colSet === 'both';
  const showTax  = colSet === 'tax'  || colSet === 'both';

  const handleExport = () => {
    const header = ['WP Ref', 'Account #', 'Account Name', 'Category', 'Tax Line', 'Book Adj Net', 'Tax Adj Net'];
    const exportRows: string[][] = [];
    for (const [ref, refRows] of sortedGroups) {
      const sorted = [...refRows].sort((a, b) => a.account_number.localeCompare(b.account_number));
      for (const r of sorted) {
        exportRows.push([ref, r.account_number, r.account_name, r.category, r.tax_line ?? '', String(netBalance(r, 'book') / 100), String(netBalance(r, 'tax') / 100)]);
      }
      const bookSub = refRows.reduce((s, r) => s + netBalance(r, 'book'), 0);
      const taxSub  = refRows.reduce((s, r) => s + netBalance(r, 'tax'), 0);
      exportRows.push([ref, '', 'SUBTOTAL', '', '', String(bookSub / 100), String(taxSub / 100)]);
    }
    downloadXlsx(`workpaper-index-${selectedPeriodId}.xlsx`, [header, ...exportRows]);
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

  return (
    <div className="p-6 max-w-4xl">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Workpaper Reference Index</h2>
        <div className="flex items-center gap-2">
          <select
            value={colSet}
            onChange={(e) => setColSet(e.target.value as ColSet)}
            className="border border-gray-300 dark:border-gray-600 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
          >
            <option value="both">Book &amp; Tax</option>
            <option value="book">Book Adjusted</option>
            <option value="tax">Tax Adjusted</option>
          </select>
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
        <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 text-red-700 dark:text-red-400 text-sm px-3 py-2 rounded mt-2 mb-2">
          {pdfError}
        </div>
      )}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 text-red-700 dark:text-red-400 px-4 py-3 rounded text-sm mb-4">{(error as Error).message}</div>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center py-12 text-gray-400 dark:text-gray-500">Loading…</div>
      ) : rows.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 px-4 py-10 text-center text-gray-400 dark:text-gray-500">No trial balance data for this period.</div>
      ) : (
        <div className="space-y-4">
          {sortedGroups.map(([ref, refRows]) => {
            const sorted = [...refRows].sort((a, b) => a.account_number.localeCompare(b.account_number));
            const bookSub = refRows.reduce((s, r) => s + netBalance(r, 'book'), 0);
            const taxSub  = refRows.reduce((s, r) => s + netBalance(r, 'tax'), 0);
            const isUnassigned = ref === 'Unassigned';

            return (
              <div key={ref} className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
                {/* Group header */}
                <div className={`px-4 py-2 border-b flex items-center justify-between ${isUnassigned ? 'bg-gray-100 dark:bg-gray-700 border-gray-300 dark:border-gray-600' : 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-700'}`}>
                  <span className={`text-sm font-bold ${isUnassigned ? 'text-gray-400 dark:text-gray-500 italic' : 'text-amber-900 dark:text-amber-300'}`}>{ref}</span>
                  <div className="flex items-center gap-6">
                    {showBook && (
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        Book: <span className="font-mono font-semibold text-gray-800 dark:text-gray-200">{fmt(bookSub)}</span>
                      </span>
                    )}
                    {showTax && (
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        Tax: <span className="font-mono font-semibold text-gray-800 dark:text-gray-200">{fmt(taxSub)}</span>
                      </span>
                    )}
                  </div>
                </div>

                {/* Account rows */}
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 dark:bg-gray-800/60 border-b border-gray-100 dark:border-gray-700">
                      <th className="px-4 py-1.5 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 w-28">Acct #</th>
                      <th className="px-3 py-1.5 text-left text-xs font-semibold text-gray-500 dark:text-gray-400">Account Name</th>
                      <th className="px-3 py-1.5 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 w-24">Category</th>
                      <th className="px-3 py-1.5 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 w-28">Tax Line</th>
                      {showBook && <th className="px-4 py-1.5 text-right text-xs font-semibold text-blue-700 dark:text-blue-400 w-36">Book Adj</th>}
                      {showTax  && <th className="px-4 py-1.5 text-right text-xs font-semibold text-purple-700 dark:text-purple-400 w-36">Tax Adj</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                    {sorted.map((r) => (
                      <tr key={r.account_id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                        <td className="px-4 py-1.5 text-sm font-mono text-gray-600 dark:text-gray-400 whitespace-nowrap">{r.account_number}</td>
                        <td className="px-3 py-1.5 text-sm text-gray-700 dark:text-gray-300">{r.account_name}</td>
                        <td className="px-3 py-1.5 text-xs text-gray-500 dark:text-gray-400 capitalize">{r.category}</td>
                        <td className="px-3 py-1.5 text-xs text-gray-500 dark:text-gray-400">{r.tax_line ?? <span className="text-gray-300 dark:text-gray-600">—</span>}</td>
                        {showBook && <td className="px-4 py-1.5 text-right text-sm font-mono text-gray-700 dark:text-gray-300">{fmt(netBalance(r, 'book'))}</td>}
                        {showTax  && <td className="px-4 py-1.5 text-right text-sm font-mono text-gray-700 dark:text-gray-300">{fmt(netBalance(r, 'tax'))}</td>}
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800/60">
                      <td colSpan={showBook && showTax ? 4 : 4} className="px-4 py-1.5 text-xs font-semibold text-gray-600 dark:text-gray-400">Subtotal — {ref}</td>
                      {showBook && <td className="px-4 py-1.5 text-right text-sm font-mono font-semibold text-blue-800 dark:text-blue-300 border-t border-blue-300 dark:border-blue-700">{fmt(bookSub)}</td>}
                      {showTax  && <td className="px-4 py-1.5 text-right text-sm font-mono font-semibold text-purple-800 dark:text-purple-300 border-t border-purple-300 dark:border-purple-700">{fmt(taxSub)}</td>}
                    </tr>
                  </tfoot>
                </table>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
