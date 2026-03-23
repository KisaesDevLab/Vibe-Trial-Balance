import { useQuery } from '@tanstack/react-query';
import { listJournalEntries } from '../api/journalEntries';

type EntryType = 'trans' | 'book' | 'tax';

interface Props {
  periodId: number;
  accountId: number;
  accountNumber: string;
  accountName: string;
  entryType: EntryType;
  onClose: () => void;
}

const LABELS: Record<EntryType, { title: string; color: string }> = {
  trans: { title: 'Transaction JEs', color: 'text-teal-700 dark:text-teal-400' },
  book:  { title: 'Book AJEs',        color: 'text-blue-700 dark:text-blue-400' },
  tax:   { title: 'Tax AJEs',         color: 'text-purple-700 dark:text-purple-400' },
};

const fmt = (cents: number) => (cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function TransJEZoomModal({ periodId, accountId, accountNumber, accountName, entryType, onClose }: Props) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['journal-entries-zoom', periodId, accountId, entryType],
    queryFn: () => listJournalEntries(periodId, entryType, accountId),
  });

  const { title, color } = LABELS[entryType];
  const entries = data?.data ?? [];

  const rows = entries.flatMap((je) =>
    je.lines
      .filter((l) => l.account_id === accountId)
      .map((l) => ({ je, line: l })),
  );

  const totalDebit = rows.reduce((s, r) => s + r.line.debit, 0);
  const totalCredit = rows.reduce((s, r) => s + r.line.credit, 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div
        className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-2xl mx-4 flex flex-col max-h-[80vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between px-5 py-4 border-b border-gray-200 dark:border-gray-700">
          <div>
            <h2 className="text-base font-semibold text-gray-900 dark:text-white">
              {title} — {accountNumber} {accountName}
            </h2>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              {isLoading ? 'Loading…' : `${entries.length} entr${entries.length !== 1 ? 'ies' : 'y'}`}
            </p>
          </div>
          <button
            onClick={onClose}
            className="ml-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-xl leading-none"
          >
            ×
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-auto">
          {isLoading ? (
            <div className="p-8 text-center text-sm text-gray-400">Loading…</div>
          ) : error ? (
            <div className="p-8 text-center text-sm text-red-500">Error loading entries.</div>
          ) : rows.length === 0 ? (
            <div className="p-8 text-center text-sm text-gray-400">No {title.toLowerCase()} found for this account.</div>
          ) : (
            <table className="w-full text-sm border-collapse">
              <thead className="sticky top-0 bg-gray-50 dark:bg-gray-800/80 border-b border-gray-200 dark:border-gray-700">
                <tr>
                  <th className="text-left px-4 py-2 font-medium text-gray-600 dark:text-gray-400 w-28">Date</th>
                  <th className="text-left px-4 py-2 font-medium text-gray-600 dark:text-gray-400 w-16">Entry #</th>
                  <th className="text-left px-4 py-2 font-medium text-gray-600 dark:text-gray-400">Description</th>
                  <th className="text-right px-4 py-2 font-medium text-gray-600 dark:text-gray-400 w-28">Debit</th>
                  <th className="text-right px-4 py-2 font-medium text-gray-600 dark:text-gray-400 w-28">Credit</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(({ je, line }, i) => (
                  <tr
                    key={`${je.id}-${line.id}`}
                    className={`border-t border-gray-100 dark:border-gray-700 ${i % 2 === 1 ? 'bg-gray-50/50 dark:bg-gray-800/30' : ''}`}
                  >
                    <td className="px-4 py-1.5 text-gray-600 dark:text-gray-400 font-mono text-xs">
                      {je.entry_date ? je.entry_date.slice(0, 10) : '—'}
                    </td>
                    <td className="px-4 py-1.5 text-gray-500 dark:text-gray-400 text-xs font-mono">
                      {je.entry_number}
                    </td>
                    <td className="px-4 py-1.5 text-gray-800 dark:text-gray-200 truncate max-w-xs">
                      {je.description ?? <span className="text-gray-300 dark:text-gray-600">—</span>}
                    </td>
                    <td className={`px-4 py-1.5 text-right font-mono tabular-nums ${color}`}>
                      {line.debit > 0 ? fmt(line.debit) : <span className="text-gray-300 dark:text-gray-600">—</span>}
                    </td>
                    <td className={`px-4 py-1.5 text-right font-mono tabular-nums ${color}`}>
                      {line.credit > 0 ? fmt(line.credit) : <span className="text-gray-300 dark:text-gray-600">—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800/60 font-semibold">
                  <td colSpan={3} className="px-4 py-2 text-right text-xs text-gray-600 dark:text-gray-400">Total</td>
                  <td className={`px-4 py-2 text-right font-mono tabular-nums text-sm ${color}`}>
                    {totalDebit > 0 ? fmt(totalDebit) : <span className="text-gray-300 dark:text-gray-600">—</span>}
                  </td>
                  <td className={`px-4 py-2 text-right font-mono tabular-nums text-sm ${color}`}>
                    {totalCredit > 0 ? fmt(totalCredit) : <span className="text-gray-300 dark:text-gray-600">—</span>}
                  </td>
                </tr>
              </tfoot>
            </table>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-gray-200 dark:border-gray-700 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-700/50 dark:text-gray-300"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
