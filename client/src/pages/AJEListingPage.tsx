import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { listJournalEntries, type JournalEntry } from '../api/journalEntries';
import { useUIStore, useAuthStore } from '../store/uiStore';
import { openPdfPreview, downloadPdf, pdfReports } from '../api/pdfReports';

function fmt(cents: number): string {
  if (cents === 0) return '—';
  return (cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtDate(d: string): string {
  const s = d.slice(0, 10);
  const [y, m, day] = s.split('-');
  return `${m}/${day}/${y}`;
}

function downloadCsv(filename: string, rows: string[][]): void {
  const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\r\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

const TYPE_BADGE: Record<string, { label: string; cls: string }> = {
  book: { label: 'Book AJE', cls: 'bg-blue-100 text-blue-700' },
  tax:  { label: 'Tax AJE',  cls: 'bg-purple-100 text-purple-700' },
};

function EntryCard({ entry }: { entry: JournalEntry }) {
  const totalDebit  = entry.lines.reduce((s, l) => s + l.debit, 0);
  const totalCredit = entry.lines.reduce((s, l) => s + l.credit, 0);
  const badge = TYPE_BADGE[entry.entry_type] ?? { label: entry.entry_type.toUpperCase(), cls: 'bg-gray-100 text-gray-600' };

  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      {/* Entry header */}
      <div className="flex items-center gap-3 px-4 py-2.5 bg-gray-50 border-b border-gray-200">
        <span className={`inline-flex px-2 py-0.5 rounded text-xs font-semibold ${badge.cls}`}>
          {badge.label} #{entry.entry_number}
        </span>
        <span className="text-sm text-gray-500 whitespace-nowrap">{fmtDate(entry.entry_date)}</span>
        <span className="text-sm font-medium text-gray-700 flex-1 truncate">{entry.description ?? <span className="italic text-gray-400">No description</span>}</span>
        <span className="text-sm font-mono text-gray-600 whitespace-nowrap">{fmt(totalDebit)}</span>
      </div>

      {/* Lines */}
      <table className="w-full text-sm">
        <tbody className="divide-y divide-gray-100">
          {entry.lines.map((line, i) => (
            <tr key={i} className="hover:bg-gray-50">
              <td className="px-4 py-1.5 text-sm text-gray-600 w-28 whitespace-nowrap">{line.account_number}</td>
              <td className="px-3 py-1.5 text-sm text-gray-700">{line.account_name}</td>
              <td className="px-4 py-1.5 text-right text-sm font-mono text-gray-700 w-36">{line.debit > 0 ? fmt(line.debit) : ''}</td>
              <td className="px-4 py-1.5 text-right text-sm font-mono text-gray-700 w-36 pl-8">{line.credit > 0 ? fmt(line.credit) : ''}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t border-gray-300 bg-gray-50">
            <td colSpan={2} className="px-4 py-1.5 text-xs font-semibold text-gray-500">Total</td>
            <td className="px-4 py-1.5 text-right text-sm font-mono font-semibold text-gray-800 border-t border-gray-400">{fmt(totalDebit)}</td>
            <td className="px-4 py-1.5 text-right text-sm font-mono font-semibold text-gray-800 border-t border-gray-400 pl-8">{fmt(totalCredit)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

export function AJEListingPage() {
  const { selectedPeriodId } = useUIStore();
  const token = useAuthStore((s) => s.token);
  const [typeFilter, setTypeFilter] = useState<'all' | 'book' | 'tax'>('all');
  const [pdfLoading, setPdfLoading] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);

  const handlePreview = async () => {
    if (!selectedPeriodId || !token) return;
    setPdfLoading(true);
    setPdfError(null);
    try {
      await openPdfPreview(pdfReports.ajeListing(selectedPeriodId) + '?preview=true', token);
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
      await downloadPdf(pdfReports.ajeListing(selectedPeriodId), `aje-listing-${selectedPeriodId}.pdf`, token);
    } catch (e) {
      setPdfError((e as Error).message);
    } finally {
      setPdfLoading(false);
    }
  };

  const { data, isLoading, error } = useQuery({
    queryKey: ['journal-entries', selectedPeriodId, typeFilter],
    queryFn: async () => {
      if (!selectedPeriodId) return [];
      const res = await listJournalEntries(selectedPeriodId, typeFilter === 'all' ? undefined : typeFilter);
      if (res.error) throw new Error(res.error.message);
      // AJE listing only shows book and tax — never trans (those are auto-generated)
      return (res.data ?? []).filter((e) => e.entry_type !== 'trans');
    },
    enabled: selectedPeriodId !== null,
  });

  const entries = data ?? [];
  const bookCount = entries.filter((e) => e.entry_type === 'book').length;
  const taxCount  = entries.filter((e) => e.entry_type === 'tax').length;

  const totalDebit  = entries.reduce((s, e) => s + e.lines.reduce((ls, l) => ls + l.debit, 0), 0);
  const totalCredit = entries.reduce((s, e) => s + e.lines.reduce((ls, l) => ls + l.credit, 0), 0);

  const handleExport = () => {
    const header = ['Entry Type', 'Entry #', 'Date', 'Description', 'Account #', 'Account Name', 'Debit', 'Credit'];
    const rows: string[][] = [];
    for (const entry of entries) {
      for (const line of entry.lines) {
        rows.push([
          entry.entry_type,
          String(entry.entry_number),
          entry.entry_date.slice(0, 10),
          entry.description ?? '',
          line.account_number ?? '',
          line.account_name ?? '',
          line.debit > 0 ? String(line.debit / 100) : '',
          line.credit > 0 ? String(line.credit / 100) : '',
        ]);
      }
    }
    downloadCsv(`aje-listing-${selectedPeriodId}.csv`, [header, ...rows]);
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

  return (
    <div className="p-6 max-w-3xl">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Adjusting Journal Entries</h2>
          {!isLoading && (
            <p className="text-sm text-gray-500 mt-0.5">
              {bookCount} book · {taxCount} tax
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as typeof typeFilter)}
            className="border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All AJEs</option>
            <option value="book">Book AJE</option>
            <option value="tax">Tax AJE</option>
          </select>
          <button onClick={handleExport} disabled={!entries.length} className="px-3 py-1.5 text-sm border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-40">Export CSV</button>
          <button
            onClick={handlePreview}
            disabled={pdfLoading}
            className="px-3 py-1.5 text-sm border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50"
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
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2 rounded mt-2 mb-2">
          {pdfError}
        </div>
      )}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded text-sm mb-4">{(error as Error).message}</div>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center py-12 text-gray-400">Loading…</div>
      ) : entries.length === 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 px-4 py-10 text-center text-gray-400">
          No adjusting journal entries for this period.
        </div>
      ) : (
        <>
          <div className="space-y-3 mb-4">
            {entries.map((entry) => <EntryCard key={entry.id} entry={entry} />)}
          </div>

          {/* Grand total footer */}
          <div className="bg-gray-100 rounded-lg border-2 border-gray-700 overflow-hidden">
            <table className="w-full text-sm">
              <tbody>
                <tr>
                  <td className="px-4 py-2.5 text-sm font-bold text-gray-900">Total — {entries.length} entr{entries.length === 1 ? 'y' : 'ies'}</td>
                  <td className="px-4 py-2.5 text-right text-sm font-mono font-bold text-gray-900 w-36">{fmt(totalDebit)}</td>
                  <td className="px-4 py-2.5 text-right text-sm font-mono font-bold text-gray-900 w-36 pl-8">{fmt(totalCredit)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Account summary */}
          {(() => {
            // Build account summary
            const accountSummaryMap = new Map<string, { name: string; debit: number; credit: number }>();
            for (const entry of entries) {
              for (const line of entry.lines) {
                const key = line.account_number ?? 'Unknown';
                const existing = accountSummaryMap.get(key) ?? { name: line.account_name ?? '', debit: 0, credit: 0 };
                accountSummaryMap.set(key, {
                  name: existing.name || (line.account_name ?? ''),
                  debit: existing.debit + line.debit,
                  credit: existing.credit + line.credit,
                });
              }
            }
            const accountSummary = [...accountSummaryMap.entries()]
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([acct, vals]) => ({ account: acct, ...vals }));

            return accountSummary.length > 0 && (
              <div className="mt-6">
                <h3 className="text-sm font-semibold text-gray-700 mb-2">Summary by Account</h3>
                <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 w-28">Acct #</th>
                        <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500">Account Name</th>
                        <th className="px-4 py-2 text-right text-xs font-semibold text-gray-500 w-36">Total Dr</th>
                        <th className="px-4 py-2 text-right text-xs font-semibold text-gray-500 w-36">Total Cr</th>
                        <th className="px-4 py-2 text-right text-xs font-semibold text-gray-500 w-36">Net</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {accountSummary.map(({ account, name, debit, credit }) => {
                        const net = debit - credit;
                        return (
                          <tr key={account} className="hover:bg-gray-50">
                            <td className="px-4 py-1.5 text-sm text-gray-600 whitespace-nowrap">{account}</td>
                            <td className="px-3 py-1.5 text-sm text-gray-700">{name}</td>
                            <td className="px-4 py-1.5 text-right text-sm font-mono text-gray-700">{debit > 0 ? fmt(debit) : '—'}</td>
                            <td className="px-4 py-1.5 text-right text-sm font-mono text-gray-700">{credit > 0 ? fmt(credit) : '—'}</td>
                            <td className={`px-4 py-1.5 text-right text-sm font-mono font-semibold ${net > 0 ? 'text-gray-800' : net < 0 ? 'text-red-600' : 'text-gray-400'}`}>
                              {net !== 0 ? fmt(Math.abs(net)) + (net < 0 ? ' Cr' : ' Dr') : '—'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })()}
        </>
      )}
    </div>
  );
}
