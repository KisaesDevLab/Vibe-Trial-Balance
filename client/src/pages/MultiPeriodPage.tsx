import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useUIStore } from '../store/uiStore';
import { listPeriods, type Period } from '../api/periods';
import { getComparison, upsertComparisonNote, type ComparisonRow } from '../api/comparison';

// ─── helpers ────────────────────────────────────────────────────────────────

function fmtCents(v: number): string {
  if (v === 0) return '—';
  const abs = Math.abs(v);
  const s   = (abs / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return v < 0 ? `(${s})` : s;
}

function fmtPct(v: number | null): string {
  if (v === null) return 'New';
  if (v === 0)    return '—';
  return `${v >= 0 ? '+' : ''}${v.toFixed(1)}%`;
}

const CATEGORIES = ['assets', 'liabilities', 'equity', 'revenue', 'expenses'] as const;
const CAT_LABEL: Record<string, string> = {
  assets: 'Assets', liabilities: 'Liabilities', equity: 'Equity',
  revenue: 'Revenue', expenses: 'Expenses',
};

function catSubtotal(rows: ComparisonRow[], cat: string) {
  return rows
    .filter((r) => r.category === cat)
    .reduce(
      (acc, r) => ({
        current:  acc.current  + r.current_balance,
        compare:  acc.compare  + r.compare_balance,
        variance: acc.variance + r.variance_amount,
      }),
      { current: 0, compare: 0, variance: 0 },
    );
}

// ─── inline note cell ────────────────────────────────────────────────────────

function NoteCell({
  row, periodId, comparePeriodId,
}: { row: ComparisonRow; periodId: number; comparePeriodId: number }) {
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft]     = useState(row.note ?? '');

  const mutation = useMutation({
    mutationFn: (note: string) => upsertComparisonNote(periodId, comparePeriodId, row.account_id, note),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['comparison', periodId, comparePeriodId] }),
  });

  if (!editing) {
    return (
      <button
        onClick={() => { setDraft(row.note ?? ''); setEditing(true); }}
        className={`text-left text-xs w-full truncate ${row.note ? 'text-gray-700 dark:text-gray-300' : 'text-gray-300 dark:text-gray-600 italic'}`}
        title={row.note ?? 'Click to add note'}
      >
        {row.note || 'Add note…'}
      </button>
    );
  }

  return (
    <div className="flex items-center gap-1 min-w-0">
      <input
        autoFocus
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') { mutation.mutate(draft); setEditing(false); }
          if (e.key === 'Escape') setEditing(false);
        }}
        className="flex-1 text-xs border border-blue-300 dark:border-blue-500 rounded px-1.5 py-0.5 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
        placeholder="Variance explanation…"
      />
      <button
        onClick={() => { mutation.mutate(draft); setEditing(false); }}
        className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 shrink-0"
      >✓</button>
      <button
        onClick={() => setEditing(false)}
        className="text-xs text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-400 shrink-0"
      >✕</button>
    </div>
  );
}

// ─── main page ───────────────────────────────────────────────────────────────

export function MultiPeriodPage() {
  const { selectedClientId, selectedPeriodId } = useUIStore();
  const [comparePeriodId, setComparePeriodId]   = useState<number | ''>('');
  const [threshold, setThreshold]               = useState(10); // % significance threshold

  // All periods for this client (to populate the compare dropdown)
  const { data: periodsData } = useQuery({
    queryKey: ['periods', selectedClientId],
    queryFn: async () => {
      if (!selectedClientId) return [];
      const res = await listPeriods(selectedClientId);
      return res.data ?? [];
    },
    enabled: selectedClientId !== null,
  });
  const periods: Period[] = periodsData ?? [];
  const otherPeriods = periods.filter((p) => p.id !== selectedPeriodId);

  // Comparison data
  const { data: compData, isLoading, error } = useQuery({
    queryKey: ['comparison', selectedPeriodId, comparePeriodId],
    queryFn: async () => {
      const res = await getComparison(selectedPeriodId!, Number(comparePeriodId));
      if (res.error) throw new Error(res.error.message);
      return res.data!;
    },
    enabled: selectedPeriodId !== null && comparePeriodId !== '',
  });

  const rows = useMemo(() => compData?.rows ?? [], [compData]);

  // PDF download
  const pdfUrl = (preview: boolean) =>
    `/api/v1/reports/periods/${selectedPeriodId}/flux/${comparePeriodId}?preview=${preview ? 'true' : 'false'}`;

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
    <div className="p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Period Comparison</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Side-by-side variance analysis</p>
        </div>
        {compData && comparePeriodId !== '' && (
          <div className="flex items-center gap-2">
            <a
              href={pdfUrl(true)}
              target="_blank"
              rel="noreferrer"
              className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-700/50 dark:text-gray-300"
            >
              Preview PDF
            </a>
            <a
              href={pdfUrl(false)}
              download
              className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Download PDF
            </a>
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-4 py-3 flex items-center gap-6 flex-wrap">
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap">Compare to:</label>
          <select
            value={comparePeriodId}
            onChange={(e) => setComparePeriodId(e.target.value ? Number(e.target.value) : '')}
            className="border border-gray-300 dark:border-gray-600 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
          >
            <option value="">— select period —</option>
            {otherPeriods.map((p) => (
              <option key={p.id} value={p.id}>{p.period_name}</option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap">Flag variances &gt;</label>
          <input
            type="number"
            min={0}
            max={999}
            value={threshold}
            onChange={(e) => setThreshold(Math.max(0, Number(e.target.value)))}
            className="w-16 border border-gray-300 dark:border-gray-600 rounded px-2 py-1.5 text-sm text-center focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
          />
          <span className="text-sm text-gray-500 dark:text-gray-400">%</span>
        </div>
        {compData && (
          <div className="ml-auto text-sm text-gray-500 dark:text-gray-400">
            <span className="font-medium text-gray-900 dark:text-white">{compData.period.period_name}</span>
            {' vs. '}
            <span className="font-medium text-gray-900 dark:text-white">{compData.comparePeriod.period_name}</span>
          </div>
        )}
      </div>

      {/* Prompt */}
      {!comparePeriodId && (
        <div className="text-center py-12 text-gray-400 dark:text-gray-500">
          <p>Select a period above to compare.</p>
        </div>
      )}

      {/* Loading / error */}
      {isLoading && <div className="text-center py-10 text-gray-400 dark:text-gray-500">Loading…</div>}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 text-red-700 dark:text-red-400 px-4 py-3 rounded text-sm">
          {error instanceof Error ? error.message : 'Failed to load comparison.'}
        </div>
      )}

      {/* Comparison table */}
      {compData && rows.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/60">
                <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider w-20">Acct #</th>
                <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">Account Name</th>
                <th className="px-3 py-2.5 text-right text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider w-32">{compData.period.period_name}</th>
                <th className="px-3 py-2.5 text-right text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider w-32">{compData.comparePeriod.period_name}</th>
                <th className="px-3 py-2.5 text-right text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider w-28">$ Change</th>
                <th className="px-3 py-2.5 text-right text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider w-20">% Change</th>
                <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">Note</th>
              </tr>
            </thead>
            <tbody>
              {CATEGORIES.map((cat) => {
                const catRows = rows.filter((r) => r.category === cat);
                if (catRows.length === 0) return null;
                const sub = catSubtotal(rows, cat);
                const subPct = sub.compare !== 0
                  ? ((sub.variance / Math.abs(sub.compare)) * 100)
                  : null;

                return (
                  <>
                    {/* Category header */}
                    <tr key={`cat-${cat}`} className="bg-gray-50 dark:bg-gray-700 border-t border-gray-200 dark:border-gray-700">
                      <td colSpan={7} className="px-3 py-1.5">
                        <span className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                          {CAT_LABEL[cat]}
                        </span>
                      </td>
                    </tr>

                    {/* Account rows */}
                    {catRows.map((r, i) => {
                      const isSignificant =
                        r.variance_pct !== null
                          ? Math.abs(r.variance_pct) >= threshold && r.variance_amount !== 0
                          : r.current_balance !== 0;

                      return (
                        <tr
                          key={r.account_id}
                          className={`border-t border-gray-100 dark:border-gray-700 ${
                            isSignificant ? 'bg-amber-50 dark:bg-amber-900/10' : i % 2 === 0 ? 'bg-white dark:bg-gray-800' : 'bg-gray-50/40 dark:bg-gray-800/30'
                          }`}
                        >
                          <td className="px-3 py-1.5 font-mono text-sm text-gray-500 dark:text-gray-400">{r.account_number}</td>
                          <td className="px-3 py-1.5 text-gray-800 dark:text-gray-200">{r.account_name}</td>
                          <td className="px-3 py-1.5 text-right text-sm font-mono tabular-nums dark:text-gray-200">{fmtCents(r.current_balance)}</td>
                          <td className="px-3 py-1.5 text-right text-sm font-mono tabular-nums text-gray-500 dark:text-gray-400">{fmtCents(r.compare_balance)}</td>
                          <td className={`px-3 py-1.5 text-right text-sm font-mono tabular-nums ${
                            r.variance_amount > 0 ? 'text-green-700 dark:text-green-400' : r.variance_amount < 0 ? 'text-red-600 dark:text-red-400' : 'text-gray-400 dark:text-gray-500'
                          }`}>
                            {fmtCents(r.variance_amount)}
                          </td>
                          <td className={`px-3 py-1.5 text-right text-xs ${
                            isSignificant ? 'font-semibold text-amber-700 dark:text-amber-400' : 'text-gray-500 dark:text-gray-400'
                          }`}>
                            {fmtPct(r.variance_pct)}
                          </td>
                          <td className="px-3 py-1.5 min-w-[120px]">
                            <NoteCell
                              row={r}
                              periodId={selectedPeriodId!}
                              comparePeriodId={comparePeriodId as number}
                            />
                          </td>
                        </tr>
                      );
                    })}

                    {/* Category subtotal */}
                    <tr key={`sub-${cat}`} className="border-t border-gray-300 dark:border-gray-600 bg-gray-100/60 dark:bg-gray-700/40">
                      <td className="px-3 py-1.5" />
                      <td className="px-3 py-1.5 text-xs font-semibold text-gray-600 dark:text-gray-400 italic">Total {CAT_LABEL[cat]}</td>
                      <td className="px-3 py-1.5 text-right text-sm font-mono tabular-nums font-semibold dark:text-gray-200">{fmtCents(sub.current)}</td>
                      <td className="px-3 py-1.5 text-right text-sm font-mono tabular-nums font-semibold text-gray-500 dark:text-gray-400">{fmtCents(sub.compare)}</td>
                      <td className={`px-3 py-1.5 text-right text-sm font-mono tabular-nums font-semibold ${
                        sub.variance > 0 ? 'text-green-700 dark:text-green-400' : sub.variance < 0 ? 'text-red-600 dark:text-red-400' : 'text-gray-400 dark:text-gray-500'
                      }`}>
                        {fmtCents(sub.variance)}
                      </td>
                      <td className="px-3 py-1.5 text-right text-xs text-gray-500 dark:text-gray-400">
                        {subPct !== null ? `${subPct >= 0 ? '+' : ''}${subPct.toFixed(1)}%` : '—'}
                      </td>
                      <td />
                    </tr>
                  </>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {compData && rows.length === 0 && (
        <div className="text-center py-10 text-gray-400 dark:text-gray-500">No accounts found for this period.</div>
      )}

      {/* Legend */}
      {compData && rows.length > 0 && (
        <p className="text-xs text-gray-400 dark:text-gray-500">
          <span className="inline-block w-3 h-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded mr-1 align-middle" />
          Highlighted rows have variance &gt; {threshold}%
          &nbsp;·&nbsp; Click any Note cell to add an explanation.
        </p>
      )}
    </div>
  );
}
