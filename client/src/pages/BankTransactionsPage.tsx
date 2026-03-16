import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  listBankTransactions,
  importBankTransactions,
  classifyTransaction,
  deleteBankTransaction,
  aiClassifyTransactions,
  listClassificationRules,
  deleteClassificationRule,
  type BankTransaction,
  type ClassificationStatus,
} from '../api/bankTransactions';
import { listAccounts, type Account } from '../api/chartOfAccounts';
import { useUIStore } from '../store/uiStore';

function fmt(cents: number): string {
  const abs = Math.abs(cents);
  const str = (abs / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return cents < 0 ? `(${str})` : str;
}

function fmtDate(d: string): string {
  return d.slice(0, 10);
}

const STATUS_LABEL: Record<ClassificationStatus, string> = {
  unclassified: 'Unclassified',
  ai_suggested: 'AI Suggested',
  confirmed: 'Confirmed',
  manual: 'Manual',
};

const STATUS_CLASS: Record<ClassificationStatus, string> = {
  unclassified: 'bg-gray-100 text-gray-600',
  ai_suggested: 'bg-purple-100 text-purple-700',
  confirmed: 'bg-green-100 text-green-700',
  manual: 'bg-blue-100 text-blue-700',
};

function StatusBadge({ status }: { status: ClassificationStatus }) {
  return (
    <span className={`inline-flex px-1.5 py-0.5 rounded text-xs font-medium ${STATUS_CLASS[status]}`}>
      {STATUS_LABEL[status]}
    </span>
  );
}

export function BankTransactionsPage() {
  const { selectedClientId, selectedPeriodId } = useUIStore();
  const qc = useQueryClient();

  const [filterStatus, setFilterStatus] = useState<string>('');
  const [filterPeriod, setFilterPeriod] = useState(false);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [showImport, setShowImport] = useState(false);
  const [showRules, setShowRules] = useState(false);
  const [aiStatus, setAiStatus] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importError, setImportError] = useState<string | null>(null);

  const clientId = selectedClientId;
  const txQueryKey = ['bank-transactions', clientId, filterStatus, filterPeriod ? selectedPeriodId : null];

  const { data: txData, isLoading } = useQuery({
    queryKey: txQueryKey,
    queryFn: async () => {
      if (!clientId) return [];
      const res = await listBankTransactions(clientId, {
        status: filterStatus || undefined,
        periodId: filterPeriod && selectedPeriodId ? selectedPeriodId : undefined,
      });
      if (res.error) throw new Error(res.error.message);
      return res.data ?? [];
    },
    enabled: clientId !== null,
  });

  const { data: accountsData } = useQuery({
    queryKey: ['chart-of-accounts', clientId],
    queryFn: async () => {
      if (!clientId) return [];
      const res = await listAccounts(clientId);
      if (res.error) throw new Error(res.error.message);
      return res.data ?? [];
    },
    enabled: clientId !== null,
  });

  const { data: rulesData } = useQuery({
    queryKey: ['classification-rules', clientId],
    queryFn: async () => {
      if (!clientId) return [];
      const res = await listClassificationRules(clientId);
      if (res.error) throw new Error(res.error.message);
      return res.data ?? [];
    },
    enabled: clientId !== null && showRules,
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ['bank-transactions', clientId] });

  const importMutation = useMutation({
    mutationFn: ({ file, periodId }: { file: File; periodId?: number }) =>
      importBankTransactions(clientId!, file, periodId),
    onSuccess: (res) => {
      if (res.error) { setImportError(res.error.message); return; }
      invalidate();
      setShowImport(false);
      setImportFile(null);
      setImportError(null);
    },
  });

  const classifyMutation = useMutation({
    mutationFn: ({ id, accountId }: { id: number; accountId: number }) =>
      classifyTransaction(clientId!, id, { accountId, classificationStatus: 'manual' }),
    onSuccess: () => invalidate(),
  });

  const confirmMutation = useMutation({
    mutationFn: (tx: BankTransaction) =>
      classifyTransaction(clientId!, tx.id, {
        accountId: tx.ai_suggested_account_id ?? tx.account_id,
        classificationStatus: 'confirmed',
      }),
    onSuccess: () => invalidate(),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteBankTransaction(clientId!, id),
    onSuccess: () => { invalidate(); setSelected((prev) => { const next = new Set(prev); return next; }); },
  });

  const aiMutation = useMutation({
    mutationFn: (ids: number[]) => aiClassifyTransactions(clientId!, ids),
    onMutate: () => setAiStatus('Running AI classification…'),
    onSuccess: (res) => {
      if (res.error) { setAiStatus(`Error: ${res.error.message}`); return; }
      invalidate();
      setAiStatus(`AI classified ${res.data?.classified ?? 0} transaction(s).`);
      setSelected(new Set());
    },
  });

  const deleteRuleMutation = useMutation({
    mutationFn: (id: number) => deleteClassificationRule(clientId!, id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['classification-rules', clientId] }),
  });

  const accounts: Account[] = accountsData ?? [];
  const transactions: BankTransaction[] = txData ?? [];

  const allIds = transactions.map((t) => t.id);
  const allSelected = allIds.length > 0 && allIds.every((id) => selected.has(id));
  const toggleAll = () => setSelected(allSelected ? new Set() : new Set(allIds));
  const toggleOne = (id: number) =>
    setSelected((prev) => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; });

  const unclassifiedCount = transactions.filter((t) => t.classification_status === 'unclassified').length;
  const aiSuggestedCount = transactions.filter((t) => t.classification_status === 'ai_suggested').length;

  if (!clientId) {
    return (
      <div className="flex items-center justify-center h-full text-gray-400">
        <div className="text-center">
          <p className="text-lg font-medium">No client selected</p>
          <p className="text-sm mt-1">Choose a client from the sidebar.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Bank Transactions</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            {transactions.length} total · {unclassifiedCount} unclassified · {aiSuggestedCount} AI suggested
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowRules(!showRules)}
            className="px-3 py-1.5 text-sm border border-gray-300 rounded hover:bg-gray-50"
          >
            Rules {rulesData ? `(${rulesData.length})` : ''}
          </button>
          <button
            onClick={() => { setShowImport(true); setImportError(null); }}
            className="px-3 py-1.5 text-sm border border-gray-300 rounded hover:bg-gray-50"
          >
            Import CSV
          </button>
          {selected.size > 0 && (
            <button
              onClick={() => aiMutation.mutate([...selected])}
              disabled={aiMutation.isPending}
              className="px-3 py-1.5 text-sm bg-purple-600 text-white rounded hover:bg-purple-700 disabled:opacity-50"
            >
              {aiMutation.isPending ? 'Classifying…' : `AI Classify (${selected.size})`}
            </button>
          )}
        </div>
      </div>

      {/* AI status */}
      {aiStatus && (
        <div className="mb-3 text-sm text-purple-700 bg-purple-50 border border-purple-200 rounded px-3 py-2 flex justify-between">
          <span>{aiStatus}</span>
          <button onClick={() => setAiStatus(null)} className="text-purple-400 hover:text-purple-600">&times;</button>
        </div>
      )}

      {/* Filters */}
      <div className="flex items-center gap-3 mb-3">
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">All statuses</option>
          <option value="unclassified">Unclassified</option>
          <option value="ai_suggested">AI Suggested</option>
          <option value="confirmed">Confirmed</option>
          <option value="manual">Manual</option>
        </select>
        {selectedPeriodId && (
          <label className="flex items-center gap-1.5 text-sm text-gray-600 cursor-pointer">
            <input
              type="checkbox"
              checked={filterPeriod}
              onChange={(e) => setFilterPeriod(e.target.checked)}
              className="rounded border-gray-300"
            />
            Current period only
          </label>
        )}
      </div>

      {/* Classification Rules panel */}
      {showRules && (
        <div className="mb-4 bg-white rounded-lg border border-gray-200 overflow-hidden">
          <div className="px-4 py-2 border-b border-gray-100 bg-gray-50 flex justify-between items-center">
            <span className="text-sm font-medium text-gray-700">Classification Rules</span>
            <button onClick={() => setShowRules(false)} className="text-gray-400 hover:text-gray-600 text-lg leading-none">&times;</button>
          </div>
          {!rulesData || rulesData.length === 0 ? (
            <div className="px-4 py-4 text-sm text-gray-400">No rules yet. Rules are created automatically when you confirm or manually classify transactions.</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600">Payee Pattern</th>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600">Account</th>
                  <th className="px-4 py-2 text-right text-xs font-semibold text-gray-600">Confirmed</th>
                  <th className="w-12"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {rulesData.map((r) => (
                  <tr key={r.id} className="hover:bg-gray-50">
                    <td className="px-4 py-2 text-gray-700">{r.payee_pattern}</td>
                    <td className="px-4 py-2 text-gray-700">{r.account_number} – {r.account_name}</td>
                    <td className="px-4 py-2 text-right text-gray-500">{r.times_confirmed}×</td>
                    <td className="px-2 py-2 text-center">
                      <button
                        onClick={() => { if (confirm('Delete this rule?')) deleteRuleMutation.mutate(r.id); }}
                        className="text-xs text-red-400 hover:text-red-600"
                      >Del</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Transaction table */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12 text-gray-400">Loading…</div>
      ) : transactions.length === 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 px-4 py-10 text-center text-gray-400">
          No transactions found. Import a CSV or adjust filters.
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="px-3 py-2 w-8">
                  <input type="checkbox" checked={allSelected} onChange={toggleAll} className="rounded border-gray-300" />
                </th>
                <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 w-28">Date</th>
                <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600">Description</th>
                <th className="px-3 py-2 text-right text-xs font-semibold text-gray-600 w-28">Amount</th>
                <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 w-20">Check #</th>
                <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600">Account</th>
                <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 w-28">Status</th>
                <th className="px-3 py-2 w-20"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {transactions.map((tx) => (
                <tr key={tx.id} className={`hover:bg-gray-50 ${selected.has(tx.id) ? 'bg-purple-50' : ''}`}>
                  <td className="px-3 py-2 text-center">
                    <input
                      type="checkbox"
                      checked={selected.has(tx.id)}
                      onChange={() => toggleOne(tx.id)}
                      className="rounded border-gray-300"
                    />
                  </td>
                  <td className="px-3 py-2 text-gray-600 whitespace-nowrap">{fmtDate(tx.transaction_date)}</td>
                  <td className="px-3 py-2 text-gray-700 max-w-xs truncate" title={tx.description ?? ''}>
                    {tx.description ?? <span className="text-gray-400 italic">—</span>}
                  </td>
                  <td className={`px-3 py-2 text-right font-mono whitespace-nowrap ${tx.amount < 0 ? 'text-red-600' : 'text-gray-700'}`}>
                    {fmt(tx.amount)}
                  </td>
                  <td className="px-3 py-2 text-gray-500">{tx.check_number ?? ''}</td>
                  <td className="px-3 py-2">
                    <AccountCell
                      tx={tx}
                      accounts={accounts}
                      onClassify={(accountId) => classifyMutation.mutate({ id: tx.id, accountId })}
                      onConfirm={() => confirmMutation.mutate(tx)}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <StatusBadge status={tx.classification_status} />
                  </td>
                  <td className="px-3 py-2 text-right">
                    <button
                      onClick={() => { if (confirm('Delete this transaction?')) deleteMutation.mutate(tx.id); }}
                      className="text-xs text-red-400 hover:text-red-600"
                    >
                      Del
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Import CSV Modal */}
      {showImport && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between px-5 py-4 border-b">
              <h2 className="text-base font-semibold">Import CSV</h2>
              <button onClick={() => { setShowImport(false); setImportFile(null); setImportError(null); }} className="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
            </div>
            <div className="px-5 py-4 space-y-4">
              {importError && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded text-sm">{importError}</div>
              )}
              <p className="text-sm text-gray-600">
                Upload a CSV file with columns: <strong>Date</strong>, <strong>Description</strong>, <strong>Amount</strong>, and optionally <strong>Check Number</strong>.
              </p>
              <div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,text/csv"
                  onChange={(e) => setImportFile(e.target.files?.[0] ?? null)}
                  className="block w-full text-sm text-gray-600 file:mr-3 file:py-1.5 file:px-3 file:rounded file:border-0 file:text-sm file:bg-gray-100 file:text-gray-700 hover:file:bg-gray-200"
                />
              </div>
              {importFile && (
                <p className="text-xs text-gray-500">{importFile.name} ({(importFile.size / 1024).toFixed(1)} KB)</p>
              )}
              <div className="flex justify-end gap-2 pt-2">
                <button
                  onClick={() => { setShowImport(false); setImportFile(null); setImportError(null); }}
                  className="px-3 py-1.5 text-sm border border-gray-300 rounded hover:bg-gray-50"
                >Cancel</button>
                <button
                  onClick={() => {
                    if (!importFile || !clientId) return;
                    importMutation.mutate({ file: importFile, periodId: selectedPeriodId ?? undefined });
                  }}
                  disabled={!importFile || importMutation.isPending}
                  className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                >
                  {importMutation.isPending ? 'Importing…' : 'Import'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function AccountCell({
  tx,
  accounts,
  onClassify,
  onConfirm,
}: {
  tx: BankTransaction;
  accounts: Account[];
  onClassify: (accountId: number) => void;
  onConfirm: () => void;
}) {
  const [editing, setEditing] = useState(false);

  if (tx.classification_status === 'ai_suggested' && tx.ai_suggested_account_id && !editing) {
    return (
      <div className="flex items-center gap-1.5">
        <span className="text-gray-700 text-xs">
          {tx.ai_suggested_account_number} – {tx.ai_suggested_account_name}
          {tx.ai_confidence !== null && (
            <span className="text-purple-500 ml-1">({Math.round(tx.ai_confidence * 100)}%)</span>
          )}
        </span>
        <button
          onClick={onConfirm}
          className="text-xs text-green-600 hover:text-green-800 font-medium"
        >✓</button>
        <button
          onClick={() => setEditing(true)}
          className="text-xs text-blue-500 hover:text-blue-700"
        >Edit</button>
      </div>
    );
  }

  if ((tx.classification_status === 'confirmed' || tx.classification_status === 'manual') && tx.account_id && !editing) {
    return (
      <div className="flex items-center gap-1.5">
        <span className="text-gray-700 text-xs">{tx.account_number} – {tx.account_name}</span>
        <button onClick={() => setEditing(true)} className="text-xs text-blue-500 hover:text-blue-700">Edit</button>
      </div>
    );
  }

  return (
    <select
      value=""
      autoFocus={editing}
      onChange={(e) => {
        if (!e.target.value) return;
        onClassify(Number(e.target.value));
        setEditing(false);
      }}
      onBlur={() => setEditing(false)}
      className="w-full border border-gray-300 rounded px-1.5 py-0.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
    >
      <option value="">Select account…</option>
      {accounts.map((a) => (
        <option key={a.id} value={a.id}>
          {a.account_number} – {a.account_name}
        </option>
      ))}
    </select>
  );
}
