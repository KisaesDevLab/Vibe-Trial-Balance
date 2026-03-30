import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getTrialBalance, type TBRow } from '../api/trialBalance';
import { listTickmarks, getTBTickmarks, TICKMARK_COLOR_CLASSES, type Tickmark, type TBTickmarkMap } from '../api/tickmarks';
import { useUIStore, useAuthStore } from '../store/uiStore';
import { openPdfPreview, downloadPdf, pdfReports } from '../api/pdfReports';
import { downloadXlsxMultiSheet } from '../utils/downloadXlsx';

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
  const [pageBreakByGroup, setPageBreakByGroup] = useState(true);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);

  const handlePreview = async () => {
    if (!selectedPeriodId || !token) return;
    setPdfLoading(true);
    setPdfError(null);
    try {
      await openPdfPreview(pdfReports.workpaperIndex(selectedPeriodId) + `?preview=true&pageBreak=${pageBreakByGroup}`, token);
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
      await downloadPdf(pdfReports.workpaperIndex(selectedPeriodId) + `?pageBreak=${pageBreakByGroup}`, `workpaper-index-${selectedPeriodId}.pdf`, token);
    } catch (e) {
      setPdfError((e as Error).message);
    } finally {
      setPdfLoading(false);
    }
  };

  const { selectedClientId } = useUIStore();

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

  const { data: tickmarkLibrary } = useQuery({
    queryKey: ['tickmarks', selectedClientId],
    queryFn: async () => {
      if (!selectedClientId) return [] as Tickmark[];
      const res = await listTickmarks(selectedClientId);
      if (res.error) return [];
      return res.data ?? [];
    },
    enabled: !!selectedClientId,
  });

  const { data: tbTickmarks } = useQuery({
    queryKey: ['tb-tickmarks', selectedPeriodId],
    queryFn: async () => {
      if (!selectedPeriodId) return {} as TBTickmarkMap;
      const res = await getTBTickmarks(selectedPeriodId);
      if (res.error) return {};
      return res.data ?? {};
    },
    enabled: !!selectedPeriodId,
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

  const getMarksStr = (accountId: number) => {
    const marks = tbTickmarks?.[accountId] ?? [];
    return marks.map((m) => m.symbol).join(' ');
  };

  const handleExport = () => {
    const header = ['Account #', 'Account Name', 'Category', 'Tax Line', 'Book Adj Net', 'Tax Adj Net', 'Tickmarks', 'Preparer Notes', 'Reviewer Notes'];
    const sheets: Array<{ name: string; rows: string[][] }> = [];

    const buildGroupRows = (ref: string, refRows: TBRow[]): string[][] => {
      const sheetRows: string[][] = [];
      const sorted = [...refRows].sort((a, b) => a.account_number.localeCompare(b.account_number));
      for (const r of sorted) {
        sheetRows.push([r.account_number, r.account_name, r.category, r.tax_line ?? '', String(netBalance(r, 'book') / 100), String(netBalance(r, 'tax') / 100), getMarksStr(r.account_id), r.preparer_notes ?? '', r.reviewer_notes ?? '']);
      }
      const bookSub = refRows.reduce((s, r) => s + netBalance(r, 'book'), 0);
      const taxSub  = refRows.reduce((s, r) => s + netBalance(r, 'tax'), 0);
      sheetRows.push(['', `SUBTOTAL — ${ref}`, '', '', String(bookSub / 100), String(taxSub / 100), '', '', '']);
      return sheetRows;
    };

    if (pageBreakByGroup) {
      // Separate worksheet per WP ref
      for (const [ref, refRows] of sortedGroups) {
        const sheetRows: string[][] = [header, ...buildGroupRows(ref, refRows)];

        // Per-sheet tickmark legend
        const usedMarks = new Set<number>();
        for (const r of refRows) { for (const m of (tbTickmarks?.[r.account_id] ?? [])) usedMarks.add(m.id); }
        if (usedMarks.size > 0 && tickmarkLibrary) {
          sheetRows.push([]);
          sheetRows.push(['Tickmark Legend', '', '', '', '', '', '', '', '']);
          for (const tm of tickmarkLibrary.filter((t) => usedMarks.has(t.id))) {
            sheetRows.push([tm.symbol, tm.description, '', '', '', '', '', '', '']);
          }
        }

        const safeName = ref.replace(/[\\/*?[\]:]/g, '').slice(0, 31) || 'Sheet';
        sheets.push({ name: safeName, rows: sheetRows });
      }
    } else {
      // All on one sheet
      const allRows: string[][] = [header];
      const allUsedMarks = new Set<number>();
      for (const [ref, refRows] of sortedGroups) {
        allRows.push([`--- ${ref} ---`, '', '', '', '', '', '', '', '']);
        allRows.push(...buildGroupRows(ref, refRows));
        allRows.push([]);
        for (const r of refRows) { for (const m of (tbTickmarks?.[r.account_id] ?? [])) allUsedMarks.add(m.id); }
      }
      if (allUsedMarks.size > 0 && tickmarkLibrary) {
        allRows.push(['Tickmark Legend', '', '', '', '', '', '', '', '']);
        for (const tm of tickmarkLibrary.filter((t) => allUsedMarks.has(t.id))) {
          allRows.push([tm.symbol, tm.description, '', '', '', '', '', '', '']);
        }
      }
      sheets.push({ name: 'Workpaper Index', rows: allRows });
    }

    downloadXlsxMultiSheet(`workpaper-index-${selectedPeriodId}.xlsx`, sheets);
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
    <div className="p-6">
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
          <label className="flex items-center gap-1.5 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={pageBreakByGroup}
              onChange={(e) => setPageBreakByGroup(e.target.checked)}
              className="rounded border-gray-300 dark:border-gray-600 text-blue-600"
            />
            <span className="text-sm text-gray-600 dark:text-gray-400">Page per group</span>
          </label>
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
      <>
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
          <table className="w-full text-sm table-fixed">
            <colgroup>
              <col style={{ width: '7%' }} />   {/* Acct # */}
              <col style={{ width: '15%' }} />  {/* Account Name */}
              <col style={{ width: '6%' }} />   {/* Category */}
              <col style={{ width: '7%' }} />   {/* Tax Line */}
              {showBook && <col style={{ width: '9%' }} />}  {/* Book Adj */}
              {showTax  && <col style={{ width: '9%' }} />}  {/* Tax Adj */}
              <col style={{ width: '5%' }} />   {/* Marks */}
              <col style={{ width: '21%' }} />  {/* Preparer Notes */}
              <col style={{ width: '21%' }} />  {/* Reviewer Notes */}
            </colgroup>
            <thead className="sticky top-0 z-10 bg-gray-50 dark:bg-gray-800/60">
              <tr className="border-b border-gray-200 dark:border-gray-700">
                <th className="px-3 py-1.5 text-left text-xs font-semibold text-gray-500 dark:text-gray-400">Acct #</th>
                <th className="px-3 py-1.5 text-left text-xs font-semibold text-gray-500 dark:text-gray-400">Account Name</th>
                <th className="px-3 py-1.5 text-left text-xs font-semibold text-gray-500 dark:text-gray-400">Category</th>
                <th className="px-3 py-1.5 text-left text-xs font-semibold text-gray-500 dark:text-gray-400">Tax Line</th>
                {showBook && <th className="px-3 py-1.5 text-right text-xs font-semibold text-blue-700 dark:text-blue-400">Book Adj</th>}
                {showTax  && <th className="px-3 py-1.5 text-right text-xs font-semibold text-purple-700 dark:text-purple-400">Tax Adj</th>}
                <th className="px-3 py-1.5 text-left text-xs font-semibold text-gray-500 dark:text-gray-400">Marks</th>
                <th className="px-3 py-1.5 text-left text-xs font-semibold text-gray-500 dark:text-gray-400">Preparer Notes</th>
                <th className="px-3 py-1.5 text-left text-xs font-semibold text-gray-500 dark:text-gray-400">Reviewer Notes</th>
              </tr>
            </thead>
            <tbody>
              {sortedGroups.map(([ref, refRows]) => {
                const sorted = [...refRows].sort((a, b) => a.account_number.localeCompare(b.account_number));
                const bookSub = refRows.reduce((s, r) => s + netBalance(r, 'book'), 0);
                const taxSub  = refRows.reduce((s, r) => s + netBalance(r, 'tax'), 0);
                const isUnassigned = ref === 'Unassigned';
                const colCount = 7 + (showBook ? 1 : 0) + (showTax ? 1 : 0);
                return (
                  <React.Fragment key={ref}>
                    {/* Group header */}
                    <tr className={isUnassigned ? 'bg-gray-100 dark:bg-gray-700' : 'bg-amber-50 dark:bg-amber-900/20'}>
                      <td colSpan={colCount} className="px-3 py-2 border-t-2 border-gray-300 dark:border-gray-600">
                        <span className={`text-sm font-bold ${isUnassigned ? 'text-gray-400 dark:text-gray-500 italic' : 'text-amber-900 dark:text-amber-300'}`}>{ref}</span>
                      </td>
                    </tr>
                    {/* Account rows */}
                    {sorted.map((r, ri) => {
                      const marks = tbTickmarks?.[r.account_id] ?? [];
                      return (
                        <tr key={r.account_id} className={`${ri % 2 === 1 ? 'bg-gray-50/40 dark:bg-gray-700/20' : ''} hover:bg-blue-50/50 dark:hover:bg-blue-900/10`}>
                          <td className="px-3 py-1 text-sm font-mono text-gray-600 dark:text-gray-400 truncate">{r.account_number}</td>
                          <td className="px-3 py-1 text-sm text-gray-700 dark:text-gray-300 truncate">{r.account_name}</td>
                          <td className="px-3 py-1 text-xs text-gray-500 dark:text-gray-400 capitalize truncate">{r.category}</td>
                          <td className="px-3 py-1 text-xs text-gray-500 dark:text-gray-400 truncate">{r.tax_line ?? '—'}</td>
                          {showBook && <td className="px-3 py-1 text-right text-sm font-mono text-gray-700 dark:text-gray-300">{fmt(netBalance(r, 'book'))}</td>}
                          {showTax  && <td className="px-3 py-1 text-right text-sm font-mono text-gray-700 dark:text-gray-300">{fmt(netBalance(r, 'tax'))}</td>}
                          <td className="px-3 py-1">
                            {marks.length > 0 ? (
                              <span className="flex items-center gap-0.5">
                                {marks.map((m) => (
                                  <span key={m.id} className={`inline-flex items-center justify-center w-5 h-5 rounded text-[10px] font-bold ${TICKMARK_COLOR_CLASSES[m.color]}`}>{m.symbol}</span>
                                ))}
                              </span>
                            ) : <span className="text-gray-300 dark:text-gray-600 text-xs">—</span>}
                          </td>
                          <td className="px-3 py-1 text-xs text-gray-600 dark:text-gray-400 truncate" title={r.preparer_notes ?? undefined}>{r.preparer_notes || <span className="text-gray-300 dark:text-gray-600">—</span>}</td>
                          <td className="px-3 py-1 text-xs text-gray-600 dark:text-gray-400 truncate" title={r.reviewer_notes ?? undefined}>{r.reviewer_notes || <span className="text-gray-300 dark:text-gray-600">—</span>}</td>
                        </tr>
                      );
                    })}
                    {/* Subtotal */}
                    <tr className="border-t border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800/60">
                      <td colSpan={4} className="px-3 py-1.5 text-xs font-semibold text-gray-600 dark:text-gray-400 text-right">Subtotal — {ref}</td>
                      {showBook && <td className="px-3 py-1.5 text-right text-sm font-mono font-semibold text-blue-800 dark:text-blue-300 border-t border-blue-300 dark:border-blue-700">{fmt(bookSub)}</td>}
                      {showTax  && <td className="px-3 py-1.5 text-right text-sm font-mono font-semibold text-purple-800 dark:text-purple-300 border-t border-purple-300 dark:border-purple-700">{fmt(taxSub)}</td>}
                      <td colSpan={3} />
                    </tr>
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Tickmark Legend */}
        {tickmarkLibrary && tickmarkLibrary.length > 0 && Object.keys(tbTickmarks ?? {}).length > 0 && (
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden mt-4">
            <div className="px-4 py-2 border-b bg-gray-50 dark:bg-gray-800/60 border-gray-200 dark:border-gray-700">
              <span className="text-sm font-bold text-gray-700 dark:text-gray-300">Tickmark Legend</span>
            </div>
            <div className="px-4 py-3 grid grid-cols-2 gap-2">
              {tickmarkLibrary.map((tm) => (
                <div key={tm.id} className="flex items-center gap-2">
                  <span className={`inline-flex items-center justify-center w-6 h-6 rounded text-xs font-bold ${TICKMARK_COLOR_CLASSES[tm.color]}`}>{tm.symbol}</span>
                  <span className="text-sm text-gray-700 dark:text-gray-300">{tm.description}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </>
      )}
    </div>
  );
}
