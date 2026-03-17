import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  listBankTransactions,
  importBankTransactions,
  classifyTransaction,
  deleteBankTransaction,
  batchDeleteTransactions,
  batchClassifyTransactions,
  batchUpdateSourceAccount,
  aiClassifyTransactions,
  listClassificationRules,
  deleteClassificationRule,
  type BankTransaction,
  type ClassificationStatus,
  type CsvMapping,
} from '../api/bankTransactions';
import { listAccounts, type Account } from '../api/chartOfAccounts';
import { useUIStore } from '../store/uiStore';

function downloadCsv(filename: string, rows: string[][]): void {
  const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\r\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

function fmt(cents: number): string {
  const abs = Math.abs(cents);
  const str = (abs / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return cents < 0 ? `(${str})` : str;
}

function fmtDate(d: string): string {
  const s = d.slice(0, 10);
  const [y, m, day] = s.split('-');
  return `${m}/${day}/${y}`;
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
  const [filterSourceAccount, setFilterSourceAccount] = useState<string>('');
  const [sortCol, setSortCol] = useState<string>('transaction_date');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [batchAccountId, setBatchAccountId] = useState<string>('');
  const [batchSourceAccountId, setBatchSourceAccountId] = useState<string>('');
  const [importSourceAccountId, setImportSourceAccountId] = useState<string>('');
  const [showImport, setShowImport] = useState(false);
  const [importStep, setImportStep] = useState<'file' | 'mapping'>('file');
  const [showRules, setShowRules] = useState(false);
  const [aiStatus, setAiStatus] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importHeaders, setImportHeaders] = useState<string[]>([]);
  const [importMapping, setImportMapping] = useState<CsvMapping>({
    dateCol: '', descCol: '', amountMode: 'single', amountCol: '', debitCol: '', creditCol: '', checkCol: '',
  });
  const [importError, setImportError] = useState<string | null>(null);
  const [editingDescId, setEditingDescId] = useState<number | null>(null);
  const [editingDescValue, setEditingDescValue] = useState('');
  const [batchMessage, setBatchMessage] = useState<string | null>(null);
  const [showSourceAccountRequired, setShowSourceAccountRequired] = useState(false);

  const clientId = selectedClientId;
  const txQueryKey = ['bank-transactions', clientId, filterStatus, filterPeriod ? selectedPeriodId : null, filterSourceAccount];

  const { data: txData, isLoading } = useQuery({
    queryKey: txQueryKey,
    queryFn: async () => {
      if (!clientId) return [];
      const res = await listBankTransactions(clientId, {
        status: filterStatus || undefined,
        periodId: filterPeriod && selectedPeriodId ? selectedPeriodId : undefined,
        sourceAccountId: filterSourceAccount ? Number(filterSourceAccount) : undefined,
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

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['bank-transactions', clientId] });
    // Trans JEs are created/updated/deleted alongside bank transactions, so keep JE and trial-balance caches fresh
    qc.invalidateQueries({ queryKey: ['journal-entries'] });
    qc.invalidateQueries({ queryKey: ['trial-balance'] });
  };

  const importMutation = useMutation({
    mutationFn: ({ file, mapping }: { file: File; mapping?: CsvMapping }) =>
      importBankTransactions(clientId!, file, {
        periodId: selectedPeriodId ?? undefined,
        sourceAccountId: importSourceAccountId ? Number(importSourceAccountId) : undefined,
        mapping,
      }),
    onSuccess: (res) => {
      if (res.error) { setImportError(res.error.message); return; }
      invalidate();
      closeImport();
    },
  });

  const closeImport = () => {
    setShowImport(false);
    setImportStep('file');
    setImportFile(null);
    setImportHeaders([]);
    setImportMapping({ dateCol: '', descCol: '', amountMode: 'single', amountCol: '', debitCol: '', creditCol: '', checkCol: '' });
    setImportSourceAccountId('');
    setImportError(null);
    setShowSourceAccountRequired(false);
  };

  const isOfxFile = (f: File) => /\.(ofx|qfx|qbo)$/i.test(f.name);

  const bestMatch = (headers: string[], candidates: string[]): string =>
    candidates.find((c) => headers.some((h) => h.toLowerCase() === c.toLowerCase())) ?? '';

  const autoDetectMapping = (headers: string[]): CsvMapping => ({
    dateCol: bestMatch(headers, ['Date', 'Transaction Date', 'date', 'transaction_date']),
    descCol: bestMatch(headers, ['Description', 'Memo', 'Payee', 'description', 'memo', 'payee']),
    amountMode: headers.some((h) => /debit/i.test(h)) && headers.some((h) => /credit/i.test(h)) ? 'split' : 'single',
    amountCol: bestMatch(headers, ['Amount', 'amount']),
    debitCol: bestMatch(headers, ['Debit', 'debit', 'Withdrawal', 'withdrawal']),
    creditCol: bestMatch(headers, ['Credit', 'credit', 'Deposit', 'deposit']),
    checkCol: bestMatch(headers, ['Check', 'Check Number', 'check', 'check_number']),
  });

  const handleFileSelected = (file: File) => {
    setImportFile(file);
    setImportError(null);
    if (isOfxFile(file)) {
      setImportStep('file');
      return;
    }
    // CSV: read first line to get headers
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = (e.target?.result as string) ?? '';
      const firstLine = text.split(/\r?\n/)[0];
      // Handle quoted headers
      const headers = firstLine.split(',').map((h) => h.trim().replace(/^"|"$/g, ''));
      setImportHeaders(headers);
      setImportMapping(autoDetectMapping(headers));
      setImportStep('mapping');
    };
    reader.readAsText(file);
  };

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
    onSuccess: () => invalidate(),
  });

  const showBatchMessage = (msg: string) => {
    setBatchMessage(msg);
    setTimeout(() => setBatchMessage(null), 4000);
  };

  const batchDeleteMutation = useMutation({
    mutationFn: (ids: number[]) => batchDeleteTransactions(clientId!, ids),
    onSuccess: (_res, ids) => {
      invalidate();
      setSelected(new Set());
      showBatchMessage(`Deleted ${ids.length} transaction(s) successfully.`);
    },
  });

  const batchClassifyMutation = useMutation({
    mutationFn: ({ ids, accountId }: { ids: number[]; accountId: number }) =>
      batchClassifyTransactions(clientId!, ids, accountId),
    onSuccess: (_res, { ids }) => {
      invalidate();
      setSelected(new Set());
      setBatchAccountId('');
      showBatchMessage(`Classified ${ids.length} transaction(s) successfully.`);
    },
  });

  const batchSourceMutation = useMutation({
    mutationFn: ({ ids, sourceAccountId }: { ids: number[]; sourceAccountId: number | null }) =>
      batchUpdateSourceAccount(clientId!, ids, sourceAccountId),
    onSuccess: (_res, { ids }) => {
      invalidate();
      setSelected(new Set());
      setBatchSourceAccountId('');
      showBatchMessage(`Updated source account on ${ids.length} transaction(s).`);
    },
  });

  const aiMutation = useMutation({
    mutationFn: (ids: number[]) => aiClassifyTransactions(clientId!, ids),
    onMutate: () => setAiStatus('Running AI classification…'),
    onSuccess: (res, ids) => {
      if (res.error) { setAiStatus(`Error: ${res.error.message}`); return; }
      const unclassifiedBefore = rawTransactions.filter((t) => t.classification_status === 'unclassified').length;
      invalidate();
      const n = res.data?.classified ?? 0;
      const attempted = res.data?.results?.length ?? n;
      const skipped = ids.length - attempted;
      const skipNote = skipped > 0 ? ` (${skipped} already confirmed/manual — skipped)` : '';
      const remaining = Math.max(0, unclassifiedBefore - n);
      setAiStatus(`AI classified ${n} transaction(s).${skipNote} ${remaining} unclassified transaction(s) remain.`);
      setSelected(new Set());
    },
  });

  const updateDescMutation = useMutation({
    mutationFn: ({ id, description }: { id: number; description: string | null }) =>
      classifyTransaction(clientId!, id, { description }),
    onSuccess: () => { invalidate(); setEditingDescId(null); },
  });

  const deleteRuleMutation = useMutation({
    mutationFn: (id: number) => deleteClassificationRule(clientId!, id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['classification-rules', clientId] }),
  });

  const accounts: Account[] = accountsData ?? [];
  const rawTransactions: BankTransaction[] = txData ?? [];

  const handleSort = (col: string) => {
    if (sortCol === col) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortCol(col);
      setSortDir('asc');
    }
  };

  const transactions = [...rawTransactions].sort((a, b) => {
    let av: string | number | null = null;
    let bv: string | number | null = null;
    switch (sortCol) {
      case 'transaction_date': av = a.transaction_date; bv = b.transaction_date; break;
      case 'description': av = (a.description ?? '').toLowerCase(); bv = (b.description ?? '').toLowerCase(); break;
      case 'amount': av = a.amount; bv = b.amount; break;
      case 'check_number': av = (a.check_number ?? '').toLowerCase(); bv = (b.check_number ?? '').toLowerCase(); break;
      case 'source_account': av = (a.source_account_name ?? '').toLowerCase(); bv = (b.source_account_name ?? '').toLowerCase(); break;
      case 'category': av = (a.account_name ?? '').toLowerCase(); bv = (b.account_name ?? '').toLowerCase(); break;
      case 'status': av = a.classification_status; bv = b.classification_status; break;
    }
    if (av === bv) return 0;
    if (av === null || av === '') return 1;
    if (bv === null || bv === '') return -1;
    const cmp = av < bv ? -1 : 1;
    return sortDir === 'asc' ? cmp : -cmp;
  });

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
            onClick={() => {
              if (!transactions.length) return;
              const header = ['Date', 'Description', 'Amount', 'Check #', 'Source Account', 'Category', 'Status'];
              const rows = transactions.map((t) => [
                fmtDate(t.transaction_date),
                t.description ?? '',
                String(t.amount / 100),
                t.check_number ?? '',
                t.source_account_number ? `${t.source_account_number} – ${t.source_account_name}` : '',
                t.account_number ? `${t.account_number} – ${t.account_name}` : '',
                t.classification_status,
              ]);
              downloadCsv('bank-transactions.csv', [header, ...rows]);
            }}
            disabled={!transactions.length}
            className="px-3 py-1.5 text-sm border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-40"
          >
            Export CSV
          </button>
          <button
            onClick={() => setShowRules(!showRules)}
            className="px-3 py-1.5 text-sm border border-gray-300 rounded hover:bg-gray-50"
          >
            Rules {rulesData ? `(${rulesData.length})` : ''}
          </button>
          <button
            onClick={() => { setShowImport(true); setImportStep('file'); setImportError(null); }}
            className="px-3 py-1.5 text-sm border border-gray-300 rounded hover:bg-gray-50"
          >
            Import Transactions
          </button>
          {selected.size > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-500">{selected.size} selected</span>
              <button
                onClick={() => { if (confirm(`Delete ${selected.size} transaction(s)?`)) batchDeleteMutation.mutate([...selected]); }}
                disabled={batchDeleteMutation.isPending}
                className="px-3 py-1.5 text-sm bg-red-500 text-white rounded hover:bg-red-600 disabled:opacity-50"
              >
                {batchDeleteMutation.isPending ? 'Deleting…' : 'Delete'}
              </button>
              <select
                value={batchAccountId}
                onChange={(e) => setBatchAccountId(e.target.value)}
                className="border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Categorize as…</option>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>{a.account_number} – {a.account_name}</option>
                ))}
              </select>
              {batchAccountId && (
                <button
                  onClick={() => {
                    const categoryName = accounts.find((a) => String(a.id) === batchAccountId)?.account_name ?? batchAccountId;
                    if (!confirm(`Classify ${selected.size} transaction(s) as "${categoryName}"?`)) return;
                    batchClassifyMutation.mutate({ ids: [...selected], accountId: Number(batchAccountId) });
                  }}
                  disabled={batchClassifyMutation.isPending}
                  className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                >
                  {batchClassifyMutation.isPending ? 'Applying…' : 'Apply'}
                </button>
              )}
              <select
                value={batchSourceAccountId}
                onChange={(e) => setBatchSourceAccountId(e.target.value)}
                className="border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Set source account…</option>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>{a.account_number} – {a.account_name}</option>
                ))}
              </select>
              {batchSourceAccountId && (
                <button
                  onClick={() => batchSourceMutation.mutate({ ids: [...selected], sourceAccountId: Number(batchSourceAccountId) })}
                  disabled={batchSourceMutation.isPending}
                  className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                >
                  {batchSourceMutation.isPending ? 'Applying…' : 'Apply'}
                </button>
              )}
              <button
                onClick={() => aiMutation.mutate([...selected])}
                disabled={aiMutation.isPending}
                className="px-3 py-1.5 text-sm bg-purple-600 text-white rounded hover:bg-purple-700 disabled:opacity-50"
              >
                {aiMutation.isPending ? 'Classifying…' : 'AI Classify'}
              </button>
            </div>
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
      <div className="flex items-center gap-3 mb-3 flex-wrap">
        <select
          value={filterSourceAccount}
          onChange={(e) => setFilterSourceAccount(e.target.value)}
          className="border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">All accounts</option>
          {accounts.map((a) => (
            <option key={a.id} value={a.id}>{a.account_number} – {a.account_name}</option>
          ))}
        </select>
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

      {/* Batch operation success message */}
      {batchMessage && (
        <div className="bg-green-50 border border-green-200 text-green-700 text-sm px-4 py-2 rounded mb-3">{batchMessage}</div>
      )}

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
          No transactions found. Import transactions or adjust filters.
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="px-3 py-2 w-8">
                  <input type="checkbox" checked={allSelected} onChange={toggleAll} className="rounded border-gray-300" />
                </th>
                {([
                  { col: 'transaction_date', label: 'Date', cls: 'w-28 text-left' },
                  { col: 'description', label: 'Description', cls: 'text-left' },
                  { col: 'amount', label: 'Amount', cls: 'w-28 text-right' },
                  { col: 'check_number', label: 'Check #', cls: 'w-20 text-left' },
                  { col: 'source_account', label: 'Source Account', cls: 'w-36 text-left' },
                  { col: 'category', label: 'Category', cls: 'text-left' },
                  { col: 'status', label: 'Status', cls: 'w-28 text-left' },
                ] as { col: string; label: string; cls: string }[]).map(({ col, label, cls }) => (
                  <th
                    key={col}
                    className={`px-3 py-2 text-xs font-semibold text-gray-600 cursor-pointer select-none hover:bg-gray-100 ${cls}`}
                    onClick={() => handleSort(col)}
                  >
                    {label}
                    {sortCol === col && (
                      <span className="ml-1 text-gray-400">{sortDir === 'asc' ? '▲' : '▼'}</span>
                    )}
                  </th>
                ))}
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
                  <td className="px-3 py-2 max-w-xs">
                    {editingDescId === tx.id ? (
                      <input
                        autoFocus
                        value={editingDescValue}
                        onChange={(e) => setEditingDescValue(e.target.value)}
                        onBlur={() => {
                          const val = editingDescValue.trim() || null;
                          if (val !== (tx.description ?? null)) {
                            updateDescMutation.mutate({ id: tx.id, description: val });
                          } else {
                            setEditingDescId(null);
                          }
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                          if (e.key === 'Escape') setEditingDescId(null);
                        }}
                        className="w-full border border-blue-400 rounded px-1.5 py-0.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    ) : (
                      <span
                        className="block truncate cursor-pointer text-gray-700 hover:text-blue-600"
                        title={tx.description ?? 'Click to edit'}
                        onClick={() => { setEditingDescId(tx.id); setEditingDescValue(tx.description ?? ''); }}
                      >
                        {tx.description ?? <span className="text-gray-300 italic">—</span>}
                      </span>
                    )}
                  </td>
                  <td className={`px-3 py-2 text-right font-mono whitespace-nowrap ${tx.amount < 0 ? 'text-red-600' : 'text-gray-700'}`}>
                    {fmt(tx.amount)}
                  </td>
                  <td className="px-3 py-2 text-gray-600">{tx.check_number ?? ''}</td>
                  <td className="px-3 py-2 text-gray-600">
                    {tx.source_account_number ? `${tx.source_account_number} – ${tx.source_account_name}` : <span className="text-gray-300">—</span>}
                  </td>
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

      {/* Import Modal */}
      {showImport && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-lg">
            <div className="flex items-center justify-between px-5 py-4 border-b">
              <h2 className="text-base font-semibold">
                Import Transactions{importStep === 'mapping' ? ' — Map Columns' : ''}
              </h2>
              <button onClick={closeImport} className="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
            </div>
            <div className="px-5 py-4 space-y-4">
              {importError && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded text-sm">{importError}</div>
              )}

              {/* Step 1: File selection */}
              {importStep === 'file' && (
                <>
                  <p className="text-sm text-gray-600">
                    Supported: <strong>OFX / QFX / QBO</strong> (bank export) or <strong>CSV</strong>.
                  </p>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv,.ofx,.qfx,.qbo,text/csv"
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFileSelected(f); }}
                    className="block w-full text-sm text-gray-600 file:mr-3 file:py-1.5 file:px-3 file:rounded file:border-0 file:text-sm file:bg-gray-100 file:text-gray-700 hover:file:bg-gray-200"
                  />
                  {importFile && (
                    <p className="text-xs text-gray-500">{importFile.name} ({(importFile.size / 1024).toFixed(1)} KB)</p>
                  )}
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Source Account (bank / credit card)</label>
                    <select
                      value={importSourceAccountId}
                      onChange={(e) => { setImportSourceAccountId(e.target.value); setShowSourceAccountRequired(false); }}
                      className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">— select account —</option>
                      {accounts.map((a) => (
                        <option key={a.id} value={a.id}>{a.account_number} – {a.account_name}</option>
                      ))}
                    </select>
                    {showSourceAccountRequired && !importSourceAccountId && (
                      <p className="text-red-600 text-xs mt-1">A source account is required.</p>
                    )}
                  </div>
                  <div className="flex justify-end gap-2 pt-2">
                    <button onClick={closeImport} className="px-3 py-1.5 text-sm border border-gray-300 rounded hover:bg-gray-50">Cancel</button>
                    {importFile && isOfxFile(importFile) && (
                      <button
                        onClick={() => {
                          if (!importSourceAccountId) { setShowSourceAccountRequired(true); return; }
                          importMutation.mutate({ file: importFile });
                        }}
                        disabled={importMutation.isPending}
                        className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                      >
                        {importMutation.isPending ? 'Importing…' : 'Import'}
                      </button>
                    )}
                  </div>
                </>
              )}

              {/* Step 2: Column mapping (CSV only) */}
              {importStep === 'mapping' && (
                <>
                  <p className="text-xs text-gray-500 -mt-1">
                    {importFile?.name} — {importHeaders.length} columns detected. Unset optional fields to skip.
                  </p>
                  <ColMapRow label="Date *" headers={importHeaders} value={importMapping.dateCol}
                    onChange={(v) => setImportMapping((m) => ({ ...m, dateCol: v }))} />
                  <ColMapRow label="Description" headers={importHeaders} value={importMapping.descCol}
                    onChange={(v) => setImportMapping((m) => ({ ...m, descCol: v }))} optional />

                  {/* Amount mode toggle */}
                  <div>
                    <span className="block text-xs font-medium text-gray-700 mb-1">Amount columns</span>
                    <div className="flex gap-4 mb-2">
                      {(['single', 'split'] as const).map((mode) => (
                        <label key={mode} className="flex items-center gap-1.5 text-sm text-gray-600 cursor-pointer">
                          <input type="radio" name="amountMode" value={mode}
                            checked={importMapping.amountMode === mode}
                            onChange={() => setImportMapping((m) => ({ ...m, amountMode: mode }))}
                          />
                          {mode === 'single' ? 'Single signed column' : 'Separate Debit / Credit columns'}
                        </label>
                      ))}
                    </div>
                    {importMapping.amountMode === 'single' ? (
                      <ColMapRow label="Amount *" headers={importHeaders} value={importMapping.amountCol}
                        onChange={(v) => setImportMapping((m) => ({ ...m, amountCol: v }))} />
                    ) : (
                      <div className="grid grid-cols-2 gap-3">
                        <ColMapRow label="Debit col" headers={importHeaders} value={importMapping.debitCol}
                          onChange={(v) => setImportMapping((m) => ({ ...m, debitCol: v }))} optional />
                        <ColMapRow label="Credit col" headers={importHeaders} value={importMapping.creditCol}
                          onChange={(v) => setImportMapping((m) => ({ ...m, creditCol: v }))} optional />
                      </div>
                    )}
                  </div>

                  <ColMapRow label="Check #" headers={importHeaders} value={importMapping.checkCol}
                    onChange={(v) => setImportMapping((m) => ({ ...m, checkCol: v }))} optional />

                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Source Account (bank / credit card)</label>
                    <select
                      value={importSourceAccountId}
                      onChange={(e) => { setImportSourceAccountId(e.target.value); setShowSourceAccountRequired(false); }}
                      className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">— select account —</option>
                      {accounts.map((a) => (
                        <option key={a.id} value={a.id}>{a.account_number} – {a.account_name}</option>
                      ))}
                    </select>
                    {showSourceAccountRequired && !importSourceAccountId && (
                      <p className="text-red-600 text-xs mt-1">A source account is required.</p>
                    )}
                  </div>

                  <div className="flex justify-end gap-2 pt-2">
                    <button onClick={() => setImportStep('file')} className="px-3 py-1.5 text-sm border border-gray-300 rounded hover:bg-gray-50">Back</button>
                    <button
                      onClick={() => {
                        if (!importSourceAccountId) { setShowSourceAccountRequired(true); return; }
                        if (importFile) importMutation.mutate({ file: importFile, mapping: importMapping });
                      }}
                      disabled={
                        !importFile || importMutation.isPending ||
                        !importMapping.dateCol ||
                        (importMapping.amountMode === 'single' && !importMapping.amountCol) ||
                        !importSourceAccountId
                      }
                      className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                    >
                      {importMutation.isPending ? 'Importing…' : 'Import'}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ColMapRow({
  label, headers, value, onChange, optional,
}: {
  label: string;
  headers: string[];
  value: string;
  onChange: (v: string) => void;
  optional?: boolean;
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs font-medium text-gray-700 w-28 shrink-0">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="flex-1 border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        <option value="">{optional ? '— skip —' : 'Select column…'}</option>
        {headers.map((h) => (
          <option key={h} value={h}>{h}</option>
        ))}
      </select>
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
        <span className="text-gray-700 text-sm">
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
        <span className="text-gray-700 text-sm">{tx.account_number} – {tx.account_name}</span>
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
      className="w-full border border-gray-300 rounded px-1.5 py-0.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
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
