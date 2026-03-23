import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getTrialBalance, type TBRow } from '../api/trialBalance';
import { useUIStore, useAuthStore } from '../store/uiStore';
import { openPdfPreview, downloadPdf, pdfReports } from '../api/pdfReports';
import { downloadXlsx } from '../utils/downloadXlsx';

type ColSet = 'book' | 'tax';

function netBalance(row: TBRow, colSet: ColSet): number {
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

export function TaxCodeReportPage() {
  const { selectedPeriodId } = useUIStore();
  const token = useAuthStore((s) => s.token);
  const [colSet, setColSet] = useState<ColSet>('tax');
  const [pdfLoading, setPdfLoading] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);

  const handlePreview = async () => {
    if (!selectedPeriodId || !token) return;
    setPdfLoading(true);
    setPdfError(null);
    try {
      await openPdfPreview(pdfReports.taxCodeReport(selectedPeriodId) + '?preview=true', token);
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
      await downloadPdf(pdfReports.taxCodeReport(selectedPeriodId), `tax-code-report-${selectedPeriodId}.pdf`, token);
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

  // Group by tax_line; null → 'Unassigned'
  const groups = new Map<string, TBRow[]>();
  for (const row of rows) {
    const key = row.tax_line ?? 'Unassigned';
    const existing = groups.get(key) ?? [];
    existing.push(row);
    groups.set(key, existing);
  }

  // Sort groups: assigned codes first (alpha), then Unassigned last
  const sortedGroups = [...groups.entries()].sort(([a], [b]) => {
    if (a === 'Unassigned') return 1;
    if (b === 'Unassigned') return -1;
    return a.localeCompare(b);
  });

  const grandTotal = rows.reduce((s, r) => s + netBalance(r, colSet), 0);

  const handleExport = () => {
    const header = ['Tax Code', 'Account #', 'Account Name', 'Category', `${colSet === 'book' ? 'Book' : 'Tax'} Adjusted Net`];
    const exportRows: string[][] = [];
    for (const [code, codeRows] of sortedGroups) {
      for (const r of codeRows) {
        exportRows.push([code, r.account_number, r.account_name, r.category, String(netBalance(r, colSet) / 100)]);
      }
      const subtotal = codeRows.reduce((s, r) => s + netBalance(r, colSet), 0);
      exportRows.push([code, '', 'SUBTOTAL', '', String(subtotal / 100)]);
    }
    exportRows.push(['', '', 'GRAND TOTAL', '', String(grandTotal / 100)]);
    downloadXlsx(`tax-code-report-${selectedPeriodId}.xlsx`, [header, ...exportRows]);
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
    <div className="p-6 max-w-3xl">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Tax Code Report</h2>
        <div className="flex items-center gap-2">
          <select
            value={colSet}
            onChange={(e) => setColSet(e.target.value as ColSet)}
            className="border border-gray-300 dark:border-gray-600 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
          >
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
      {error && <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 text-red-700 dark:text-red-400 px-4 py-3 rounded text-sm mb-4">{(error as Error).message}</div>}

      {isLoading ? (
        <div className="flex items-center justify-center py-12 text-gray-400 dark:text-gray-500">Loading…</div>
      ) : rows.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 px-4 py-10 text-center text-gray-400 dark:text-gray-500">No trial balance data for this period.</div>
      ) : (
        <div className="space-y-4">
          {sortedGroups.map(([code, codeRows]) => {
            const subtotal = codeRows.reduce((s, r) => s + netBalance(r, colSet), 0);
            const sorted = [...codeRows].sort((a, b) => a.account_number.localeCompare(b.account_number));
            return (
              <div key={code} className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
                <div className={`px-4 py-2 border-b flex items-center justify-between ${code === 'Unassigned' ? 'bg-gray-100 dark:bg-gray-700 border-gray-300 dark:border-gray-600' : 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-700'}`}>
                  <span className={`text-sm font-bold ${code === 'Unassigned' ? 'text-gray-500 dark:text-gray-400 italic' : 'text-blue-900 dark:text-blue-300'}`}>{code}</span>
                  <span className="text-sm font-mono font-semibold text-gray-800 dark:text-gray-200">{fmt(subtotal)}</span>
                </div>
                <table className="w-full text-sm">
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                    {sorted.map((r) => (
                      <tr key={r.account_id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                        <td className="px-4 py-1.5 text-sm font-mono text-gray-600 dark:text-gray-400 w-28 whitespace-nowrap">{r.account_number}</td>
                        <td className="px-3 py-1.5 text-sm text-gray-700 dark:text-gray-300 flex-1">{r.account_name}</td>
                        <td className="px-3 py-1.5 text-xs text-gray-400 dark:text-gray-500 w-24 capitalize">{r.category}</td>
                        <td className="px-4 py-1.5 text-sm font-mono text-right text-gray-700 dark:text-gray-300 w-36">{fmt(netBalance(r, colSet))}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800/60">
                      <td colSpan={3} className="px-4 py-1.5 text-xs font-semibold text-gray-600 dark:text-gray-400">Subtotal — {code}</td>
                      <td className="px-4 py-1.5 text-sm font-mono font-semibold text-right text-gray-800 dark:text-gray-200 border-t border-gray-400 dark:border-gray-500">{fmt(subtotal)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            );
          })}

          {/* Grand total */}
          <div className="bg-gray-100 dark:bg-gray-700 rounded-lg border-2 border-gray-700 dark:border-gray-500 px-4 py-3 flex items-center justify-between">
            <span className="text-sm font-bold text-gray-900 dark:text-white">Grand Total</span>
            <span className="text-sm font-mono font-bold text-gray-900 dark:text-white">{fmt(grandTotal)}</span>
          </div>
        </div>
      )}
    </div>
  );
}
