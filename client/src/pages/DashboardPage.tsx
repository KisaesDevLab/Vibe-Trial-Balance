import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getDashboard, type AuditEntry } from '../api/dashboard';
import { lockPeriod, unlockPeriod } from '../api/periods';
import { useUIStore } from '../store/uiStore';

function fmt(cents: number): string {
  return (Math.abs(cents) / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtDate(iso: string): string {
  const s = iso.slice(0, 10);
  const [y, m, d] = s.split('-');
  return `${m}/${d}/${y}`;
}

function fmtDatetime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) +
    ' ' + d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

const ACTION_BADGE: Record<string, { label: string; cls: string }> = {
  create:   { label: 'Created',    cls: 'bg-green-100 text-green-700' },
  update:   { label: 'Updated',    cls: 'bg-blue-100 text-blue-700' },
  delete:   { label: 'Deleted',    cls: 'bg-red-100 text-red-700' },
  lock:     { label: 'Locked',     cls: 'bg-amber-100 text-amber-700' },
  unlock:   { label: 'Unlocked',   cls: 'bg-gray-100 text-gray-600' },
  import:   { label: 'Imported',   cls: 'bg-indigo-100 text-indigo-700' },
  classify: { label: 'Classified', cls: 'bg-purple-100 text-purple-700' },
};

function AuditRow({ entry }: { entry: AuditEntry }) {
  const badge = ACTION_BADGE[entry.action] ?? { label: entry.action, cls: 'bg-gray-100 text-gray-600' };
  return (
    <tr className="hover:bg-gray-50">
      <td className="px-4 py-2 whitespace-nowrap">
        <span className={`inline-flex px-2 py-0.5 rounded text-xs font-semibold ${badge.cls}`}>{badge.label}</span>
      </td>
      <td className="px-3 py-2 text-sm text-gray-700">{entry.description ?? <span className="text-gray-400 italic">—</span>}</td>
      <td className="px-3 py-2 text-sm text-gray-500 whitespace-nowrap">{entry.user_name ?? '—'}</td>
      <td className="px-4 py-2 text-xs text-gray-400 whitespace-nowrap">{fmtDatetime(entry.created_at)}</td>
    </tr>
  );
}

export function DashboardPage() {
  const { selectedPeriodId } = useUIStore();
  const qc = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: ['dashboard', selectedPeriodId],
    queryFn: async () => {
      if (!selectedPeriodId) return null;
      const res = await getDashboard(selectedPeriodId);
      if (res.error) throw new Error(res.error.message);
      return res.data;
    },
    enabled: selectedPeriodId !== null,
    refetchInterval: 30_000, // refresh every 30s
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['dashboard', selectedPeriodId] });
    qc.invalidateQueries({ queryKey: ['periods'] });
  };

  const lockMutation = useMutation({
    mutationFn: () => lockPeriod(selectedPeriodId!),
    onSuccess: invalidate,
  });

  const unlockMutation = useMutation({
    mutationFn: () => unlockPeriod(selectedPeriodId!),
    onSuccess: invalidate,
  });

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

  if (isLoading) {
    return <div className="flex items-center justify-center py-12 text-gray-400">Loading…</div>;
  }

  if (error || !data) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded text-sm">
          {error instanceof Error ? error.message : 'Failed to load dashboard.'}
        </div>
      </div>
    );
  }

  const { period, stats, audit_log } = data;
  const isLocked = !!period.locked_at;
  const lockBusy = lockMutation.isPending || unlockMutation.isPending;

  const totalBt = stats.bank_transactions.unclassified + stats.bank_transactions.classified +
    stats.bank_transactions.confirmed + stats.bank_transactions.manual;
  const totalJe = stats.je.book + stats.je.tax + stats.je.trans;

  return (
    <div className="p-6 max-w-4xl space-y-6">
      {/* Period header */}
      <div className="bg-white rounded-lg border border-gray-200 px-5 py-4 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">{period.period_name}</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            {period.start_date ? fmtDate(period.start_date) : '—'}
            {' – '}
            {period.end_date ? fmtDate(period.end_date) : '—'}
            {period.is_current && (
              <span className="ml-2 inline-flex px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-700">Current</span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {isLocked ? (
            <>
              <div className="text-right">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-semibold bg-red-100 text-red-700">
                  <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" /></svg>
                  Locked
                </span>
                {period.locked_at && (
                  <p className="text-xs text-gray-400 mt-1 text-right">
                    {fmtDatetime(period.locked_at)}{period.locked_by_name ? ` by ${period.locked_by_name}` : ''}
                  </p>
                )}
              </div>
              <button
                onClick={() => unlockMutation.mutate()}
                disabled={lockBusy}
                className="px-3 py-1.5 text-sm border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-40"
              >
                {unlockMutation.isPending ? 'Unlocking…' : 'Unlock Period'}
              </button>
            </>
          ) : (
            <button
              onClick={() => { if (confirm('Lock this period? No changes can be made until it is unlocked.')) lockMutation.mutate(); }}
              disabled={lockBusy}
              className="px-3 py-1.5 text-sm bg-amber-600 text-white rounded hover:bg-amber-700 disabled:opacity-40"
            >
              {lockMutation.isPending ? 'Locking…' : 'Lock Period'}
            </button>
          )}
        </div>
      </div>

      {(lockMutation.error || unlockMutation.error) && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded text-sm">
          {((lockMutation.error || unlockMutation.error) as Error).message}
        </div>
      )}

      {/* Stats grid */}
      <div className="grid grid-cols-3 gap-4">
        {/* Journal Entries */}
        <div className="bg-white rounded-lg border border-gray-200 px-4 py-4">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Journal Entries</p>
          <div className="space-y-1.5">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Book AJEs</span>
              <span className="font-mono font-semibold text-blue-700">{stats.je.book}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Tax AJEs</span>
              <span className="font-mono font-semibold text-purple-700">{stats.je.tax}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Trans (auto)</span>
              <span className="font-mono font-semibold text-green-700">{stats.je.trans}</span>
            </div>
            <div className="flex justify-between text-sm border-t border-gray-100 pt-1.5 mt-1.5">
              <span className="text-gray-700 font-medium">Total</span>
              <span className="font-mono font-semibold text-gray-900">{totalJe}</span>
            </div>
          </div>
        </div>

        {/* Bank Transactions */}
        <div className="bg-white rounded-lg border border-gray-200 px-4 py-4">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Bank Transactions</p>
          <div className="space-y-1.5">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Unclassified</span>
              <span className={`font-mono font-semibold ${stats.bank_transactions.unclassified > 0 ? 'text-red-600' : 'text-gray-500'}`}>{stats.bank_transactions.unclassified}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Classified (AI)</span>
              <span className="font-mono font-semibold text-yellow-600">{stats.bank_transactions.classified}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Confirmed</span>
              <span className="font-mono font-semibold text-green-700">{stats.bank_transactions.confirmed}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Manual</span>
              <span className="font-mono font-semibold text-gray-600">{stats.bank_transactions.manual}</span>
            </div>
            <div className="flex justify-between text-sm border-t border-gray-100 pt-1.5 mt-1.5">
              <span className="text-gray-700 font-medium">Total</span>
              <span className="font-mono font-semibold text-gray-900">{totalBt}</span>
            </div>
          </div>
        </div>

        {/* TB Balance Check */}
        <div className="bg-white rounded-lg border border-gray-200 px-4 py-4">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Trial Balance (Book Adj)</p>
          <div className="space-y-1.5">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Total Debits</span>
              <span className="font-mono text-gray-700">{fmt(stats.trial_balance.total_debit)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Total Credits</span>
              <span className="font-mono text-gray-700">{fmt(stats.trial_balance.total_credit)}</span>
            </div>
            <div className="flex justify-between text-sm border-t border-gray-100 pt-1.5 mt-1.5">
              <span className="text-gray-700 font-medium">Status</span>
              {stats.trial_balance.is_balanced ? (
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-green-700">
                  <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/></svg>
                  Balanced
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-red-700">
                  <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd"/></svg>
                  Out of Balance
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
          <h3 className="text-sm font-semibold text-gray-700">Recent Activity</h3>
        </div>
        {audit_log.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm text-gray-400">No activity recorded for this period yet.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 w-28">Action</th>
                <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500">Description</th>
                <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 w-32">User</th>
                <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 w-44">Time</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {audit_log.map((entry) => <AuditRow key={entry.id} entry={entry} />)}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
