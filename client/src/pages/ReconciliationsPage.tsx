import { useState } from 'react';
import { evalAmountExpr } from '../utils/evalAmountExpr';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  listReconciliations,
  createReconciliation,
  getReconciliation,
  updateReconciliation,
  toggleReconciliationItem,
  completeReconciliation,
  deleteReconciliation,
  reopenReconciliation,
  type Reconciliation,
  type ReconciliationTransaction,
} from '../api/reconciliations';
import { listAccounts, type Account } from '../api/chartOfAccounts';
import { listPeriods } from '../api/periods';
import { useUIStore, useAuthStore } from '../store/uiStore';
import { DateInput } from '../components/DateInput';

function fmt(cents: number): string {
  const abs = Math.abs(cents);
  const s = (abs / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return cents < 0 ? `(${s})` : s;
}

function parseCents(val: string): number {
  const evaled = evalAmountExpr(val);
  const n = parseFloat(evaled.replace(/[^0-9.-]/g, ''));
  return isNaN(n) ? 0 : Math.round(n * 100);
}

// ─── New Reconciliation Modal ─────────────────────────────────────────────────

function NewReconciliationModal({
  clientId,
  accounts,
  periodId,
  periods,
  onClose,
  onCreate,
}: {
  clientId: number;
  accounts: Account[];
  periodId: number | null;
  periods: Array<{ id: number; locked_at?: string | null }>;
  onClose: () => void;
  onCreate: (id: number) => void;
}) {
  const bankAccounts = accounts.filter((a) => a.category === 'assets');
  const [sourceAccountId, setSourceAccountId] = useState(bankAccounts[0]?.id ?? 0);
  const [statementDate, setStatementDate] = useState('');
  const [statementBalance, setStatementBalance] = useState('');
  const [beginningBalance, setBeginningBalance] = useState('0.00');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const selectedPeriod = periodId ? periods.find((p) => p.id === periodId) : null;
  const isPeriodLocked = !!selectedPeriod?.locked_at;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!sourceAccountId || !statementDate) { setError('Account and statement date are required.'); return; }
    setSaving(true);
    setError('');
    try {
      const res = await createReconciliation(clientId, {
        sourceAccountId,
        periodId: periodId ?? undefined,
        statementDate,
        statementEndingBalance: parseCents(statementBalance),
        beginningBookBalance: parseCents(beginningBalance),
        notes: notes || undefined,
      });
      if (res.error) { setError(res.error.message); setSaving(false); return; }
      onCreate(res.data.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed');
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-5 py-4 border-b dark:border-gray-700">
          <h2 className="text-base font-semibold dark:text-white">New Bank Reconciliation</h2>
          <button onClick={onClose} className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 text-xl leading-none">&times;</button>
        </div>
        <form onSubmit={handleSubmit} className="px-5 py-4 space-y-4">
          {isPeriodLocked && (
            <p className="text-sm text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-700 rounded px-3 py-2">
              This period is locked and cannot have new reconciliations added.
            </p>
          )}
          {error && <p className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 rounded px-3 py-2">{error}</p>}
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Bank Account</label>
            <select
              value={sourceAccountId}
              onChange={(e) => setSourceAccountId(Number(e.target.value))}
              className="w-full border border-gray-300 dark:border-gray-600 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
              required
            >
              <option value="">— select —</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>{a.account_number} — {a.account_name}</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Statement Date</label>
              <DateInput
                value={statementDate}
                onChange={(e) => setStatementDate(e.target.value)}
                required
                className="w-full border border-gray-300 dark:border-gray-600 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Statement Ending Balance</label>
              <input
                value={statementBalance}
                onChange={(e) => setStatementBalance(e.target.value)}
                placeholder="0.00"
                className="w-full border border-gray-300 dark:border-gray-600 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Beginning Book Balance</label>
              <input
                value={beginningBalance}
                onChange={(e) => setBeginningBalance(e.target.value)}
                placeholder="0.00"
                className="w-full border border-gray-300 dark:border-gray-600 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Notes (optional)</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="w-full border border-gray-300 dark:border-gray-600 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-700/50 dark:text-gray-300">Cancel</button>
            <button
              type="submit"
              disabled={saving || isPeriodLocked}
              title={isPeriodLocked ? 'Period is locked. Unlock it to add reconciliations.' : undefined}
              className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? 'Creating…' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Reconciliation Workspace ────────────────────────────────────────────────

function ReconciliationWorkspace({
  recId,
  onBack,
}: {
  recId: number;
  onBack: () => void;
}) {
  const qc = useQueryClient();
  const queryKey = ['reconciliation', recId];

  const { data, isLoading, error } = useQuery({
    queryKey,
    queryFn: async () => {
      const res = await getReconciliation(recId);
      if (res.error) throw new Error(res.error.message);
      return res.data;
    },
  });

  const [statementBalanceEdit, setStatementBalanceEdit] = useState<string | null>(null);
  const [completing, setCompleting] = useState(false);
  const [completeError, setCompleteError] = useState('');

  const toggleMutation = useMutation({
    mutationFn: (txnId: number) => toggleReconciliationItem(recId, txnId),
    onMutate: async (txnId) => {
      await qc.cancelQueries({ queryKey });
      const prev = qc.getQueryData<typeof data>(queryKey);
      qc.setQueryData<typeof data>(queryKey, (old) => {
        if (!old) return old;
        return {
          ...old,
          transactions: old.transactions.map((t) =>
            t.id === txnId ? { ...t, is_cleared: !t.is_cleared } : t,
          ),
        };
      });
      return { prev };
    },
    onError: (_e, _v, ctx) => { if (ctx?.prev) qc.setQueryData(queryKey, ctx.prev); },
    onSettled: () => qc.invalidateQueries({ queryKey }),
  });

  const updateMutation = useMutation({
    mutationFn: (cents: number) => updateReconciliation(recId, { statementEndingBalance: cents }),
    onSuccess: () => { setStatementBalanceEdit(null); qc.invalidateQueries({ queryKey }); },
  });

  async function handleComplete() {
    setCompleting(true);
    setCompleteError('');
    try {
      const res = await completeReconciliation(recId);
      if (res.error) { setCompleteError(res.error.message); return; }
      qc.invalidateQueries({ queryKey });
      qc.invalidateQueries({ queryKey: ['reconciliations'] });
    } catch (e) {
      setCompleteError(e instanceof Error ? e.message : 'Failed');
    } finally {
      setCompleting(false);
    }
  }

  if (isLoading) return <div className="flex-1 flex items-center justify-center text-gray-400 dark:text-gray-500">Loading…</div>;
  if (error || !data) return <div className="flex-1 flex items-center justify-center text-red-500 dark:text-red-400">{(error as Error)?.message ?? 'Not found'}</div>;

  const { reconciliation: rec, transactions } = data;
  const isCompleted = rec.status === 'completed';

  // Calculate running totals
  const clearedDebits  = transactions.filter((t) => t.is_cleared && t.amount < 0).reduce((s, t) => s + Math.abs(t.amount), 0);
  const clearedCredits = transactions.filter((t) => t.is_cleared && t.amount > 0).reduce((s, t) => s + t.amount, 0);
  const clearedNet     = rec.beginning_book_balance + clearedCredits - clearedDebits;
  const difference     = rec.statement_ending_balance - clearedNet;
  const isBalanced     = difference === 0;

  const cleared   = transactions.filter((t) => t.is_cleared);
  const uncleared = transactions.filter((t) => !t.is_cleared);

  return (
    <div className="flex flex-col h-screen">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shrink-0">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 text-sm">← Back</button>
          <div>
            <h3 className="font-semibold text-gray-900 dark:text-white text-sm">
              {rec.account_number} — {rec.account_name}
              <span className="ml-2 text-gray-400 dark:text-gray-500 font-normal">Statement: {rec.statement_date}</span>
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {isCompleted
                ? `Completed${rec.completed_at ? ' ' + rec.completed_at.slice(0, 10) : ''}`
                : `${transactions.filter((t) => t.is_cleared).length} of ${transactions.length} transactions cleared`}
            </p>
          </div>
        </div>
        {!isCompleted && (
          <div className="flex items-center gap-3">
            {completeError && <span className="text-xs text-red-600 dark:text-red-400">{completeError}</span>}
            <button
              onClick={handleComplete}
              disabled={!isBalanced || completing}
              title={!isBalanced ? `Difference: ${fmt(difference)}` : 'Mark reconciliation complete'}
              className="px-3 py-1.5 text-sm bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-40"
            >
              {completing ? 'Completing…' : 'Complete'}
            </button>
          </div>
        )}
        {isCompleted && (
          <span className="px-2 py-1 text-xs font-semibold bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400 rounded-full border border-green-200 dark:border-green-700">
            Reconciled
          </span>
        )}
      </div>

      {/* Summary bar */}
      <div className="flex items-center gap-6 px-4 py-2 bg-gray-50 dark:bg-gray-800/60 border-b border-gray-200 dark:border-gray-700 text-sm shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500 dark:text-gray-400">Statement Balance:</span>
          {statementBalanceEdit !== null && !isCompleted ? (
            <input
              autoFocus
              value={statementBalanceEdit}
              onChange={(e) => setStatementBalanceEdit(e.target.value)}
              onBlur={() => updateMutation.mutate(parseCents(statementBalanceEdit))}
              onKeyDown={(e) => { if (e.key === 'Enter') updateMutation.mutate(parseCents(statementBalanceEdit)); if (e.key === 'Escape') setStatementBalanceEdit(null); }}
              className="w-28 border border-blue-400 dark:border-blue-500 rounded px-1.5 py-0.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
            />
          ) : (
            <button
              onClick={() => !isCompleted && setStatementBalanceEdit((rec.statement_ending_balance / 100).toFixed(2))}
              className={`font-mono font-semibold ${isCompleted ? 'text-gray-700 dark:text-gray-300' : 'hover:underline cursor-pointer dark:text-gray-300'}`}
            >
              {fmt(rec.statement_ending_balance)}
            </button>
          )}
        </div>
        <div>
          <span className="text-xs text-gray-500 dark:text-gray-400">Book Balance (cleared): </span>
          <span className="font-mono font-semibold dark:text-gray-300">{fmt(clearedNet)}</span>
        </div>
        <div className={`font-mono font-semibold ${isBalanced ? 'text-green-700 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
          {isBalanced ? '✓ Balanced' : `Difference: ${fmt(difference)}`}
        </div>
        <div className="text-xs text-gray-400 dark:text-gray-500 ml-auto">
          Beg. balance: {fmt(rec.beginning_book_balance)}
          {' · '}Cleared deposits: {fmt(clearedCredits)}
          {' · '}Cleared withdrawals: ({fmt(clearedDebits)})
        </div>
      </div>

      {/* Two-panel transaction list */}
      <div className="flex flex-1 overflow-hidden">
        {/* Uncleared */}
        <div className="flex-1 overflow-auto border-r border-gray-200 dark:border-gray-700">
          <div className="sticky top-0 bg-amber-50 dark:bg-amber-900/20 border-b border-amber-200 dark:border-amber-700 px-3 py-2">
            <span className="text-xs font-semibold text-amber-700 dark:text-amber-400 uppercase tracking-wide">
              Outstanding ({uncleared.length})
            </span>
          </div>
          <TxnList txns={uncleared} onToggle={(id) => !isCompleted && toggleMutation.mutate(id)} isCompleted={isCompleted} />
        </div>
        {/* Cleared */}
        <div className="flex-1 overflow-auto">
          <div className="sticky top-0 bg-green-50 dark:bg-green-900/20 border-b border-green-200 dark:border-green-700 px-3 py-2">
            <span className="text-xs font-semibold text-green-700 dark:text-green-400 uppercase tracking-wide">
              Cleared ({cleared.length})
            </span>
          </div>
          <TxnList txns={cleared} onToggle={(id) => !isCompleted && toggleMutation.mutate(id)} isCompleted={isCompleted} />
        </div>
      </div>
    </div>
  );
}

function TxnList({
  txns,
  onToggle,
  isCompleted,
}: {
  txns: ReconciliationTransaction[];
  onToggle: (id: number) => void;
  isCompleted: boolean;
}) {
  if (txns.length === 0) {
    return <div className="px-4 py-6 text-center text-sm text-gray-400 dark:text-gray-500">None</div>;
  }
  return (
    <table className="w-full text-sm">
      <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
        {txns.map((t) => (
          <tr
            key={t.id}
            onClick={() => onToggle(t.id)}
            className={`cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors ${isCompleted ? 'cursor-default' : ''}`}
          >
            <td className="px-3 py-2 text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap w-24">
              {t.transaction_date.slice(0, 10)}
            </td>
            <td className="px-2 py-2 text-gray-700 dark:text-gray-300 text-xs">
              {t.description ?? '—'}
              {t.check_number ? <span className="ml-1 text-gray-400 dark:text-gray-500">#{t.check_number}</span> : null}
            </td>
            <td className={`px-3 py-2 text-right font-mono text-xs whitespace-nowrap ${t.amount < 0 ? 'text-red-600 dark:text-red-400' : 'text-gray-700 dark:text-gray-300'}`}>
              {fmt(t.amount)}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export function ReconciliationsPage() {
  const { selectedClientId, selectedPeriodId } = useUIStore();
  const isAdmin = useAuthStore((s) => s.user?.role === 'admin');
  const qc = useQueryClient();
  const [showNew, setShowNew] = useState(false);
  const [activeRecId, setActiveRecId] = useState<number | null>(null);
  const [reopenMessage, setReopenMessage] = useState<string | null>(null);

  const { data: accounts } = useQuery({
    queryKey: ['accounts', selectedClientId],
    queryFn: async () => {
      const res = await listAccounts(selectedClientId!);
      return res.data ?? [];
    },
    enabled: selectedClientId !== null,
  });

  const { data: periods } = useQuery({
    queryKey: ['periods', selectedClientId],
    queryFn: async () => {
      const res = await listPeriods(selectedClientId!);
      return res.data ?? [];
    },
    enabled: selectedClientId !== null,
  });

  const listQueryKey = ['reconciliations', selectedClientId];
  const { data: recs, isLoading, error } = useQuery({
    queryKey: listQueryKey,
    queryFn: async () => {
      const res = await listReconciliations(selectedClientId!);
      if (res.error) throw new Error(res.error.message);
      return res.data ?? [];
    },
    enabled: selectedClientId !== null,
  });

  const deleteMutation = useMutation({
    mutationFn: deleteReconciliation,
    onSuccess: () => qc.invalidateQueries({ queryKey: listQueryKey }),
  });

  const reopenMutation = useMutation({
    mutationFn: reopenReconciliation,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['reconciliations', selectedClientId] });
      setReopenMessage('Reconciliation reopened successfully.');
      setTimeout(() => setReopenMessage(null), 4000);
    },
  });

  if (!selectedClientId) {
    return (
      <div className="flex items-center justify-center h-screen text-gray-400 dark:text-gray-400">
        <div className="text-center">
          <p className="text-lg font-medium">No client selected</p>
          <p className="text-sm mt-1">Choose a client from the sidebar.</p>
        </div>
      </div>
    );
  }

  if (activeRecId !== null) {
    return (
      <ReconciliationWorkspace
        key={activeRecId}
        recId={activeRecId}
        onBack={() => { setActiveRecId(null); qc.invalidateQueries({ queryKey: listQueryKey }); }}
      />
    );
  }

  const accountMap = new Map((accounts ?? []).map((a) => [a.id, a]));
  const periodMap  = new Map((periods ?? []).map((p) => [p.id, p]));

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Bank Reconciliations</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{recs?.length ?? 0} reconciliation{(recs?.length ?? 0) !== 1 ? 's' : ''}</p>
        </div>
        <button
          onClick={() => setShowNew(true)}
          className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
        >
          + New Reconciliation
        </button>
      </div>

      {error && <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 text-red-700 dark:text-red-400 px-4 py-3 rounded text-sm mb-4">{(error as Error).message}</div>}
      {reopenMessage && <div className="bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-700 text-green-700 dark:text-green-400 px-4 py-3 rounded text-sm mb-4">{reopenMessage}</div>}
      {reopenMutation.isError && <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 text-red-700 dark:text-red-400 px-4 py-3 rounded text-sm mb-4">{(reopenMutation.error as Error)?.message ?? 'Failed to reopen reconciliation.'}</div>}

      {isLoading ? (
        <div className="flex items-center justify-center py-12 text-gray-400 dark:text-gray-400">Loading…</div>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/60">
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">Account</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">Statement Date</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">Period</th>
                <th className="px-4 py-2.5 text-right text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">Stmt Balance</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">Status</th>
                <th className="px-4 py-2.5"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {(!recs || recs.length === 0) ? (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-gray-400 dark:text-gray-500">
                    No reconciliations yet. Click &ldquo;+ New Reconciliation&rdquo; to start.
                  </td>
                </tr>
              ) : (
                recs.map((r: Reconciliation) => {
                  const acct = accountMap.get(r.source_account_id);
                  const per  = r.period_id ? periodMap.get(r.period_id) : null;
                  return (
                    <tr key={r.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                      <td className="px-4 py-2.5">
                        <span className="font-mono font-medium text-gray-900 dark:text-white">{r.account_number ?? acct?.account_number}</span>
                        <span className="ml-2 text-gray-500 dark:text-gray-400">{r.account_name ?? acct?.account_name}</span>
                      </td>
                      <td className="px-4 py-2.5 text-gray-600 dark:text-gray-400">{r.statement_date}</td>
                      <td className="px-4 py-2.5 text-gray-500 dark:text-gray-400 text-xs">{per?.period_name ?? '—'}</td>
                      <td className="px-4 py-2.5 text-right text-sm font-mono text-gray-700 dark:text-gray-300">{fmt(r.statement_ending_balance)}</td>
                      <td className="px-4 py-2.5">
                        {r.status === 'completed' ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400 border border-green-200 dark:border-green-700">
                            Reconciled
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-700">
                            Open
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        {isAdmin && r.status === 'completed' && (
                          <button
                            onClick={() => { if (confirm(`Reopen "${r.account_name}" reconciliation dated ${r.statement_date}?`)) reopenMutation.mutate(r.id); }}
                            disabled={reopenMutation.isPending}
                            className="text-xs text-amber-600 hover:text-amber-800 dark:text-amber-400 dark:hover:text-amber-300 mr-2 disabled:opacity-50"
                          >
                            {reopenMutation.isPending ? 'Reopening…' : 'Reopen'}
                          </button>
                        )}
                        <button
                          onClick={() => setActiveRecId(r.id)}
                          className="text-xs text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 mr-3"
                        >
                          {r.status === 'open' ? 'Work' : 'View'}
                        </button>
                        {r.status === 'open' && (
                          <button
                            onClick={() => { if (confirm('Delete this reconciliation?')) deleteMutation.mutate(r.id); }}
                            className="text-xs text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                          >
                            Delete
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}

      {showNew && (
        <NewReconciliationModal
          clientId={selectedClientId}
          accounts={accounts ?? []}
          periodId={selectedPeriodId}
          periods={periods ?? []}
          onClose={() => setShowNew(false)}
          onCreate={(id) => { setShowNew(false); setActiveRecId(id); }}
        />
      )}
    </div>
  );
}
