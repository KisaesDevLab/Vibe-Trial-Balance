// Copyright 2025-2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Use is limited to qualifying small businesses. See LICENSE for terms.

import { useState, useRef, useMemo, useEffect } from 'react';
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
  bulkUpdateAccounts,
  type Account,
  type AccountInput,
  type BulkAccountUpdates,
} from '../api/chartOfAccounts';
import { listClients, type Client } from '../api/clients';
import { getAvailableTaxCodes, type TaxCode } from '../api/taxCodes';
import { listLeadSheets } from '../api/leadSheets';
import { useUIStore, pushToast } from '../store/uiStore';
import { checkFileSize } from '../utils/fileLimits';
import { confirmAction } from '../components/ConfirmDialog';

const CATEGORIES = ['assets', 'liabilities', 'equity', 'revenue', 'expenses'] as const;
const CATEGORY_LABELS: Record<string, string> = {
  assets: 'Assets',
  liabilities: 'Liabilities',
  equity: 'Equity',
  revenue: 'Revenue',
  expenses: 'Expenses',
};

const columnHelper = createColumnHelper<Account>();

const defaultNormalBalance = (category: string): 'debit' | 'credit' =>
  (category === 'assets' || category === 'expenses') ? 'debit' : 'credit';

// --- Tax Code Dropdown ---

function TaxCodeDropdown({ currentCodeId, taxCodes, onSelect }: {
  currentCodeId: number | null;
  taxCodes: TaxCode[];
  onSelect: (codeId: number | null, taxLine: string | null) => void;
}) {
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(-1);
  const listRef = useRef<HTMLDivElement>(null);
  const current = taxCodes.find((c) => c.id === currentCodeId);
  const filtered = taxCodes.filter((c) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return c.tax_code.toLowerCase().includes(q) || c.description.toLowerCase().includes(q);
  });

  useEffect(() => { setHighlightIndex(-1); }, [search]);

  useEffect(() => {
    if (highlightIndex < 0 || !listRef.current) return;
    const child = listRef.current.children[highlightIndex + 1] as HTMLElement | undefined; // +1 for unassigned button
    child?.scrollIntoView({ block: 'nearest' });
  }, [highlightIndex]);

  const selectCode = (code: TaxCode | null) => {
    onSelect(code?.id ?? null, code?.tax_code ?? null);
    setOpen(false);
    setSearch('');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') { setOpen(false); setSearch(''); return; }
    if (e.key === 'ArrowDown') { e.preventDefault(); setHighlightIndex((p) => (p < filtered.length - 1 ? p + 1 : 0)); return; }
    if (e.key === 'ArrowUp') { e.preventDefault(); setHighlightIndex((p) => (p > 0 ? p - 1 : filtered.length - 1)); return; }
    if (e.key === 'Enter' && filtered.length > 0) {
      e.preventDefault();
      const idx = highlightIndex >= 0 ? highlightIndex : 0;
      selectCode(filtered[idx]);
    }
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`w-full text-left px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 dark:text-white hover:border-blue-400 ${currentCodeId ? '' : 'text-gray-400 dark:text-gray-500 italic'}`}
      >
        {current
          ? <span><span className="font-mono font-medium">{current.tax_code}</span> — {current.description}</span>
          : '— unassigned —'}
      </button>
      {open && (
        <div className="absolute z-50 mt-1 w-96 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg">
          <div className="p-2 border-b dark:border-gray-700">
            <input
              autoFocus
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Search code or description…"
              className="w-full px-2 py-1 border border-gray-300 dark:border-gray-600 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 dark:bg-gray-700 dark:text-white dark:placeholder-gray-400"
            />
          </div>
          <div ref={listRef} className="max-h-60 overflow-y-auto">
            <button type="button" onClick={() => selectCode(null)}
              className="w-full text-left px-3 py-1.5 text-xs text-gray-400 dark:text-gray-500 italic hover:bg-gray-50 dark:hover:bg-gray-700 border-b dark:border-gray-700">
              — unassigned —
            </button>
            {filtered.length === 0
              ? <p className="px-3 py-2 text-xs text-gray-400 dark:text-gray-500">No matching codes</p>
              : filtered.map((c, idx) => (
                <button key={c.id} type="button" onClick={() => selectCode(c)}
                  className={`w-full text-left px-3 py-1.5 text-xs hover:bg-blue-50 dark:hover:bg-blue-900/20 ${
                    idx === highlightIndex ? 'bg-blue-100 dark:bg-blue-900/40 font-medium' : currentCodeId === c.id ? 'bg-blue-50 dark:bg-blue-900/20 font-medium' : ''
                  }`}>
                  <span className="font-mono font-medium text-gray-900 dark:text-white">{c.tax_code}</span>
                  <span className="text-gray-500 dark:text-gray-400 ml-1">— {c.description}</span>
                </button>
              ))
            }
          </div>
        </div>
      )}
    </div>
  );
}

// --- Account Form ---
interface AccountFormProps {
  clientId: number;
  initial?: Partial<AccountInput> & { taxCodeId?: number | null; importAliases?: string[] };
  onSave: (input: AccountInput) => void;
  onCancel: () => void;
  saving: boolean;
  error: string | null;
}

function AccountForm({ clientId, initial, onSave, onCancel, saving, error }: AccountFormProps) {
  const [form, setForm] = useState<AccountInput & { taxCodeId: number | null }>({
    accountNumber: initial?.accountNumber ?? '',
    accountName: initial?.accountName ?? '',
    category: initial?.category ?? 'assets',
    subcategory: initial?.subcategory ?? '',
    normalBalance: initial?.normalBalance ?? defaultNormalBalance(initial?.category ?? 'assets'),
    taxCodeId: initial?.taxCodeId ?? null,
    taxLine: initial?.taxLine ?? '',
    workpaperRef: initial?.workpaperRef ?? '',
    unit: initial?.unit ?? '',
    leadSheetId: initial?.leadSheetId ?? null,
  });
  const [aliases, setAliases] = useState<string[]>(initial?.importAliases ?? []);
  const [aliasInput, setAliasInput] = useState('');

  const { data: tcData } = useQuery({
    queryKey: ['tax-codes-available', clientId],
    queryFn: () => getAvailableTaxCodes(clientId),
  });
  const taxCodes = tcData?.data ?? [];

  // Same queryKey as the page-level lead sheet query below, so it MUST return
  // the same unwrapped shape — a differing queryFn on a shared key resolves to
  // whichever observer registered last.
  const { data: formLeadSheets = [] } = useQuery({
    queryKey: ['lead-sheets', clientId],
    queryFn: async () => {
      const res = await listLeadSheets(clientId);
      if (res.error) throw new Error(res.error.message);
      return res.data ?? [];
    },
  });

  const set = (field: keyof AccountInput, value: string | number) =>
    setForm((prev) => ({
      ...prev,
      [field]: value,
      // Auto-derive normal balance when category changes, unless user has already overridden it
      ...(field === 'category' ? { normalBalance: defaultNormalBalance(value as string) } : {}),
    }));

  const handleAddAlias = () => {
    const trimmed = aliasInput.trim();
    if (trimmed && !aliases.includes(trimmed)) {
      setAliases((prev) => [...prev, trimmed]);
    }
    setAliasInput('');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      ...form,
      subcategory: form.subcategory || undefined,
      taxCodeId: form.taxCodeId ?? null,
      taxLine: form.taxLine || undefined,
      workpaperRef: form.workpaperRef || undefined,
      leadSheetId: form.leadSheetId ?? null,
      importAliases: aliases,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 text-red-700 dark:text-red-400 px-3 py-2 rounded text-sm">
          {error}
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Account #</label>
          <input
            value={form.accountNumber}
            onChange={(e) => set('accountNumber', e.target.value)}
            className="w-full border border-gray-300 dark:border-gray-600 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
            required
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Account Name</label>
          <input
            value={form.accountName}
            onChange={(e) => set('accountName', e.target.value)}
            className="w-full border border-gray-300 dark:border-gray-600 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
            required
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Category</label>
          <select
            value={form.category}
            onChange={(e) => set('category', e.target.value)}
            className="w-full border border-gray-300 dark:border-gray-600 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
          >
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {CATEGORY_LABELS[c]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Subcategory</label>
          <input
            value={form.subcategory ?? ''}
            onChange={(e) => set('subcategory', e.target.value)}
            className="w-full border border-gray-300 dark:border-gray-600 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white dark:placeholder-gray-400"
            placeholder="Optional"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
            Normal Balance
            <span className="ml-1 font-normal text-gray-400 dark:text-gray-500">(auto — override for contra accounts)</span>
          </label>
          <select
            value={form.normalBalance}
            onChange={(e) => set('normalBalance', e.target.value)}
            className="w-full border border-gray-300 dark:border-gray-600 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
          >
            <option value="debit">Debit</option>
            <option value="credit">Credit</option>
          </select>
        </div>
        <div className="col-span-2">
          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Tax Code</label>
          <TaxCodeDropdown
            currentCodeId={form.taxCodeId ?? null}
            taxCodes={taxCodes}
            onSelect={(codeId, taxLine) => setForm((prev) => ({ ...prev, taxCodeId: codeId, taxLine: taxLine ?? '' }))}
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Lead Sheet</label>
          <select
            value={form.leadSheetId ?? ''}
            onChange={(e) => setForm((prev) => ({ ...prev, leadSheetId: e.target.value === '' ? null : Number(e.target.value) }))}
            className="w-full border border-gray-300 dark:border-gray-600 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
          >
            <option value="">— none —</option>
            {formLeadSheets.map((l) => (
              <option key={l.id} value={l.id}>
                {l.code ? `${l.code} — ` : ''}{l.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Workpaper Ref</label>
          <input
            value={form.workpaperRef ?? ''}
            onChange={(e) => set('workpaperRef', e.target.value)}
            className="w-full border border-gray-300 dark:border-gray-600 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white dark:placeholder-gray-400"
            placeholder="Optional"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
            Unit
            <span className="ml-1 font-normal text-gray-400 dark:text-gray-500">(e.g. property or entity)</span>
          </label>
          <input
            value={form.unit ?? ''}
            onChange={(e) => set('unit', e.target.value)}
            className="w-full border border-gray-300 dark:border-gray-600 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white dark:placeholder-gray-400"
            placeholder="Optional"
          />
        </div>
      </div>

      {/* Import Aliases */}
      <div className="border-t dark:border-gray-700 pt-3">
        <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
          Import Aliases
          <span className="ml-1 font-normal text-gray-400 dark:text-gray-500">(alternative names used in imported files — added automatically on import and rename)</span>
        </label>
        <div className="flex flex-wrap gap-1.5 mb-2 min-h-[1.75rem]">
          {aliases.length === 0 && <span className="text-xs text-gray-400 dark:text-gray-500 italic">No aliases yet</span>}
          {aliases.map((alias) => (
            <span key={alias} className="inline-flex items-center gap-1 px-2 py-0.5 bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded text-xs text-gray-700 dark:text-gray-300">
              {alias}
              <button
                type="button"
                onClick={() => setAliases((prev) => prev.filter((a) => a !== alias))}
                className="text-gray-400 dark:text-gray-500 hover:text-red-500 leading-none"
                title="Remove alias"
              >
                &times;
              </button>
            </span>
          ))}
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            value={aliasInput}
            onChange={(e) => setAliasInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddAlias(); } }}
            placeholder="Add an alias (e.g. A/R, Receivables)…"
            className="flex-1 border border-gray-300 dark:border-gray-600 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 dark:bg-gray-700 dark:text-white dark:placeholder-gray-400"
          />
          <button
            type="button"
            onClick={handleAddAlias}
            disabled={!aliasInput.trim()}
            className="px-2 py-1 text-xs bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-40 dark:text-gray-300"
          >
            Add
          </button>
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <button
          type="button"
          onClick={onCancel}
          className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-700/50 dark:text-gray-300"
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
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b dark:border-gray-700">
          <h2 className="text-base font-semibold dark:text-white">{title}</h2>
          <button onClick={onClose} aria-label="Close" className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 text-xl leading-none">&times;</button>
        </div>
        <div className="px-5 py-4">{children}</div>
      </div>
    </div>
  );
}

// --- CSV helpers ---
const VALID_CATEGORIES = new Set(['assets', 'liabilities', 'equity', 'revenue', 'expenses']);
const VALID_BALANCES   = new Set(['debit', 'credit']);

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

interface CoaMapping {
  accountNumberCol: string;
  accountNameCol: string;
  categoryCol: string;
  normalBalanceCol: string;
  subcategoryCol: string;
  taxLineCol: string;
  workpaperRefCol: string;
  leadSheetCol: string;
  unitCol: string;
}

interface MappedRow {
  accountNumber: string;
  accountName: string;
  category: string;
  normalBalance: string;
  subcategory?: string;
  taxLine?: string;
  workpaperRef?: string;
  leadSheetCode?: string;
  unit?: string;
  _errors: string[];
}

function bestMatch(headers: string[], candidates: string[]): string {
  return candidates.find((c) => headers.some((h) => h.toLowerCase() === c.toLowerCase())) ?? '';
}

function autoDetectMapping(headers: string[]): CoaMapping {
  return {
    accountNumberCol: bestMatch(headers, ['account_number', 'account #', 'acct #', 'acct_number', 'number']),
    accountNameCol:   bestMatch(headers, ['account_name', 'account name', 'name', 'description']),
    categoryCol:      bestMatch(headers, ['category', 'type', 'account_type', 'account type']),
    normalBalanceCol: bestMatch(headers, ['normal_balance', 'normal balance', 'balance_type', 'balance type']),
    subcategoryCol:   bestMatch(headers, ['subcategory', 'sub_category', 'sub category', 'sub']),
    taxLineCol:       bestMatch(headers, ['tax_line', 'tax line', 'tax_code', 'tax code', 'tax']),
    workpaperRefCol:  bestMatch(headers, ['workpaper_ref', 'workpaper ref', 'wp_ref', 'wp ref', 'workpaper']),
    leadSheetCol:     bestMatch(headers, ['lead_sheet', 'lead sheet', 'leadsheet', 'lead_sheet_code', 'ls', 'ls_code']),
    unitCol:          bestMatch(headers, ['unit', 'property', 'entity', 'division']),
  };
}

function applyMapping(dataRows: string[][], headers: string[], mapping: CoaMapping): MappedRow[] {
  const idx = (col: string) => headers.indexOf(col);
  return dataRows.map((r) => {
    const get = (col: string) => col ? (r[idx(col)] ?? '').trim() : '';
    const errors: string[] = [];
    const accountNumber = get(mapping.accountNumberCol);
    const accountName   = get(mapping.accountNameCol);
    const category      = get(mapping.categoryCol).toLowerCase();
    const rawNormalBalance = get(mapping.normalBalanceCol).toLowerCase();
    const normalBalance = rawNormalBalance || defaultNormalBalance(category);
    if (!accountNumber) errors.push('account_number required');
    if (!accountName)   errors.push('account_name required');
    if (!VALID_CATEGORIES.has(category)) errors.push(`invalid category "${category}"`);
    if (rawNormalBalance && !VALID_BALANCES.has(rawNormalBalance)) errors.push(`invalid normal_balance "${rawNormalBalance}"`);
    return {
      accountNumber, accountName, category, normalBalance,
      subcategory:  get(mapping.subcategoryCol)  || undefined,
      taxLine:      get(mapping.taxLineCol)       || undefined,
      workpaperRef: get(mapping.workpaperRefCol)  || undefined,
      leadSheetCode: get(mapping.leadSheetCol)    || undefined,
      unit:         get(mapping.unitCol)          || undefined,
      _errors: errors,
    };
  });
}

// --- ColMapRow ---
function ColMapRow({ label, headers, value, onChange, optional }: {
  label: string; headers: string[]; value: string; onChange: (v: string) => void; optional?: boolean;
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs font-medium text-gray-700 dark:text-gray-300 w-32 shrink-0">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="flex-1 border border-gray-300 dark:border-gray-600 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
      >
        <option value="">{optional ? '— skip —' : 'Select column…'}</option>
        {headers.map((h) => <option key={h} value={h}>{h}</option>)}
      </select>
    </div>
  );
}

// --- Import CSV Modal ---
interface ImportModalProps {
  clientId: number;
  onClose: () => void;
  onSuccess: () => void;
}

function ImportModal({ clientId, onClose, onSuccess }: ImportModalProps) {
  const [step, setStep] = useState<'file' | 'mapping'>('file');
  const [rawRows, setRawRows] = useState<string[][]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [mapping, setMapping] = useState<CoaMapping>({
    accountNumberCol: '', accountNameCol: '', categoryCol: '', normalBalanceCol: '',
    subcategoryCol: '', taxLineCol: '', workpaperRefCol: '', leadSheetCol: '', unitCol: '',
  });
  const [fileName, setFileName] = useState('');
  // Rows the user has unticked in the preview, by position in mappedRows.
  // Cleared whenever a new file is loaded — the positions wouldn't survive it.
  const [excluded, setExcluded] = useState<Set<number>>(new Set());
  const fileRef = useRef<HTMLInputElement>(null);

  const importMutation = useMutation({
    mutationFn: (validRows: AccountInput[]) => importAccounts(clientId, validRows),
    onSuccess: (res) => { if (!res.error) onSuccess(); },
  });

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!checkFileSize(file, 'csv')) return;
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const all = parseCsv((ev.target?.result as string).trim());
      if (all.length < 2) return;
      const hdrs = all[0].map((h) => h.trim());
      setHeaders(hdrs);
      setRawRows(all.slice(1));
      setExcluded(new Set());
      setMapping(autoDetectMapping(hdrs));
    };
    reader.readAsText(file);
  };

  const set = <K extends keyof CoaMapping>(k: K, v: string) =>
    setMapping((m) => ({ ...m, [k]: v }));

  const mappedRows = step === 'mapping' ? applyMapping(rawRows, headers, mapping) : [];
  // A row is imported only if it parsed cleanly AND the user left it ticked.
  const validRows  = mappedRows.filter((r, i) => r._errors.length === 0 && !excluded.has(i));
  const errorCount = mappedRows.filter((r) => r._errors.length > 0).length;
  const excludedCount = mappedRows.filter((_, i) => excluded.has(i)).length;

  const toggleExcluded = (i: number) => setExcluded((prev) => {
    const next = new Set(prev);
    next.has(i) ? next.delete(i) : next.add(i);
    return next;
  });

  // Select-all covers the rows that could actually be imported; rows with
  // parse errors are never importable, so they aren't counted either way.
  const importable = mappedRows.filter((r) => r._errors.length === 0).length;
  const allIncluded = importable > 0 && validRows.length === importable;
  const someIncluded = validRows.length > 0 && !allIncluded;
  const setAllIncluded = (included: boolean) => setExcluded(
    included ? new Set() : new Set(mappedRows.map((_, i) => i).filter((i) => mappedRows[i]._errors.length === 0)),
  );
  const canProceed = !!mapping.accountNumberCol && !!mapping.accountNameCol &&
                     !!mapping.categoryCol;

  const handleImport = () => {
    importMutation.mutate(validRows.map((r) => ({
      accountNumber: r.accountNumber,
      accountName:   r.accountName,
      category:      r.category as AccountInput['category'],
      normalBalance: r.normalBalance as AccountInput['normalBalance'],
      subcategory:   r.subcategory,
      taxLine:       r.taxLine,
      workpaperRef:  r.workpaperRef,
      leadSheetCode: r.leadSheetCode,
      unit:          r.unit,
    })));
  };

  const result = importMutation.data;

  const title = step === 'mapping'
    ? 'Import Chart of Accounts — Map Columns'
    : 'Import Chart of Accounts from CSV';

  return (
    <Modal title={title} onClose={onClose}>
      <div className="space-y-4">
        {result?.data ? (
          <>
            <div className="bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-700 rounded px-4 py-3 text-sm text-green-800 dark:text-green-400">
              Import complete: <strong>{result.data.inserted}</strong> inserted, <strong>{result.data.updated}</strong> updated.
            </div>
            <div className="flex justify-end">
              <button onClick={onClose} className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700">Done</button>
            </div>
          </>
        ) : step === 'file' ? (
          <>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Select any CSV file — you'll map which column maps to which field on the next step.
              Existing accounts with the same account number will be updated; new ones will be inserted.
            </p>
            <div className="bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-700 rounded p-3 text-xs">
              <p className="font-semibold text-gray-600 dark:text-gray-400 mb-1.5">Valid values</p>
              <div className="grid grid-cols-2 gap-x-6 gap-y-0.5">
                <div>
                  <span className="font-medium text-gray-700 dark:text-gray-300">category</span>
                  <ul className="mt-0.5 space-y-0.5 text-gray-500 dark:text-gray-400">
                    {([
                      ['assets', 'debit'],
                      ['liabilities', 'credit'],
                      ['equity', 'credit'],
                      ['revenue', 'credit'],
                      ['expenses', 'debit'],
                    ] as const).map(([cat, bal]) => (
                      <li key={cat}>
                        <code className="text-gray-800 dark:text-gray-200">{cat}</code>
                        <span className="text-gray-400 dark:text-gray-500 ml-1">→ defaults to <code>{bal}</code></span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <span className="font-medium text-gray-700 dark:text-gray-300">normal_balance</span>
                  <ul className="mt-0.5 space-y-0.5 text-gray-500 dark:text-gray-400">
                    <li><code className="text-gray-800 dark:text-gray-200">debit</code></li>
                    <li><code className="text-gray-800 dark:text-gray-200">credit</code></li>
                    <li className="text-gray-400 dark:text-gray-500 italic">omit to use category default</li>
                  </ul>
                </div>
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Select CSV file</label>
              <input ref={fileRef} type="file" accept=".csv,.txt" onChange={handleFile} className="text-sm text-gray-700 dark:text-gray-300" />
              {fileName && rawRows.length > 0 && (
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{fileName} — {rawRows.length} data rows, {headers.length} columns detected</p>
              )}
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={onClose} className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-700/50 dark:text-gray-300">Cancel</button>
              <button
                onClick={() => setStep('mapping')}
                disabled={rawRows.length === 0}
                className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-40"
              >
                Next: Map Columns
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="text-xs text-gray-500 dark:text-gray-400 -mt-1">
              {fileName} — {rawRows.length} rows, {headers.length} columns. Unset optional fields to skip them.
            </p>

            {/* Required */}
            <div className="space-y-2">
              <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Required</p>
              <ColMapRow label="Account Number *" headers={headers} value={mapping.accountNumberCol} onChange={(v) => set('accountNumberCol', v)} />
              <ColMapRow label="Account Name *"   headers={headers} value={mapping.accountNameCol}   onChange={(v) => set('accountNameCol', v)} />
              <ColMapRow label="Category *"        headers={headers} value={mapping.categoryCol}       onChange={(v) => set('categoryCol', v)} />
            </div>

            {/* Optional */}
            <div className="space-y-2">
              <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Optional</p>
              <ColMapRow label="Normal Balance" headers={headers} value={mapping.normalBalanceCol} onChange={(v) => set('normalBalanceCol', v)} optional />
              <ColMapRow label="Subcategory"    headers={headers} value={mapping.subcategoryCol}   onChange={(v) => set('subcategoryCol', v)}  optional />
              <ColMapRow label="Tax Line"       headers={headers} value={mapping.taxLineCol}        onChange={(v) => set('taxLineCol', v)}       optional />
              <ColMapRow label="Workpaper Ref"  headers={headers} value={mapping.workpaperRefCol}   onChange={(v) => set('workpaperRefCol', v)}  optional />
              <ColMapRow label="Lead Sheet"     headers={headers} value={mapping.leadSheetCol}      onChange={(v) => set('leadSheetCol', v)}     optional />
              <ColMapRow label="Unit"           headers={headers} value={mapping.unitCol}           onChange={(v) => set('unitCol', v)}          optional />
            </div>

            {/* Preview */}
            {canProceed && mappedRows.length > 0 && (
              <div>
                <div className="flex items-center gap-4 mb-2 text-sm">
                  <span className="text-gray-700 dark:text-gray-300">{mappedRows.length} rows</span>
                  <span className="text-green-700 dark:text-green-400 font-medium">{validRows.length} to import</span>
                  {excludedCount > 0 && <span className="text-gray-500 dark:text-gray-400 font-medium">{excludedCount} excluded</span>}
                  {errorCount > 0 && <span className="text-red-600 dark:text-red-400 font-medium">{errorCount} with errors</span>}
                </div>
                {/* Every row renders (no cap): you can't untick a row you can't see. */}
                <div className="border border-gray-200 dark:border-gray-700 rounded overflow-auto max-h-72">
                  <table className="w-full text-xs">
                    <thead className="bg-gray-50 dark:bg-gray-800/60 sticky top-0">
                      <tr>
                        <th className="px-2 py-1.5 text-center font-semibold text-gray-500 dark:text-gray-400 w-8">
                          <input
                            type="checkbox"
                            checked={allIncluded}
                            ref={(el) => { if (el) el.indeterminate = someIncluded; }}
                            onChange={(e) => setAllIncluded(e.target.checked)}
                            aria-label="Import all rows"
                            className="rounded border-gray-300 dark:border-gray-600 text-blue-600"
                          />
                        </th>
                        <th className="px-2 py-1.5 text-left font-semibold text-gray-500 dark:text-gray-400 w-5">#</th>
                        <th className="px-2 py-1.5 text-left font-semibold text-gray-500 dark:text-gray-400">Acct #</th>
                        <th className="px-2 py-1.5 text-left font-semibold text-gray-500 dark:text-gray-400">Name</th>
                        <th className="px-2 py-1.5 text-left font-semibold text-gray-500 dark:text-gray-400">Category</th>
                        <th className="px-2 py-1.5 text-left font-semibold text-gray-500 dark:text-gray-400">Bal</th>
                        <th className="px-2 py-1.5 text-left font-semibold text-gray-500 dark:text-gray-400">Issues</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                      {mappedRows.map((r, i) => (
                        <tr key={i} className={
                          r._errors.length > 0 ? 'bg-red-50 dark:bg-red-900/20'
                          : excluded.has(i) ? 'opacity-40 line-through' : ''
                        }>
                          <td className="px-2 py-1 text-center no-underline">
                            <input
                              type="checkbox"
                              checked={r._errors.length === 0 && !excluded.has(i)}
                              disabled={r._errors.length > 0}
                              onChange={() => toggleExcluded(i)}
                              aria-label={`Import row ${i + 1}`}
                              title={r._errors.length > 0 ? "This row can't be imported until its errors are fixed" : 'Untick to leave this row out of the import'}
                              className="rounded border-gray-300 dark:border-gray-600 text-blue-600 disabled:opacity-40"
                            />
                          </td>
                          <td className="px-2 py-1 text-gray-400 dark:text-gray-500">{i + 1}</td>
                          <td className="px-2 py-1 font-mono text-sm">{r.accountNumber}</td>
                          <td className="px-2 py-1 max-w-32 truncate">{r.accountName}</td>
                          <td className="px-2 py-1">{r.category}</td>
                          <td className="px-2 py-1">{r.normalBalance}</td>
                          <td className="px-2 py-1 text-red-600 dark:text-red-400">{r._errors.join('; ')}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

              </div>
            )}

            {importMutation.data?.error && (
              <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 text-red-700 dark:text-red-400 px-3 py-2 rounded text-sm">{importMutation.data.error.message}</div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setStep('file')} className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-700/50 dark:text-gray-300">Back</button>
              <button
                onClick={handleImport}
                disabled={!canProceed || validRows.length === 0 || importMutation.isPending}
                className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-40"
              >
                {importMutation.isPending ? 'Importing…' : `Import ${validRows.length} Account${validRows.length !== 1 ? 's' : ''}`}
              </button>
            </div>
          </>
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
            <div className="bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-700 rounded px-4 py-3 text-sm text-green-800 dark:text-green-400">
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
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Source Client</label>
              <select
                value={sourceId ?? ''}
                onChange={(e) => setSourceId(e.target.value ? Number(e.target.value) : null)}
                className="w-full border border-gray-300 dark:border-gray-600 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
              >
                <option value="">— Select a client —</option>
                {otherClients.map((c: Client) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            {sourceId && sourceCoaData !== undefined && (
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Source has <strong>{sourceCoaData.length}</strong> active account{sourceCoaData.length !== 1 ? 's' : ''}.
              </p>
            )}

            <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 cursor-pointer">
              <input
                type="checkbox"
                checked={overwrite}
                onChange={(e) => setOverwrite(e.target.checked)}
                className="rounded border-gray-300 dark:border-gray-600 text-blue-600"
              />
              Overwrite existing accounts with the same account number
            </label>
            <p className="text-xs text-gray-500 dark:text-gray-400 -mt-2">
              When unchecked, accounts that already exist in the destination are skipped.
            </p>

            {copyMutation.data?.error && (
              <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 text-red-700 dark:text-red-400 px-3 py-2 rounded text-sm">{copyMutation.data.error.message}</div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <button onClick={onClose} className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-700/50 dark:text-gray-300">Cancel</button>
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
// --- Bulk Edit Modal ---
interface LeadSheetOption { id: number; code: string | null; name: string }

interface BulkEditModalProps {
  clientId: number;
  accounts: Account[];
  leadSheets: LeadSheetOption[];
  onClose: () => void;
  onSuccess: (updated: number) => void;
}

type BulkField = 'category' | 'normalBalance' | 'subcategory' | 'taxCodeId' | 'leadSheetId' | 'unit';

const bulkInputCls = 'w-full border border-gray-300 dark:border-gray-600 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white dark:placeholder-gray-400 disabled:opacity-50';

function BulkFieldLabel({ field, enabled, onToggle, children }: {
  field: BulkField;
  enabled: boolean;
  onToggle: (field: BulkField, on: boolean) => void;
  children: React.ReactNode;
}) {
  return (
    <label className="flex items-center gap-2 text-xs font-medium text-gray-700 dark:text-gray-300 mb-1 cursor-pointer select-none">
      <input
        type="checkbox"
        checked={enabled}
        onChange={(e) => onToggle(field, e.target.checked)}
        className="rounded border-gray-300 dark:border-gray-600"
      />
      {children}
    </label>
  );
}

function BulkEditModal({ clientId, accounts, leadSheets, onClose, onSuccess }: BulkEditModalProps) {
  // Every field is opt-in: an unticked field is left exactly as it is on each
  // account, so re-typing thirty accounts as expenses does not also blank
  // their units or tax codes.
  const [enabled, setEnabled] = useState<Record<BulkField, boolean>>({
    category: false, normalBalance: false, subcategory: false, taxCodeId: false, leadSheetId: false, unit: false,
  });
  const [values, setValues] = useState({
    category: 'expenses' as Account['category'],
    normalBalance: 'debit' as 'debit' | 'credit',
    subcategory: '',
    taxCodeId: null as number | null,
    leadSheetId: null as number | null,
    unit: '',
  });
  const [error, setError] = useState<string | null>(null);

  const { data: tcData } = useQuery({
    queryKey: ['tax-codes-available', clientId],
    queryFn: () => getAvailableTaxCodes(clientId),
  });
  const taxCodes = tcData?.data ?? [];

  const toggle = (field: BulkField, on: boolean) => setEnabled((prev) => ({ ...prev, [field]: on }));

  // Picking a category also proposes the matching normal balance, the same
  // auto-derive the single-account form does; the user can still untick it
  // when the selection is a mix of contra and ordinary accounts.
  const setCategory = (category: Account['category']) => {
    setValues((prev) => ({ ...prev, category, normalBalance: defaultNormalBalance(category) }));
    setEnabled((prev) => ({ ...prev, category: true, normalBalance: true }));
  };

  const mutation = useMutation({
    mutationFn: (updates: BulkAccountUpdates) =>
      bulkUpdateAccounts(clientId, accounts.map((a) => a.id), updates),
    onSuccess: (r) => {
      if (r.error) { setError(r.error.message); return; }
      onSuccess(r.data.updated);
    },
  });

  const anyEnabled = Object.values(enabled).some(Boolean);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const updates: BulkAccountUpdates = {};
    if (enabled.category) updates.category = values.category;
    if (enabled.normalBalance) updates.normalBalance = values.normalBalance;
    if (enabled.subcategory) updates.subcategory = values.subcategory.trim() || null;
    if (enabled.taxCodeId) updates.taxCodeId = values.taxCodeId;
    if (enabled.leadSheetId) updates.leadSheetId = values.leadSheetId;
    if (enabled.unit) updates.unit = values.unit.trim() || null;
    setError(null);
    mutation.mutate(updates);
  };

  const shown = accounts.slice(0, 12);
  const plural = accounts.length !== 1 ? 's' : '';

  return (
    <Modal title={`Bulk Edit — ${accounts.length} account${plural}`} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 text-red-700 dark:text-red-400 px-3 py-2 rounded text-sm">
            {error}
          </div>
        )}

        <div className="text-xs text-gray-500 dark:text-gray-400">
          <p className="mb-1.5">Tick a field to change it on every selected account. Unticked fields are left as they are.</p>
          <div className="flex flex-wrap gap-1">
            {shown.map((a) => (
              <span key={a.id} title={a.account_name} className="font-mono px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300">
                {a.account_number}
              </span>
            ))}
            {accounts.length > shown.length && (
              <span className="px-1.5 py-0.5 italic">+{accounts.length - shown.length} more</span>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <BulkFieldLabel field="category" enabled={enabled.category} onToggle={toggle}>Category</BulkFieldLabel>
            <select
              value={values.category}
              onChange={(e) => setCategory(e.target.value as Account['category'])}
              disabled={!enabled.category}
              className={bulkInputCls}
            >
              {CATEGORIES.map((c) => <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>)}
            </select>
          </div>
          <div>
            <BulkFieldLabel field="normalBalance" enabled={enabled.normalBalance} onToggle={toggle}>
              Normal Balance
              <span className="font-normal text-gray-400 dark:text-gray-500">(auto from category)</span>
            </BulkFieldLabel>
            <select
              value={values.normalBalance}
              onChange={(e) => setValues((prev) => ({ ...prev, normalBalance: e.target.value as 'debit' | 'credit' }))}
              disabled={!enabled.normalBalance}
              className={bulkInputCls}
            >
              <option value="debit">Debit</option>
              <option value="credit">Credit</option>
            </select>
          </div>
          <div>
            <BulkFieldLabel field="subcategory" enabled={enabled.subcategory} onToggle={toggle}>Subcategory</BulkFieldLabel>
            <input
              value={values.subcategory}
              onChange={(e) => setValues((prev) => ({ ...prev, subcategory: e.target.value }))}
              disabled={!enabled.subcategory}
              placeholder="Leave empty to clear"
              className={bulkInputCls}
            />
          </div>
          <div>
            <BulkFieldLabel field="unit" enabled={enabled.unit} onToggle={toggle}>Unit</BulkFieldLabel>
            <input
              value={values.unit}
              onChange={(e) => setValues((prev) => ({ ...prev, unit: e.target.value }))}
              disabled={!enabled.unit}
              placeholder="Leave empty to clear"
              className={bulkInputCls}
            />
          </div>
          <div className="col-span-2">
            <BulkFieldLabel field="taxCodeId" enabled={enabled.taxCodeId} onToggle={toggle}>Tax Code</BulkFieldLabel>
            <div className={enabled.taxCodeId ? '' : 'opacity-50 pointer-events-none'}>
              <TaxCodeDropdown
                currentCodeId={values.taxCodeId}
                taxCodes={taxCodes}
                onSelect={(codeId) => setValues((prev) => ({ ...prev, taxCodeId: codeId }))}
              />
            </div>
          </div>
          <div className="col-span-2">
            <BulkFieldLabel field="leadSheetId" enabled={enabled.leadSheetId} onToggle={toggle}>Lead Sheet</BulkFieldLabel>
            <select
              value={values.leadSheetId ?? ''}
              onChange={(e) => setValues((prev) => ({ ...prev, leadSheetId: e.target.value === '' ? null : Number(e.target.value) }))}
              disabled={!enabled.leadSheetId}
              className={bulkInputCls}
            >
              <option value="">— none —</option>
              {leadSheets.map((l) => (
                <option key={l.id} value={l.id}>{l.code ? `${l.code} — ` : ''}{l.name}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-700/50 dark:text-gray-300"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!anyEnabled || mutation.isPending}
            title={anyEnabled ? undefined : 'Tick at least one field to change'}
            className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
          >
            {mutation.isPending ? 'Applying…' : `Apply to ${accounts.length} account${plural}`}
          </button>
        </div>
      </form>
    </Modal>
  );
}

// --- Main Page ---
export function ChartOfAccountsPage() {
  const { selectedClientId } = useUIStore();
  const qc = useQueryClient();
  const [sorting, setSorting] = useState<SortingState>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [editAccount, setEditAccount] = useState<Account | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [showImport, setShowImport] = useState(false);
  const [showCopy, setShowCopy] = useState(false);
  const [filterText, setFilterText] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterUnit, setFilterUnit] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [showBulkEdit, setShowBulkEdit] = useState(false);
  // Anchor for shift-click range selection — an id, not a row index, so a
  // re-sort between clicks still ranges over the rows the user can see.
  const selectAnchorRef = useRef<number | null>(null);

  useEffect(() => { setSelectedIds(new Set()); selectAnchorRef.current = null; }, [selectedClientId]);

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
    onSuccess: (r) => {
      // Errors surface via the global mutation-cache toast; skip invalidate
      // on failure so the row doesn't flicker.
      if (r.error) return;
      qc.invalidateQueries({ queryKey: ['chart-of-accounts', selectedClientId] });
    },
  });

  const availableUnits = useMemo(
    () => [...new Set((data ?? []).map((a) => a.unit).filter((u): u is string => !!u))].sort(),
    [data],
  );

  const filteredData = useMemo(
    () => (data ?? []).filter((a) => {
      if (filterCategory && a.category !== filterCategory) return false;
      if (filterUnit && a.unit !== filterUnit) return false;
      if (filterText) {
        const q = filterText.toLowerCase();
        return a.account_number.toLowerCase().includes(q) || a.account_name.toLowerCase().includes(q);
      }
      return true;
    }),
    [data, filterCategory, filterUnit, filterText],
  );

  // The selection survives filter changes on purpose (tick a few in one
  // category, switch category, tick more), so the toolbar says how many of
  // the selected rows are currently hidden — a bulk edit hits all of them.
  const selectedAccounts = useMemo(
    () => (data ?? []).filter((a) => selectedIds.has(a.id)),
    [data, selectedIds],
  );
  const visibleIds = useMemo(() => filteredData.map((a) => a.id), [filteredData]);
  const allVisibleSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedIds.has(id));
  const someVisibleSelected = visibleIds.some((id) => selectedIds.has(id));
  const hiddenSelectedCount = useMemo(() => {
    const visible = new Set(visibleIds);
    return selectedAccounts.filter((a) => !visible.has(a.id)).length;
  }, [visibleIds, selectedAccounts]);

  const toggleAllVisible = () => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allVisibleSelected) visibleIds.forEach((id) => next.delete(id));
      else visibleIds.forEach((id) => next.add(id));
      return next;
    });
    selectAnchorRef.current = null;
  };

  /** `orderedIds` is the table's current sorted order, so shift-click ranges over what is on screen. */
  const toggleRow = (id: number, orderedIds: number[], shift: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      const anchor = selectAnchorRef.current;
      const from = anchor === null ? -1 : orderedIds.indexOf(anchor);
      const to = orderedIds.indexOf(id);
      if (shift && from >= 0 && to >= 0 && from !== to) {
        const turnOn = !prev.has(id);
        const [lo, hi] = from < to ? [from, to] : [to, from];
        for (let i = lo; i <= hi; i++) {
          if (turnOn) next.add(orderedIds[i]); else next.delete(orderedIds[i]);
        }
      } else if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
    selectAnchorRef.current = id;
  };

  // Lead sheet codes for the column and the add/edit form's dropdown. Kept in
  // its own query so it stays fresh when the Lead Sheets page edits them.
  const { data: leadSheets = [] } = useQuery({
    queryKey: ['lead-sheets', selectedClientId],
    enabled: !!selectedClientId,
    queryFn: async () => {
      const res = await listLeadSheets(selectedClientId!);
      if (res.error) throw new Error(res.error.message);
      return res.data ?? [];
    },
  });
  const leadSheetById = useMemo(
    () => new Map(leadSheets.map((l) => [l.id, l])),
    [leadSheets],
  );

  const columns = [
    columnHelper.display({
      id: 'select',
      enableSorting: false,
      header: () => (
        <input
          type="checkbox"
          aria-label={allVisibleSelected ? 'Deselect all shown accounts' : 'Select all shown accounts'}
          checked={allVisibleSelected}
          ref={(el) => { if (el) el.indeterminate = !allVisibleSelected && someVisibleSelected; }}
          onChange={toggleAllVisible}
          disabled={visibleIds.length === 0}
          className="rounded border-gray-300 dark:border-gray-600 cursor-pointer"
        />
      ),
      cell: ({ row, table }) => (
        <input
          type="checkbox"
          aria-label={`Select ${row.original.account_number}`}
          checked={selectedIds.has(row.original.id)}
          onChange={() => { /* handled in onClick so the shift key is visible */ }}
          onClick={(e) => toggleRow(
            row.original.id,
            table.getRowModel().rows.map((r) => r.original.id),
            e.shiftKey,
          )}
          className="rounded border-gray-300 dark:border-gray-600 cursor-pointer"
        />
      ),
    }),
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
    columnHelper.accessor('tax_code_id', {
      header: 'Tax Code',
      cell: (info) => {
        const acct = info.row.original;
        if (!acct.tax_code_id) return <span className="text-gray-300">—</span>;
        return <span className="font-mono text-xs">{acct.tax_line ?? `#${acct.tax_code_id}`}</span>;
      },
    }),
    columnHelper.accessor('lead_sheet_id', {
      header: 'Lead Sheet',
      cell: (info) => {
        const ls = info.getValue() !== null ? leadSheetById.get(info.getValue()!) : undefined;
        if (!ls) return <span className="text-gray-300 dark:text-gray-600">—</span>;
        return (
          <span
            title={ls.name}
            className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300"
          >
            <span className="font-mono mr-1">{ls.code ?? '—'}</span>
            {ls.name}
          </span>
        );
      },
    }),
    columnHelper.accessor('workpaper_ref', {
      header: 'W/P Ref',
      cell: (info) => info.getValue() ?? <span className="text-gray-300">—</span>,
    }),
    columnHelper.accessor('unit', {
      header: 'Unit',
      cell: (info) => info.getValue() ?? <span className="text-gray-300">—</span>,
    }),
    columnHelper.display({
      id: 'actions',
      header: '',
      enableSorting: false,
      cell: ({ row }) => (
        <div className="flex items-center gap-2 justify-end">
          <button
            onClick={() => { setEditAccount(row.original); setFormError(null); }}
            className="text-xs text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
          >
            Edit
          </button>
          <button
            onClick={async () => {
              if (await confirmAction({ message: `Delete "${row.original.account_name}"?`, tone: 'danger' })) {
                deleteMutation.mutate(row.original.id);
              }
            }}
            className="text-xs text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
          >
            Delete
          </button>
        </div>
      ),
    }),
  ];

  const table = useReactTable({
    data: filteredData,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  if (!selectedClientId) {
    return (
      <div className="flex items-center justify-center h-full text-gray-400 dark:text-gray-500">
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
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Chart of Accounts</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            {data ? `${data.length} account${data.length !== 1 ? 's' : ''}` : ''}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowImport(true)}
            className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-700/50 dark:text-gray-300"
          >
            Import CSV
          </button>
          <button
            onClick={() => setShowCopy(true)}
            className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-700/50 dark:text-gray-300"
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
        <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 text-red-700 dark:text-red-400 px-4 py-3 rounded text-sm mb-4">
          {error.message}
        </div>
      )}

      {/* Filter bar */}
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <input
          type="text"
          value={filterText}
          onChange={(e) => setFilterText(e.target.value)}
          placeholder="Search accounts…"
          className="border border-gray-300 dark:border-gray-600 rounded px-2 py-1.5 text-sm w-52 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white dark:placeholder-gray-400"
        />
        <select
          value={filterCategory}
          onChange={(e) => setFilterCategory(e.target.value)}
          className="border border-gray-300 dark:border-gray-600 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
        >
          <option value="">All categories</option>
          <option value="assets">Assets</option>
          <option value="liabilities">Liabilities</option>
          <option value="equity">Equity</option>
          <option value="revenue">Revenue</option>
          <option value="expenses">Expenses</option>
        </select>
        {availableUnits.length > 0 && (
          <select
            value={filterUnit}
            onChange={(e) => setFilterUnit(e.target.value)}
            className="border border-gray-300 dark:border-gray-600 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
          >
            <option value="">All units</option>
            {availableUnits.map((u) => <option key={u} value={u}>{u}</option>)}
          </select>
        )}
        {(filterText || filterCategory || filterUnit) && (
          <>
            <button
              onClick={() => { setFilterText(''); setFilterCategory(''); setFilterUnit(''); }}
              className="text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 px-2 py-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              Clear
            </button>
            <span className="text-xs text-gray-500 dark:text-gray-400">
              {filteredData.length} of {data?.length ?? 0} accounts
            </span>
          </>
        )}
      </div>

      {selectedAccounts.length > 0 && (
        <div className="flex items-center gap-3 mb-3 px-3 py-2 rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20 text-sm flex-wrap">
          <span className="font-medium text-blue-800 dark:text-blue-300">
            {selectedAccounts.length} account{selectedAccounts.length !== 1 ? 's' : ''} selected
          </span>
          {hiddenSelectedCount > 0 && (
            <span className="text-xs text-blue-700/80 dark:text-blue-300/80">
              ({hiddenSelectedCount} hidden by the current filter — still included)
            </span>
          )}
          <button
            onClick={() => setShowBulkEdit(true)}
            className="px-3 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700 transition-colors"
          >
            Bulk Edit…
          </button>
          <button
            onClick={() => { setSelectedIds(new Set()); selectAnchorRef.current = null; }}
            className="text-xs text-blue-700 dark:text-blue-300 hover:underline"
          >
            Clear selection
          </button>
          <span className="ml-auto text-xs text-blue-700/70 dark:text-blue-300/70">Shift-click to select a range</span>
        </div>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center py-12 text-gray-400 dark:text-gray-500">Loading...</div>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                {table.getHeaderGroups().map((hg) => (
                  <tr key={hg.id} className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/60">
                    {hg.headers.map((header) => (
                      <th
                        key={header.id}
                        className={`px-3 py-2.5 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider whitespace-nowrap select-none ${header.column.getCanSort() ? 'cursor-pointer' : ''}`}
                        onClick={header.column.getCanSort() ? header.column.getToggleSortingHandler() : undefined}
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
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {table.getRowModel().rows.length === 0 ? (
                  <tr>
                    <td colSpan={columns.length} className="px-3 py-8 text-center text-gray-400 dark:text-gray-500">
                      {(filterText || filterCategory || filterUnit)
                        ? 'No accounts match the current filter.'
                        : 'No accounts yet. Click \u201c+ Add Account\u201d to get started.'}
                    </td>
                  </tr>
                ) : (
                  table.getRowModel().rows.map((row) => (
                    <tr
                      key={row.id}
                      className={`transition-colors ${selectedIds.has(row.original.id)
                        ? 'bg-blue-50 dark:bg-blue-900/20'
                        : 'hover:bg-gray-50 dark:hover:bg-gray-700/50'}`}
                    >
                      {row.getVisibleCells().map((cell) => (
                        <td key={cell.id} className="px-3 py-2.5 text-gray-700 dark:text-gray-300">
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
              taxCodeId: editAccount.tax_code_id,
              taxLine: editAccount.tax_line ?? undefined,
              workpaperRef: editAccount.workpaper_ref ?? undefined,
              unit: editAccount.unit ?? undefined,
              leadSheetId: editAccount.lead_sheet_id,
              importAliases: editAccount.import_aliases ?? [],
            }}
            onSave={(input) => updateMutation.mutate({ id: editAccount.id, input })}
            onCancel={() => setEditAccount(null)}
            saving={updateMutation.isPending}
            error={formError}
          />
        </Modal>
      )}

      {showBulkEdit && selectedAccounts.length > 0 && (
        <BulkEditModal
          clientId={selectedClientId}
          accounts={selectedAccounts}
          leadSheets={leadSheets}
          onClose={() => setShowBulkEdit(false)}
          onSuccess={(updated) => {
            qc.invalidateQueries({ queryKey: ['chart-of-accounts', selectedClientId] });
            pushToast(`Updated ${updated} account${updated !== 1 ? 's' : ''}.`, 'success');
            setShowBulkEdit(false);
            setSelectedIds(new Set());
            selectAnchorRef.current = null;
          }}
        />
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
  assets: 'bg-blue-50 dark:bg-blue-900/40 text-blue-700 dark:text-blue-400',
  liabilities: 'bg-orange-50 dark:bg-orange-900/40 text-orange-700 dark:text-orange-400',
  equity: 'bg-purple-50 dark:bg-purple-900/40 text-purple-700 dark:text-purple-400',
  revenue: 'bg-green-50 dark:bg-green-900/40 text-green-700 dark:text-green-400',
  expenses: 'bg-red-50 dark:bg-red-900/40 text-red-700 dark:text-red-400',
};
