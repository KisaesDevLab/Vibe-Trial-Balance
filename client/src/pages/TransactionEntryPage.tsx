import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { evalAmountExpr, evalAndFormatAmount } from '../utils/evalAmountExpr';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { listPayees, listBankTransactions, createManualTransactions, updateBankTransaction, deleteBankTransaction, type Payee, type ManualTransaction } from '../api/bankTransactions';
import { listAccounts, type Account } from '../api/chartOfAccounts';
import { useUIStore } from '../store/uiStore';
import { DateInput } from '../components/DateInput';

// Shared class for all register input controls — keeps height and font consistent
const inputCls = 'w-full px-1.5 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded focus:outline-none focus:ring-1 focus:ring-blue-400 dark:bg-gray-700 dark:text-white';

// ---- Helpers ----

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function fmt(cents: number): string {
  if (cents === 0) return '—';
  const abs = Math.abs(cents);
  const str = (abs / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return cents < 0 ? `(${str})` : str;
}

function fmtColor(cents: number): string {
  if (cents === 0) return 'text-gray-400 dark:text-gray-500';
  return cents < 0 ? 'text-red-600 dark:text-red-400' : 'text-green-700 dark:text-green-400';
}

// Parse dollar input like "1234.56" or "-1234.56" (or expressions like "94+4") to cents
function parseDollarInput(s: string): number | null {
  const cleaned = evalAmountExpr(s).replace(/[^0-9.\-]/g, '');
  if (!cleaned || cleaned === '-') return null;
  const val = parseFloat(cleaned);
  if (isNaN(val)) return null;
  return Math.round(val * 100);
}

let nextRowId = 1;
function makeRow(sourceAccountId: number | null = null): RegisterRow {
  return {
    _id: nextRowId++,
    sourceAccountId,
    date: todayIso(),
    ref: '',
    payee: '',
    accountId: null,
    amountStr: '',
    saved: false,
  };
}

interface RegisterRow {
  _id: number;
  id?: number;           // DB id — present for rows loaded from / already saved to the DB
  sourceAccountId: number | null;
  date: string;
  ref: string;
  payee: string;
  accountId: number | null;
  amountStr: string;
  saved: boolean;
  _incomplete?: boolean;
}

// Column indices (used for data-col attributes and navigation)
const COL_SOURCE = 0;
const COL_DATE   = 1;
const COL_REF    = 2;
const COL_PAYEE  = 3;
const COL_CAT    = 4;
const COL_AMT    = 5;
const TOTAL_COLS = 6;

// ---- Payee combo dropdown ----

interface PayeeDropdownProps {
  value: string;
  payees: Payee[];
  onChange: (value: string, payee: Payee | null) => void;
  onBlur?: () => void;
  inputRef?: React.RefObject<HTMLInputElement | null>;
  hasRule: boolean;
  onNavigate?: (dir: 'next' | 'prev' | 'up' | 'down') => void;
  dataRow?: number;
  dataCol?: number;
}

function PayeeCombo({ value, payees, onChange, onBlur, inputRef, hasRule, onNavigate, dataRow, dataCol }: PayeeDropdownProps) {
  const [open, setOpen] = useState(false);
  const [localVal, setLocalVal] = useState(value);
  const [cursor, setCursor] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setLocalVal(value); }, [value]);

  const filtered = useMemo(() => {
    if (!localVal.trim()) return payees.slice(0, 20);
    const q = localVal.toLowerCase();
    return payees.filter((p) => p.payee.toLowerCase().includes(q)).slice(0, 20);
  }, [localVal, payees]);

  function select(payee: Payee) {
    setLocalVal(payee.payee);
    setOpen(false);
    onChange(payee.payee, payee);
  }

  function commitAndNavigate(dir: 'next' | 'prev' | 'up' | 'down') {
    if (open) {
      setOpen(false);
      onChange(localVal, payees.find((p) => p.payee === localVal) ?? null);
    }
    onNavigate?.(dir);
  }

  function handleKey(e: React.KeyboardEvent) {
    // Tab always navigates (Excel: Tab moves to next cell)
    if (e.key === 'Tab') {
      commitAndNavigate(e.shiftKey ? 'prev' : 'next');
      e.preventDefault();
      return;
    }

    if (!open) {
      // Enter moves down (Excel behavior when cell is not being edited in a dropdown sense)
      if (e.key === 'Enter') { onNavigate?.('down'); e.preventDefault(); return; }
      // ArrowDown opens suggestions; ArrowUp moves row up
      if (e.key === 'ArrowDown') { setOpen(true); setCursor(0); e.preventDefault(); }
      if (e.key === 'ArrowUp')   { onNavigate?.('up'); e.preventDefault(); }
      return;
    }

    // Dropdown is open
    if (e.key === 'Escape') { setOpen(false); return; }
    if (e.key === 'ArrowDown') {
      setCursor((c) => Math.min(c + 1, filtered.length - 1));
      e.preventDefault();
    }
    if (e.key === 'ArrowUp') {
      if (cursor <= 0) { setOpen(false); onNavigate?.('up'); e.preventDefault(); return; }
      setCursor((c) => Math.max(c - 1, 0));
      e.preventDefault();
    }
    if (e.key === 'Enter') {
      if (cursor >= 0 && filtered[cursor]) {
        select(filtered[cursor]);
      } else {
        setOpen(false);
        onChange(localVal, payees.find((p) => p.payee === localVal) ?? null);
        onNavigate?.('down');
      }
      e.preventDefault();
    }
  }

  // Close on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div ref={containerRef} className="relative w-full">
      <div className="flex items-center gap-1">
        <input
          ref={inputRef as React.RefObject<HTMLInputElement>}
          type="text"
          value={localVal}
          data-row={dataRow}
          data-col={dataCol}
          className={inputCls}
          placeholder="Payee name..."
          onChange={(e) => {
            setLocalVal(e.target.value);
            setOpen(true);
            setCursor(-1);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => {
            onChange(localVal, payees.find((p) => p.payee === localVal) ?? null);
            onBlur?.();
          }}
          onKeyDown={handleKey}
        />
        {hasRule && (
          <span className="text-[10px] bg-blue-100 text-blue-700 px-1 rounded shrink-0">rule</span>
        )}
      </div>
      {open && (
        <div className="absolute z-50 left-0 top-full mt-0.5 w-64 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded shadow-lg max-h-56 overflow-y-auto text-xs">
          {filtered.length === 0 && (
            <div className="px-3 py-2 text-gray-400 dark:text-gray-500 italic">No matches — will create new payee</div>
          )}
          {filtered.map((p, i) => (
            <button
              key={p.payee}
              type="button"
              className={`w-full text-left px-3 py-1.5 hover:bg-blue-50 dark:hover:bg-blue-900/20 flex items-center justify-between gap-2 ${i === cursor ? 'bg-blue-50 dark:bg-blue-900/20' : ''}`}
              onMouseDown={(e) => { e.preventDefault(); select(p); }}
            >
              <span className="font-medium truncate dark:text-gray-200">{p.payee}</span>
              {p.categories[0] && (
                <span className="text-gray-400 dark:text-gray-500 shrink-0 text-[10px]">
                  {p.categories[0].accountNumber} ({p.categories[0].count}×)
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ---- Category combo dropdown ----

interface CategoryComboProps {
  value: number | null;
  accounts: Account[];
  payeeCategories: Array<{ accountId: number; accountNumber: string; accountName: string; count: number }>;
  payeeName: string;
  onChange: (id: number | null) => void;
  onNavigate?: (dir: 'next' | 'prev' | 'up' | 'down') => void;
  dataRow?: number;
  dataCol?: number;
}

function CategoryCombo({ value, accounts, payeeCategories, payeeName, onChange, onNavigate, dataRow, dataCol }: CategoryComboProps) {
  const selectedAccount = accounts.find((a) => a.id === value);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [cursor, setCursor] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // When dropdown opens, position cursor on the currently-selected item (if any)
  useEffect(() => {
    if (!open) return;
    const idx = flatItems.findIndex((item) => item.id === value);
    setCursor(idx >= 0 ? idx : -1);
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  // Scroll the highlighted item into view whenever the cursor moves
  useEffect(() => {
    if (!listRef.current || cursor < 0) return;
    const item = listRef.current.querySelector<HTMLElement>(`[data-idx="${cursor}"]`);
    item?.scrollIntoView({ block: 'nearest' });
  }, [cursor]);

  // Display label for the selected account
  const displayValue = selectedAccount
    ? `${selectedAccount.account_number} - ${selectedAccount.account_name}`
    : '';

  function openDropdown() {
    setSearch('');
    setCursor(-1);
    setOpen(true);
    setTimeout(() => inputRef.current?.select(), 0);
  }

  const usedIds = new Set(payeeCategories.map((c) => c.accountId));

  const filteredPrev = useMemo(() => {
    if (!search.trim()) return payeeCategories;
    const q = search.toLowerCase();
    return payeeCategories.filter(
      (c) => c.accountNumber.toLowerCase().includes(q) || c.accountName.toLowerCase().includes(q),
    );
  }, [search, payeeCategories]);

  const filteredAll = useMemo(() => {
    const base = accounts.filter((a) => !usedIds.has(a.id));
    if (!search.trim()) return base;
    const q = search.toLowerCase();
    return base.filter(
      (a) => a.account_number.toLowerCase().includes(q) || a.account_name.toLowerCase().includes(q),
    );
  }, [search, accounts, usedIds]); // eslint-disable-line react-hooks/exhaustive-deps

  // Flat list for keyboard cursor: prev section first, then all section
  const flatItems = useMemo(
    () => [
      ...filteredPrev.map((c) => ({ id: c.accountId, label: `${c.accountNumber} - ${c.accountName}`, count: c.count, isPrev: true })),
      ...filteredAll.map((a) => ({ id: a.id, label: `${a.account_number} - ${a.account_name}`, count: 0, isPrev: false })),
    ],
    [filteredPrev, filteredAll],
  );

  function select(id: number) {
    onChange(id);
    setOpen(false);
    setSearch('');
  }

  function handleKey(e: React.KeyboardEvent) {
    // Tab always navigates, closing dropdown if open
    if (e.key === 'Tab') {
      if (open) { setOpen(false); setSearch(''); }
      onNavigate?.(e.shiftKey ? 'prev' : 'next');
      e.preventDefault();
      return;
    }

    if (!open) {
      // Enter / F2 opens the dropdown (Excel: F2 edits cell)
      if (e.key === 'Enter' || e.key === 'F2') { openDropdown(); e.preventDefault(); return; }
      // Arrow keys navigate rows (Excel behavior when cell is not in edit mode)
      if (e.key === 'ArrowDown') { onNavigate?.('down'); e.preventDefault(); return; }
      if (e.key === 'ArrowUp')   { onNavigate?.('up');   e.preventDefault(); return; }
      // Printable character — open and seed search with the typed char
      if (e.key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey) {
        setSearch(e.key);
        setCursor(-1);
        setOpen(true);
        setTimeout(() => {
          if (inputRef.current) {
            inputRef.current.focus();
            inputRef.current.setSelectionRange(1, 1);
          }
        }, 0);
        e.preventDefault();
        return;
      }
      return;
    }

    // Dropdown is open
    if (e.key === 'Escape') { setOpen(false); setSearch(''); return; }
    if (e.key === 'ArrowDown') {
      setCursor((c) => Math.min(c + 1, flatItems.length - 1));
      e.preventDefault();
    }
    if (e.key === 'ArrowUp') {
      if (cursor <= 0) { setOpen(false); setSearch(''); onNavigate?.('up'); e.preventDefault(); return; }
      setCursor((c) => Math.max(c - 1, 0));
      e.preventDefault();
    }
    if (e.key === 'Enter') {
      if (cursor >= 0 && flatItems[cursor]) {
        select(flatItems[cursor].id);
      } else {
        setOpen(false);
        setSearch('');
        onNavigate?.('down');
      }
      e.preventDefault();
    }
  }

  // Close on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div ref={containerRef} className="relative w-full">
      {open ? (
        <input
          ref={inputRef}
          autoFocus
          type="text"
          value={search}
          data-row={dataRow}
          data-col={dataCol}
          placeholder="Search accounts…"
          className="w-full px-1.5 py-1 text-sm border border-blue-400 dark:border-blue-500 rounded focus:outline-none ring-1 ring-blue-400 dark:ring-blue-500 dark:bg-gray-700 dark:text-white"
          onChange={(e) => { setSearch(e.target.value); setCursor(-1); }}
          onKeyDown={handleKey}
          onBlur={() => { setOpen(false); setSearch(''); }}
        />
      ) : (
        <div
          tabIndex={0}
          data-row={dataRow}
          data-col={dataCol}
          className="w-full px-1.5 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded cursor-pointer hover:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400 bg-white dark:bg-gray-700 dark:text-white truncate"
          onClick={openDropdown}
          onFocus={openDropdown}
          onKeyDown={handleKey}
        >
          {displayValue || <span className="text-gray-400 dark:text-gray-500">— account —</span>}
        </div>
      )}
      {open && (
        <div ref={listRef} className="absolute z-50 left-0 top-full mt-0.5 w-72 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded shadow-lg max-h-64 overflow-y-auto text-xs">
          {flatItems.length === 0 && (
            <div className="px-3 py-2 text-gray-400 dark:text-gray-500 italic">No accounts match</div>
          )}
          {filteredPrev.length > 0 && (
            <>
              <div className="px-3 py-1 text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider bg-gray-50 dark:bg-gray-800/60 border-b border-gray-100 dark:border-gray-700">
                Previously used for {payeeName || 'this payee'}
              </div>
              {filteredPrev.map((c, i) => (
                <button
                  key={c.accountId}
                  data-idx={i}
                  type="button"
                  className={`w-full text-left px-3 py-1.5 hover:bg-blue-50 dark:hover:bg-blue-900/20 flex items-center justify-between gap-2 ${cursor === i ? 'bg-blue-50 dark:bg-blue-900/20' : ''}`}
                  onMouseDown={(e) => { e.preventDefault(); select(c.accountId); }}
                >
                  <span className="truncate dark:text-gray-200">{c.accountNumber} - {c.accountName}</span>
                  <span className="text-gray-400 dark:text-gray-500 shrink-0 text-[10px]">{c.count}×</span>
                </button>
              ))}
            </>
          )}
          {filteredAll.length > 0 && (
            <>
              {filteredPrev.length > 0 && (
                <div className="px-3 py-1 text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider bg-gray-50 dark:bg-gray-800/60 border-y border-gray-100 dark:border-gray-700">
                  All accounts
                </div>
              )}
              {filteredAll.map((a, i) => {
                const flatIdx = filteredPrev.length + i;
                return (
                  <button
                    key={a.id}
                    data-idx={flatIdx}
                    type="button"
                    className={`w-full text-left px-3 py-1.5 hover:bg-blue-50 dark:hover:bg-blue-900/20 dark:text-gray-200 ${cursor === flatIdx ? 'bg-blue-50 dark:bg-blue-900/20' : ''}`}
                    onMouseDown={(e) => { e.preventDefault(); select(a.id); }}
                  >
                    {a.account_number} - {a.account_name}
                  </button>
                );
              })}
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ---- Main page ----

export function TransactionEntryPage() {
  const { selectedClientId, selectedPeriodId } = useUIStore();
  const queryClient = useQueryClient();

  const [rows, setRows] = useState<RegisterRow[]>([makeRow()]);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  // Map from _id to payee object (for smart category)
  const [payeeMap, setPayeeMap] = useState<Map<number, Payee>>(new Map());

  // Keep a stable ref to rows.length for the navigation callback
  const rowsRef = useRef(rows);
  useEffect(() => { rowsRef.current = rows; }, [rows]);

  const tableRef = useRef<HTMLTableElement>(null);

  // Central navigation function — Tab/Enter/Arrow all funnel through here
  const navigateCell = useCallback((rowIdx: number, colIdx: number, dir: 'next' | 'prev' | 'up' | 'down') => {
    let r = rowIdx, c = colIdx;
    if (dir === 'next')      { c++; if (c >= TOTAL_COLS) { c = 0; r++; } }
    else if (dir === 'prev') { c--; if (c < 0) { c = TOTAL_COLS - 1; r--; } }
    else if (dir === 'down') { r++; }
    else                     { r--; }
    if (r < 0 || r >= rowsRef.current.length) return;
    const el = tableRef.current?.querySelector<HTMLElement>(`[data-row="${r}"][data-col="${c}"]`);
    if (el) { el.focus(); if (el instanceof HTMLInputElement) el.select(); }
  }, []);

  // Helper: build an onKeyDown for plain <input> cells
  // skipArrows = true for date inputs (browser uses arrows to step the date value)
  function makeCellKeyDown(rowIdx: number, colIdx: number, skipArrows = false) {
    return (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Tab') {
        e.preventDefault();
        navigateCell(rowIdx, colIdx, e.shiftKey ? 'prev' : 'next');
      } else if (e.key === 'Enter') {
        e.preventDefault();
        navigateCell(rowIdx, colIdx, e.shiftKey ? 'up' : 'down');
      } else if (!skipArrows) {
        if (e.key === 'ArrowDown') { e.preventDefault(); navigateCell(rowIdx, colIdx, 'down'); }
        if (e.key === 'ArrowUp')   { e.preventDefault(); navigateCell(rowIdx, colIdx, 'up'); }
      }
    };
  }

  const { data: payeesData } = useQuery({
    queryKey: ['payees', selectedClientId],
    queryFn: () => listPayees(selectedClientId!),
    enabled: !!selectedClientId,
    select: (r) => r.data ?? [],
  });

  const { data: accountsData } = useQuery({
    queryKey: ['accounts', selectedClientId],
    queryFn: () => listAccounts(selectedClientId!),
    enabled: !!selectedClientId,
    select: (r) => r.data ?? [],
  });

  // Load existing manual transactions so they reappear when navigating back
  const { data: savedTxData } = useQuery({
    queryKey: ['bank-transactions', selectedClientId, 'manual-register', selectedPeriodId],
    queryFn: () => listBankTransactions(selectedClientId!, {
      status: 'manual',
      periodId: selectedPeriodId ?? undefined,
    }),
    enabled: !!selectedClientId,
    select: (r) => (r.data ?? []).slice().sort((a, b) => a.transaction_date.localeCompare(b.transaction_date)),
  });

  // Seed rows from DB on first load (only runs once per mount when data arrives)
  const seededRef = useRef(false);
  useEffect(() => {
    if (!savedTxData || seededRef.current) return;
    seededRef.current = true;
    const savedRows: RegisterRow[] = savedTxData.map((tx) => ({
      _id: nextRowId++,
      id: tx.id,
      sourceAccountId: tx.source_account_id ?? null,
      date: tx.transaction_date.slice(0, 10),
      ref: tx.check_number ?? '',
      payee: tx.description ?? '',
      accountId: tx.account_id ?? null,
      amountStr: (tx.amount / 100).toFixed(2),
      saved: true,
    }));
    const lastSrcId = savedRows[savedRows.length - 1]?.sourceAccountId ?? null;
    setRows([...savedRows, makeRow(lastSrcId)]);
  }, [savedTxData]);

  const payees: Payee[] = payeesData ?? [];
  const accounts: Account[] = accountsData ?? [];

  // Stat cards
  const unsavedRows = rows.filter((r) => !r.saved);
  const statDebits = useMemo(() => {
    return unsavedRows.reduce((sum, r) => {
      const cents = parseDollarInput(r.amountStr);
      return cents !== null && cents < 0 ? sum + cents : sum;
    }, 0);
  }, [unsavedRows]);
  const statCredits = useMemo(() => {
    return unsavedRows.reduce((sum, r) => {
      const cents = parseDollarInput(r.amountStr);
      return cents !== null && cents > 0 ? sum + cents : sum;
    }, 0);
  }, [unsavedRows]);
  const statNet = statCredits + statDebits;

  // Auto-add row when last row has payee, carrying the source account forward
  useEffect(() => {
    const last = rows[rows.length - 1];
    if (last && !last.saved && last.payee.trim()) {
      setRows((prev) => [...prev, makeRow(last.sourceAccountId)]);
    }
  }, [rows]);

  function updateRow(id: number, patch: Partial<RegisterRow>) {
    setRows((prev) => prev.map((r) => {
      if (r._id !== id) return r;
      // If the user edited a data field on a saved row, mark it unsaved so it gets re-saved
      const unsave = r.saved && !('saved' in patch);
      return { ...r, ...patch, _incomplete: false, ...(unsave ? { saved: false } : {}) };
    }));
  }

  async function deleteRow(id: number) {
    const row = rows.find((r) => r._id === id);
    // If the row has a DB id, delete it from the server first
    if (row?.id) {
      const res = await deleteBankTransaction(selectedClientId!, row.id);
      if (res.error) { showToast(`Delete failed: ${res.error.message}`, 'error'); return; }
      queryClient.invalidateQueries({ queryKey: ['bank-transactions', selectedClientId] });
      queryClient.invalidateQueries({ queryKey: ['journal-entries'] });
      queryClient.invalidateQueries({ queryKey: ['trial-balance'] });
      queryClient.invalidateQueries({ queryKey: ['bank-transactions', selectedClientId, 'manual-register', selectedPeriodId] });
    }
    setRows((prev) => {
      const next = prev.filter((r) => r._id !== id);
      return next.length === 0 ? [makeRow()] : next;
    });
    setPayeeMap((m) => { const n = new Map(m); n.delete(id); return n; });
    showToast('Transaction deleted.', 'success');
  }

  function duplicateRow(id: number) {
    const row = rows.find((r) => r._id === id);
    if (!row) return;
    const clone: RegisterRow = { ...makeRow(row.sourceAccountId), date: row.date, ref: row.ref, payee: row.payee, saved: false };
    // Copy payee mapping
    const existingPayee = payeeMap.get(id);
    if (existingPayee) {
      setPayeeMap((m) => { const n = new Map(m); n.set(clone._id, existingPayee); return n; });
      // Auto-fill account from rule
      if (existingPayee.ruleAccountId) clone.accountId = existingPayee.ruleAccountId;
    }
    setRows((prev) => {
      const idx = prev.findIndex((r) => r._id === id);
      const next = [...prev];
      next.splice(idx + 1, 0, clone);
      return next;
    });
  }

  function onPayeeSelect(rowId: number, value: string, payee: Payee | null) {
    const patch: Partial<RegisterRow> = { payee: value };
    if (payee) {
      setPayeeMap((m) => { const n = new Map(m); n.set(rowId, payee); return n; });
      // Auto-fill category from rule, or most used
      if (payee.ruleAccountId) patch.accountId = payee.ruleAccountId;
      else if (payee.categories[0]) patch.accountId = payee.categories[0].accountId;
    } else {
      setPayeeMap((m) => { const n = new Map(m); n.delete(rowId); return n; });
    }
    updateRow(rowId, patch);
  }

  function showToast(message: string, type: 'success' | 'error') {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  }

  const saveMutation = useMutation({
    mutationFn: async ({
      creates,
      updates,
    }: {
      creates: { row: RegisterRow; tx: ManualTransaction }[];
      updates: { row: RegisterRow; tx: ManualTransaction }[];
    }) => {
      const errors: string[] = [];

      // Run updates in parallel
      if (updates.length > 0) {
        const results = await Promise.all(
          updates.map(({ row, tx }) =>
            updateBankTransaction(selectedClientId!, row.id!, {
              transactionDate: tx.transactionDate,
              description: tx.description,
              amount: tx.amount,
              checkNumber: tx.checkNumber ?? null,
              accountId: tx.accountId,
              sourceAccountId: tx.sourceAccountId ?? null,
              periodId: selectedPeriodId ?? null,
            }),
          ),
        );
        results.forEach((r, i) => {
          if (r.error) errors.push(`Update row "${updates[i].tx.description}": ${r.error.message}`);
        });
      }

      // Create new transactions
      let created = 0;
      let rulesUpdated = 0;
      if (creates.length > 0) {
        const result = await createManualTransactions(
          selectedClientId!,
          selectedPeriodId ?? null,
          creates.map((c) => c.tx),
        );
        if (result.error) {
          errors.push(result.error.message);
        } else {
          created = result.data?.created ?? 0;
          rulesUpdated = result.data?.rulesUpdated ?? 0;
        }
      }

      return { errors, created, rulesUpdated, updatedCount: updates.length - (errors.length) };
    },
    onSuccess: ({ errors, created, rulesUpdated, updatedCount }) => {
      if (errors.length > 0) {
        showToast(`Save errors: ${errors.join('; ')}`, 'error');
        return;
      }
      const parts: string[] = [];
      if (created > 0) parts.push(`${created} created`);
      if (updatedCount > 0) parts.push(`${updatedCount} updated`);
      if (rulesUpdated > 0) parts.push(`${rulesUpdated} rule${rulesUpdated !== 1 ? 's' : ''} updated`);
      showToast(parts.join(', ') + '.', 'success');
      setRows((prev) => prev.map((r) => (!r.saved ? { ...r, saved: true, _incomplete: false } : r)));
      queryClient.invalidateQueries({ queryKey: ['payees', selectedClientId] });
      queryClient.invalidateQueries({ queryKey: ['bank-transactions', selectedClientId] });
      queryClient.invalidateQueries({ queryKey: ['bank-transactions', selectedClientId, 'manual-register', selectedPeriodId] });
    },
    onError: (err) => {
      showToast(err instanceof Error ? err.message : 'Save failed', 'error');
    },
  });

  const handleSave = useCallback(() => {
    const toSave = rows.filter((r) => !r.saved);
    const creates: { row: RegisterRow; tx: ManualTransaction }[] = [];
    const updates: { row: RegisterRow; tx: ManualTransaction }[] = [];
    const skippedIds = new Set<number>();

    for (const r of toSave) {
      // Completely blank rows (trailing auto-added row) — skip silently
      if (!r.payee.trim() && !r.amountStr.trim() && !r.accountId) continue;

      const issues: string[] = [];
      if (!r.date) issues.push('missing date');
      if (!r.payee.trim()) issues.push('missing payee');
      if (!r.accountId) issues.push('missing category');
      const cents = parseDollarInput(r.amountStr);
      if (cents === null || cents === 0) issues.push('invalid or zero amount');

      if (issues.length > 0) { skippedIds.add(r._id); continue; }

      const tx: ManualTransaction = {
        transactionDate: r.date,
        description: r.payee.trim(),
        amount: cents!,
        checkNumber: r.ref.trim() || undefined,
        accountId: r.accountId!,
        sourceAccountId: r.sourceAccountId ?? undefined,
        createRule: true,
      };

      if (r.id) {
        updates.push({ row: r, tx });
      } else {
        creates.push({ row: r, tx });
      }
    }

    if (creates.length === 0 && updates.length === 0) {
      if (skippedIds.size > 0) {
        showToast(`No transactions saved — ${skippedIds.size} row${skippedIds.size !== 1 ? 's are' : ' is'} incomplete.`, 'error');
      }
      return;
    }

    if (skippedIds.size > 0) {
      setRows((prev) => prev.map((r) => skippedIds.has(r._id) ? { ...r, _incomplete: true } : r));
    }

    saveMutation.mutate({ creates, updates });
  }, [rows, saveMutation, selectedClientId, selectedPeriodId]);

  const unsavedValid = useMemo(() => {
    return rows.filter((r) => !r.saved && r.payee.trim() && r.accountId && parseDollarInput(r.amountStr) !== null && parseDollarInput(r.amountStr) !== 0);
  }, [rows]);

  if (!selectedClientId) {
    return (
      <div className="p-6 text-gray-500 dark:text-gray-400 text-sm">Select a client to begin entering transactions.</div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="px-6 py-3 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between shrink-0">
        <div>
          <h1 className="text-base font-semibold text-gray-900 dark:text-white">Transaction Entry</h1>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Tab · Shift+Tab moves between cells &nbsp;·&nbsp; Enter moves down &nbsp;·&nbsp; ↑↓ moves between rows</p>
        </div>
        <button
          onClick={handleSave}
          disabled={unsavedValid.length === 0 || saveMutation.isPending}
          className="px-4 py-1.5 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          {saveMutation.isPending ? 'Saving…' : `Save ${unsavedValid.length > 0 ? unsavedValid.length : ''} transaction${unsavedValid.length !== 1 ? 's' : ''}`}
        </button>
      </div>

      {/* Stat cards */}
      <div className="px-6 py-3 grid grid-cols-4 gap-3 shrink-0">
        {[
          { label: 'Entries this session', value: unsavedRows.length.toString(), color: 'text-gray-800' },
          { label: 'Total debits', value: fmt(statDebits), color: fmtColor(statDebits) },
          { label: 'Total credits', value: fmt(statCredits), color: fmtColor(statCredits) },
          { label: 'Net', value: fmt(statNet), color: fmtColor(statNet) },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-gray-50 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700 rounded p-3">
            <div className="text-[11px] text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">{label}</div>
            <div className={`text-sm font-mono font-semibold tabular-nums ${color}`}>{value}</div>
          </div>
        ))}
      </div>

      {/* Toast */}
      {toast && (
        <div className={`mx-6 mb-2 px-3 py-2 rounded text-sm shrink-0 ${toast.type === 'success' ? 'bg-green-50 dark:bg-green-900/30 text-green-800 dark:text-green-400 border border-green-200 dark:border-green-700' : 'bg-red-50 dark:bg-red-900/30 text-red-800 dark:text-red-400 border border-red-200 dark:border-red-700'}`}>
          {toast.message}
        </div>
      )}

      {/* Register grid */}
      <div className="flex-1 overflow-auto px-6 pb-6">
        <table ref={tableRef} className="w-full text-xs border-collapse">
          <thead className="sticky top-0 bg-gray-100 dark:bg-gray-700 z-10">
            <tr>
              <th className="px-2 py-1.5 text-left font-semibold text-gray-600 dark:text-gray-300 w-48">Account</th>
              <th className="px-2 py-1.5 text-left font-semibold text-gray-600 dark:text-gray-300 w-28">Date</th>
              <th className="px-2 py-1.5 text-left font-semibold text-gray-600 dark:text-gray-300 w-20">Ref / Ck#</th>
              <th className="px-2 py-1.5 text-left font-semibold text-gray-600 dark:text-gray-300 w-52">Payee</th>
              <th className="px-2 py-1.5 text-left font-semibold text-gray-600 dark:text-gray-300 w-56">Category</th>
              <th className="px-2 py-1.5 text-right font-semibold text-gray-600 dark:text-gray-300 w-28">Amount</th>
              <th className="px-2 py-1.5 w-32 min-w-[8rem]"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, rowIdx) => {
              const payeeObj = payeeMap.get(row._id);
              const payeeCategories = payeeObj?.categories ?? [];
              const hasRule = !!(payeeObj?.hasRule);

              return (
                <tr key={row._id} className={`border-b border-gray-100 dark:border-gray-700 ${!row.saved ? 'dark:bg-gray-800/20' : ''}`}>
                  {/* Col 0: Source Account */}
                  <td className="px-1 py-0.5">
                    <CategoryCombo
                      value={row.sourceAccountId}
                      accounts={accounts}
                      payeeCategories={[]}
                      payeeName=""
                      onChange={(id) => updateRow(row._id, { sourceAccountId: id })}
                      onNavigate={(dir) => navigateCell(rowIdx, COL_SOURCE, dir)}
                      dataRow={rowIdx}
                      dataCol={COL_SOURCE}
                    />
                  </td>

                  {/* Col 1: Date */}
                  <td className="px-1 py-0.5">
                    <DateInput
                      value={row.date}
                      data-row={rowIdx}
                      data-col={COL_DATE}
                      className={inputCls}
                      onChange={(e) => updateRow(row._id, { date: e.target.value })}
                      onKeyDown={makeCellKeyDown(rowIdx, COL_DATE, /* skipArrows */ true)}
                    />
                  </td>

                  {/* Col 2: Ref */}
                  <td className="px-1 py-0.5">
                    <input
                      type="text"
                      value={row.ref}
                      data-row={rowIdx}
                      data-col={COL_REF}
                      placeholder="1042, ACH…"
                      className={inputCls}
                      onChange={(e) => updateRow(row._id, { ref: e.target.value })}
                      onKeyDown={makeCellKeyDown(rowIdx, COL_REF)}
                    />
                  </td>

                  {/* Col 3: Payee */}
                  <td className="px-1 py-0.5">
                    <PayeeCombo
                      value={row.payee}
                      payees={payees}
                      hasRule={hasRule}
                      onChange={(val, payee) => onPayeeSelect(row._id, val, payee)}
                      onNavigate={(dir) => navigateCell(rowIdx, COL_PAYEE, dir)}
                      dataRow={rowIdx}
                      dataCol={COL_PAYEE}
                    />
                  </td>

                  {/* Col 4: Category */}
                  <td className="px-1 py-0.5">
                    <CategoryCombo
                      value={row.accountId}
                      accounts={accounts}
                      payeeCategories={payeeCategories}
                      payeeName={row.payee}
                      onChange={(id) => updateRow(row._id, { accountId: id })}
                      onNavigate={(dir) => navigateCell(rowIdx, COL_CAT, dir)}
                      dataRow={rowIdx}
                      dataCol={COL_CAT}
                    />
                  </td>

                  {/* Col 5: Amount */}
                  <td className="px-1 py-0.5">
                    <input
                      type="text"
                      value={row.amountStr}
                      data-row={rowIdx}
                      data-col={COL_AMT}
                      placeholder="-85.00"
                      className={`${inputCls} text-right font-mono`}
                      onChange={(e) => updateRow(row._id, { amountStr: e.target.value })}
                      onBlur={(e) => updateRow(row._id, { amountStr: evalAndFormatAmount(e.target.value) })}
                      onKeyDown={makeCellKeyDown(rowIdx, COL_AMT)}
                    />
                  </td>

                  {/* Actions */}
                  <td className="px-3 py-0.5 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      {row.saved && (
                        <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-green-100 text-green-700">saved</span>
                      )}
                      {row._incomplete && (
                        <span className="text-[10px] text-amber-600 font-medium" title="Fill in payee, category, and amount to save">⚠</span>
                      )}
                      <button
                        type="button"
                        title="Duplicate row"
                        onClick={() => duplicateRow(row._id)}
                        className="text-gray-400 dark:text-gray-500 hover:text-blue-600 dark:hover:text-blue-400 p-1 rounded hover:bg-blue-50 dark:hover:bg-blue-900/20"
                      >
                        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M15.75 17.25v2.25a2.25 2.25 0 0 1-2.25 2.25H5.25a2.25 2.25 0 0 1-2.25-2.25V9.75A2.25 2.25 0 0 1 5.25 7.5h2.25"/>
                          <path d="M18.75 3H8.25A2.25 2.25 0 0 0 6 5.25v10.5A2.25 2.25 0 0 0 8.25 18h10.5A2.25 2.25 0 0 0 21 15.75V5.25A2.25 2.25 0 0 0 18.75 3z"/>
                        </svg>
                      </button>
                      <button
                        type="button"
                        title="Delete row"
                        onClick={() => deleteRow(row._id)}
                        className="text-gray-400 dark:text-gray-500 hover:text-red-600 dark:hover:text-red-400 p-1 rounded hover:bg-red-50 dark:hover:bg-red-900/20"
                      >
                        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                          <path d="M10 11v6M14 11v6"/>
                        </svg>
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
