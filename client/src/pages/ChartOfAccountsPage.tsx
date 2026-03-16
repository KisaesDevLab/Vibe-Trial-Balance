import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  flexRender,
  createColumnHelper,
  type SortingState,
} from '@tanstack/react-table';
import {
  listAccounts,
  createAccount,
  updateAccount,
  deleteAccount,
  importAccounts,
  copyAccountsFromClient,
  type Account,
  type AccountInput,
} from '../api/chartOfAccounts';
import { listClients, type Client } from '../api/clients';
import { useUIStore } from '../store/uiStore';

const CATEGORIES = ['assets', 'liabilities', 'equity', 'revenue', 'expenses'] as const;
const CATEGORY_LABELS: Record<string, string> = {
  assets: 'Assets',
  liabilities: 'Liabilities',
  equity: 'Equity',
  revenue: 'Revenue',
  expenses: 'Expenses',
};

const columnHelper = createColumnHelper<Account>();

// --- Account Form ---
interface AccountFormProps {
  clientId: number;
  initial?: Partial<AccountInput>;
  onSave: (input: AccountInput) => void;
  onCancel: () => void;
  saving: boolean;
  error: string | null;
}

function AccountForm({ clientId: _clientId, initial, onSave, onCancel, saving, error }: AccountFormProps) {
  const [form, setForm] = useState<AccountInput>({
    accountNumber: initial?.accountNumber ?? '',
    accountName: initial?.accountName ?? '',
    category: initial?.category ?? 'assets',
    subcategory: initial?.subcategory ?? '',
    normalBalance: initial?.normalBalance ?? 'debit',
    taxLine: initial?.taxLine ?? '',
    workpaperRef: initial?.workpaperRef ?? '',
    sortOrder: initial?.sortOrder ?? 0,
  });

  const set = (field: keyof AccountInput, value: string | number) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      ...form,
      subcategory: form.subcategory || undefined,
      taxLine: form.taxLine || undefined,
      workpaperRef: form.workpaperRef || undefined,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded text-sm">
          {error}
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Account #</label>
          <input
            value={form.accountNumber}
            onChange={(e) => set('accountNumber', e.target.value)}
            className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Account Name</label>
          <input
            value={form.accountName}
            onChange={(e) => set('accountName', e.target.value)}
            className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Category</label>
          <select
            value={form.category}
            onChange={(e) => set('category', e.target.value)}
            className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {CATEGORY_LABELS[c]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Subcategory</label>
          <input
            value={form.subcategory ?? ''}
            onChange={(e) => set('subcategory', e.target.value)}
            className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Optional"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Normal Balance</label>
          <select
            value={form.normalBalance}
            onChange={(e) => set('normalBalance', e.target.value)}
            className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="debit">Debit</option>
            <option value="credit">Credit</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Tax Line</label>
          <input
            value={form.taxLine ?? ''}
            onChange={(e) => set('taxLine', e.target.value)}
            className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Optional"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Workpaper Ref</label>
          <input
            value={form.workpaperRef ?? ''}
            onChange={(e) => set('workpaperRef', e.target.value)}
            className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Optional"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Sort Order</label>
          <input
            type="number"
            value={form.sortOrder ?? 0}
            onChange={(e) => set('sortOrder', Number(e.target.value))}
            className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <button
          type="button"
          onClick={onCancel}
          className="px-3 py-1.5 text-sm border border-gray-300 rounded hover:bg-gray-50"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={saving}
          className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
        >
          {saving ? 'Saving...' : 'Save'}
        </button>
      </div>
    </form>
  );
}

// --- Modal wrapper ---
function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <h2 className="text-base font-semibold">{title}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
        </div>
        <div className="px-5 py-4">{children}</div>
      </div>
    </div>
  );
}

// --- CSV helpers ---
const REQUIRED_COLS = ['account_number', 'account_name', 'category', 'normal_balance'] as const;
// Optional columns are documented in the UI but not validated here
const _OPTIONAL_COLS = ['subcategory', 'tax_line', 'workpaper_ref', 'sort_order'] as const;
void _OPTIONAL_COLS;
const VALID_CATEGORIES = new Set(['assets', 'liabilities', 'equity', 'revenue', 'expenses']);
const VALID_BALANCES   = new Set(['debit', 'credit']);

interface ParsedRow {
  accountNumber: string;
  accountName: string;
  category: string;
  normalBalance: string;
  subcategory?: string;
  taxLine?: string;
  workpaperRef?: string;
  sortOrder?: number;
  _errors: string[];
}

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let inQuote = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuote) {
      if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (ch === '"') inQuote = false;
      else cell += ch;
    } else {
      if (ch === '"') { inQuote = true; }
      else if (ch === ',') { row.push(cell); cell = ''; }
      else if (ch === '\n' || (ch === '\r' && text[i + 1] === '\n')) {
        if (ch === '\r') i++;
        row.push(cell); cell = '';
        if (row.some((c) => c !== '')) rows.push(row);
        row = [];
      } else { cell += ch; }
    }
  }
  row.push(cell);
  if (row.some((c) => c !== '')) rows.push(row);
  return rows;
}

function parseCsvAccounts(text: string): { rows: ParsedRow[]; headerError: string | null } {
  const raw = parseCsv(text.trim());
  if (raw.length < 2) return { rows: [], headerError: 'File must have a header row and at least one data row.' };

  const headers = raw[0].map((h) => h.trim().toLowerCase().replace(/\s+/g, '_'));
  const missing = REQUIRED_COLS.filter((c) => !headers.includes(c));
  if (missing.length > 0) return { rows: [], headerError: `Missing required columns: ${missing.join(', ')}` };

  const idx = (col: string) => headers.indexOf(col);
  const rows: ParsedRow[] = [];

  for (let i = 1; i < raw.length; i++) {
    const r = raw[i];
    const get = (col: string) => (r[idx(col)] ?? '').trim();
    const errors: string[] = [];
    const accountNumber = get('account_number');
    const accountName   = get('account_name');
    const category      = get('category').toLowerCase();
    const normalBalance = get('normal_balance').toLowerCase();
    const sortRaw       = get('sort_order');

    if (!accountNumber) errors.push('account_number required');
    if (!accountName)   errors.push('account_name required');
    if (!VALID_CATEGORIES.has(category)) errors.push(`invalid category "${category}"`);
    if (!VALID_BALANCES.has(normalBalance)) errors.push(`invalid normal_balance "${normalBalance}"`);
    const sortOrder = sortRaw ? Number(sortRaw) : undefined;
    if (sortRaw && isNaN(sortOrder!)) errors.push('sort_order must be a number');

    rows.push({
      accountNumber,
      accountName,
      category,
      normalBalance,
      subcategory:  get('subcategory')   || undefined,
      taxLine:      get('tax_line')      || undefined,
      workpaperRef: get('workpaper_ref') || undefined,
      sortOrder:    sortOrder,
      _errors: errors,
    });
  }
  return { rows, headerError: null };
}

// --- Import CSV Modal ---
interface ImportModalProps {
  clientId: number;
  onClose: () => void;
  onSuccess: () => void;
}

function ImportModal({ clientId, onClose, onSuccess }: ImportModalProps) {
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [headerError, setHeaderError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const importMutation = useMutation({
    mutationFn: (validRows: AccountInput[]) => importAccounts(clientId, validRows),
    onSuccess: (res) => {
      if (res.error) return;
      onSuccess();
    },
  });

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const { rows: parsed, headerError: hErr } = parseCsvAccounts(text);
      setHeaderError(hErr);
      setRows(parsed);
    };
    reader.readAsText(file);
  };

  const validRows = rows.filter((r) => r._errors.length === 0);
  const errorCount = rows.filter((r) => r._errors.length > 0).length;

  const handleImport = () => {
    importMutation.mutate(validRows.map((r) => ({
      accountNumber: r.accountNumber,
      accountName:   r.accountName,
      category:      r.category as AccountInput['category'],
      normalBalance: r.normalBalance as AccountInput['normalBalance'],
      subcategory:   r.subcategory,
      taxLine:       r.taxLine,
      workpaperRef:  r.workpaperRef,
      sortOrder:     r.sortOrder,
    })));
  };

  const result = importMutation.data;

  return (
    <Modal title="Import Chart of Accounts from CSV" onClose={onClose}>
      <div className="space-y-4">
        <div className="bg-gray-50 border border-gray-200 rounded p-3 text-xs text-gray-600">
          <p className="font-semibold mb-1">Required columns:</p>
          <code className="text-gray-700">account_number, account_name, category, normal_balance</code>
          <p className="font-semibold mt-2 mb-1">Optional columns:</p>
          <code className="text-gray-700">subcategory, tax_line, workpaper_ref, sort_order</code>
          <p className="mt-2">Valid categories: <code>assets, liabilities, equity, revenue, expenses</code></p>
          <p>Valid normal_balance: <code>debit, credit</code></p>
          <p className="mt-2">Existing accounts with the same account number will be updated. New accounts will be inserted.</p>
        </div>

        {result?.data ? (
          <div className="bg-green-50 border border-green-200 rounded px-4 py-3 text-sm text-green-800">
            Import complete: <strong>{result.data.inserted}</strong> inserted, <strong>{result.data.updated}</strong> updated.
          </div>
        ) : (
          <>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Select CSV file</label>
              <input ref={fileRef} type="file" accept=".csv,.txt" onChange={handleFile} className="text-sm text-gray-700" />
            </div>

            {headerError && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded text-sm">{headerError}</div>
            )}

            {importMutation.data?.error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded text-sm">{importMutation.data.error.message}</div>
            )}

            {rows.length > 0 && !headerError && (
              <div>
                <div className="flex items-center gap-4 mb-2 text-sm">
                  <span className="text-gray-700">{rows.length} rows in file</span>
                  <span className="text-green-700 font-medium">{validRows.length} valid</span>
                  {errorCount > 0 && <span className="text-red-600 font-medium">{errorCount} with errors</span>}
                </div>
                <div className="border border-gray-200 rounded overflow-auto max-h-52">
                  <table className="w-full text-xs">
                    <thead className="bg-gray-50 sticky top-0">
                      <tr>
                        <th className="px-2 py-1.5 text-left font-semibold text-gray-600 w-6">#</th>
                        <th className="px-2 py-1.5 text-left font-semibold text-gray-600">Acct #</th>
                        <th className="px-2 py-1.5 text-left font-semibold text-gray-600">Name</th>
                        <th className="px-2 py-1.5 text-left font-semibold text-gray-600">Category</th>
                        <th className="px-2 py-1.5 text-left font-semibold text-gray-600">Bal</th>
                        <th className="px-2 py-1.5 text-left font-semibold text-gray-600">Issues</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {rows.map((r, i) => (
                        <tr key={i} className={r._errors.length > 0 ? 'bg-red-50' : ''}>
                          <td className="px-2 py-1 text-gray-400">{i + 1}</td>
                          <td className="px-2 py-1 font-mono">{r.accountNumber}</td>
                          <td className="px-2 py-1 max-w-32 truncate">{r.accountName}</td>
                          <td className="px-2 py-1">{r.category}</td>
                          <td className="px-2 py-1">{r.normalBalance}</td>
                          <td className="px-2 py-1 text-red-600">{r._errors.join('; ') || ''}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <button onClick={onClose} className="px-3 py-1.5 text-sm border border-gray-300 rounded hover:bg-gray-50">Cancel</button>
              <button
                onClick={handleImport}
                disabled={validRows.length === 0 || importMutation.isPending}
                className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-40"
              >
                {importMutation.isPending ? 'Importing…' : `Import ${validRows.length} Account${validRows.length !== 1 ? 's' : ''}`}
              </button>
            </div>
          </>
        )}

        {result?.data && (
          <div className="flex justify-end">
            <button onClick={onClose} className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700">Done</button>
          </div>
        )}
      </div>
    </Modal>
  );
}

// --- Copy from Client Modal ---
interface CopyModalProps {
  clientId: number;
  onClose: () => void;
  onSuccess: () => void;
}

function CopyFromClientModal({ clientId, onClose, onSuccess }: CopyModalProps) {
  const [sourceId, setSourceId] = useState<number | null>(null);
  const [overwrite, setOverwrite] = useState(false);

  const { data: clientsData } = useQuery({
    queryKey: ['clients'],
    queryFn: async () => {
      const res = await listClients();
      return res.data ?? [];
    },
  });

  const otherClients = (clientsData ?? []).filter((c: Client) => c.id !== clientId && c.is_active);

  const { data: sourceCoaData } = useQuery({
    queryKey: ['chart-of-accounts', sourceId],
    queryFn: async () => {
      if (!sourceId) return [];
      const res = await listAccounts(sourceId);
      return res.data ?? [];
    },
    enabled: sourceId !== null,
  });

  const copyMutation = useMutation({
    mutationFn: () => copyAccountsFromClient(clientId, sourceId!, overwrite),
    onSuccess: (res) => {
      if (res.error) return;
      onSuccess();
    },
  });

  const result = copyMutation.data;

  return (
    <Modal title="Copy Chart of Accounts from Another Client" onClose={onClose}>
      <div className="space-y-4">
        {result?.data ? (
          <>
            <div className="bg-green-50 border border-green-200 rounded px-4 py-3 text-sm text-green-800">
              Copy complete: <strong>{result.data.inserted}</strong> inserted,{' '}
              <strong>{result.data.updated}</strong> updated,{' '}
              <strong>{result.data.skipped}</strong> skipped.
            </div>
            <div className="flex justify-end">
              <button onClick={onClose} className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700">Done</button>
            </div>
          </>
        ) : (
          <>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Source Client</label>
              <select
                value={sourceId ?? ''}
                onChange={(e) => setSourceId(e.target.value ? Number(e.target.value) : null)}
                className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">— Select a client —</option>
                {otherClients.map((c: Client) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            {sourceId && sourceCoaData !== undefined && (
              <p className="text-sm text-gray-600">
                Source has <strong>{sourceCoaData.length}</strong> active account{sourceCoaData.length !== 1 ? 's' : ''}.
              </p>
            )}

            <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
              <input
                type="checkbox"
                checked={overwrite}
                onChange={(e) => setOverwrite(e.target.checked)}
                className="rounded border-gray-300 text-blue-600"
              />
              Overwrite existing accounts with the same account number
            </label>
            <p className="text-xs text-gray-500 -mt-2">
              When unchecked, accounts that already exist in the destination are skipped.
            </p>

            {copyMutation.data?.error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded text-sm">{copyMutation.data.error.message}</div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <button onClick={onClose} className="px-3 py-1.5 text-sm border border-gray-300 rounded hover:bg-gray-50">Cancel</button>
              <button
                onClick={() => copyMutation.mutate()}
                disabled={!sourceId || copyMutation.isPending}
                className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-40"
              >
                {copyMutation.isPending ? 'Copying…' : 'Copy Accounts'}
              </button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}

// --- Main page ---
export function ChartOfAccountsPage() {
  const { selectedClientId } = useUIStore();
  const qc = useQueryClient();
  const [sorting, setSorting] = useState<SortingState>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [editAccount, setEditAccount] = useState<Account | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [showImport, setShowImport] = useState(false);
  const [showCopy, setShowCopy] = useState(false);

  const { data, isLoading, error } = useQuery({
    queryKey: ['chart-of-accounts', selectedClientId],
    queryFn: async () => {
      if (!selectedClientId) return [];
      const res = await listAccounts(selectedClientId);
      if (res.error) throw new Error(res.error.message);
      return res.data;
    },
    enabled: selectedClientId !== null,
  });

  const createMutation = useMutation({
    mutationFn: (input: AccountInput) => createAccount(selectedClientId!, input),
    onSuccess: (result) => {
      if (result.error) { setFormError(result.error.message); return; }
      qc.invalidateQueries({ queryKey: ['chart-of-accounts', selectedClientId] });
      setShowAdd(false);
      setFormError(null);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, input }: { id: number; input: Partial<AccountInput> }) =>
      updateAccount(id, input),
    onSuccess: (result) => {
      if (result.error) { setFormError(result.error.message); return; }
      qc.invalidateQueries({ queryKey: ['chart-of-accounts', selectedClientId] });
      setEditAccount(null);
      setFormError(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteAccount(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['chart-of-accounts', selectedClientId] });
    },
  });

  const columns = [
    columnHelper.accessor('account_number', {
      header: 'Account #',
      cell: (info) => <span className="font-mono text-sm">{info.getValue()}</span>,
    }),
    columnHelper.accessor('account_name', {
      header: 'Account Name',
      cell: (info) => <span className="font-medium">{info.getValue()}</span>,
    }),
    columnHelper.accessor('category', {
      header: 'Category',
      cell: (info) => (
        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${CATEGORY_COLORS[info.getValue()]}`}>
          {CATEGORY_LABELS[info.getValue()]}
        </span>
      ),
    }),
    columnHelper.accessor('subcategory', {
      header: 'Subcategory',
      cell: (info) => info.getValue() ?? <span className="text-gray-300">—</span>,
    }),
    columnHelper.accessor('normal_balance', {
      header: 'Normal Bal.',
      cell: (info) => <span className="capitalize">{info.getValue()}</span>,
    }),
    columnHelper.accessor('tax_line', {
      header: 'Tax Line',
      cell: (info) => info.getValue() ?? <span className="text-gray-300">—</span>,
    }),
    columnHelper.accessor('workpaper_ref', {
      header: 'W/P Ref',
      cell: (info) => info.getValue() ?? <span className="text-gray-300">—</span>,
    }),
    columnHelper.display({
      id: 'actions',
      header: '',
      cell: ({ row }) => (
        <div className="flex items-center gap-2 justify-end">
          <button
            onClick={() => { setEditAccount(row.original); setFormError(null); }}
            className="text-xs text-blue-600 hover:text-blue-800"
          >
            Edit
          </button>
          <button
            onClick={() => {
              if (confirm(`Delete "${row.original.account_name}"?`)) {
                deleteMutation.mutate(row.original.id);
              }
            }}
            className="text-xs text-red-500 hover:text-red-700"
          >
            Delete
          </button>
        </div>
      ),
    }),
  ];

  const table = useReactTable({
    data: data ?? [],
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  if (!selectedClientId) {
    return (
      <div className="flex items-center justify-center h-full text-gray-400">
        <div className="text-center">
          <p className="text-lg font-medium">No client selected</p>
          <p className="text-sm mt-1">Choose a client from the sidebar to view their chart of accounts.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Chart of Accounts</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            {data ? `${data.length} account${data.length !== 1 ? 's' : ''}` : ''}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowImport(true)}
            className="px-3 py-1.5 text-sm border border-gray-300 rounded hover:bg-gray-50"
          >
            Import CSV
          </button>
          <button
            onClick={() => setShowCopy(true)}
            className="px-3 py-1.5 text-sm border border-gray-300 rounded hover:bg-gray-50"
          >
            Copy from Client
          </button>
          <button
            onClick={() => { setShowAdd(true); setFormError(null); }}
            className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 transition-colors"
          >
            + Add Account
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded text-sm mb-4">
          {error.message}
        </div>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center py-12 text-gray-400">Loading...</div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                {table.getHeaderGroups().map((hg) => (
                  <tr key={hg.id} className="border-b border-gray-200 bg-gray-50">
                    {hg.headers.map((header) => (
                      <th
                        key={header.id}
                        className="px-3 py-2.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider whitespace-nowrap cursor-pointer select-none"
                        onClick={header.column.getToggleSortingHandler()}
                      >
                        <span className="flex items-center gap-1">
                          {flexRender(header.column.columnDef.header, header.getContext())}
                          {header.column.getIsSorted() === 'asc' && ' ↑'}
                          {header.column.getIsSorted() === 'desc' && ' ↓'}
                        </span>
                      </th>
                    ))}
                  </tr>
                ))}
              </thead>
              <tbody className="divide-y divide-gray-100">
                {table.getRowModel().rows.length === 0 ? (
                  <tr>
                    <td colSpan={columns.length} className="px-3 py-8 text-center text-gray-400">
                      No accounts yet. Click &ldquo;+ Add Account&rdquo; to get started.
                    </td>
                  </tr>
                ) : (
                  table.getRowModel().rows.map((row) => (
                    <tr key={row.id} className="hover:bg-gray-50 transition-colors">
                      {row.getVisibleCells().map((cell) => (
                        <td key={cell.id} className="px-3 py-2.5 text-gray-700">
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </td>
                      ))}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add modal */}
      {showAdd && (
        <Modal title="Add Account" onClose={() => setShowAdd(false)}>
          <AccountForm
            clientId={selectedClientId}
            onSave={(input) => createMutation.mutate(input)}
            onCancel={() => setShowAdd(false)}
            saving={createMutation.isPending}
            error={formError}
          />
        </Modal>
      )}

      {/* Edit modal */}
      {editAccount && (
        <Modal title="Edit Account" onClose={() => setEditAccount(null)}>
          <AccountForm
            clientId={editAccount.client_id}
            initial={{
              accountNumber: editAccount.account_number,
              accountName: editAccount.account_name,
              category: editAccount.category,
              subcategory: editAccount.subcategory ?? undefined,
              normalBalance: editAccount.normal_balance,
              taxLine: editAccount.tax_line ?? undefined,
              workpaperRef: editAccount.workpaper_ref ?? undefined,
              sortOrder: editAccount.sort_order,
            }}
            onSave={(input) => updateMutation.mutate({ id: editAccount.id, input })}
            onCancel={() => setEditAccount(null)}
            saving={updateMutation.isPending}
            error={formError}
          />
        </Modal>
      )}

      {showImport && (
        <ImportModal
          clientId={selectedClientId}
          onClose={() => setShowImport(false)}
          onSuccess={() => {
            qc.invalidateQueries({ queryKey: ['chart-of-accounts', selectedClientId] });
            setShowImport(false);
          }}
        />
      )}

      {showCopy && (
        <CopyFromClientModal
          clientId={selectedClientId}
          onClose={() => setShowCopy(false)}
          onSuccess={() => {
            qc.invalidateQueries({ queryKey: ['chart-of-accounts', selectedClientId] });
            setShowCopy(false);
          }}
        />
      )}
    </div>
  );
}

const CATEGORY_COLORS: Record<string, string> = {
  assets: 'bg-blue-50 text-blue-700',
  liabilities: 'bg-orange-50 text-orange-700',
  equity: 'bg-purple-50 text-purple-700',
  revenue: 'bg-green-50 text-green-700',
  expenses: 'bg-red-50 text-red-700',
};
