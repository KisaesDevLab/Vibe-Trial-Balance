import { useState, useRef, useCallback, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getGroupedRowModel,
  flexRender,
  createColumnHelper,
  type SortingState,
} from '@tanstack/react-table';
import {
  getTrialBalance,
  initializeTrialBalance,
  updateBalance,
  type TBRow,
} from '../api/trialBalance';
import { updateAccount, type AccountInput } from '../api/chartOfAccounts';
import { useUIStore } from '../store/uiStore';

// ─── Types ───────────────────────────────────────────────────────────────────

type EditableColKey =
  | 'account_number'
  | 'account_name'
  | 'unadjusted_debit'
  | 'unadjusted_credit'
  | 'category'
  | 'tax_line'
  | 'workpaper_ref';

const EDITABLE_COLS: EditableColKey[] = [
  'account_number',
  'account_name',
  'unadjusted_debit',
  'unadjusted_credit',
  'category',
  'tax_line',
  'workpaper_ref',
];

const ACCOUNT_CATEGORIES: TBRow['category'][] = ['assets', 'liabilities', 'equity', 'revenue', 'expenses'];

interface ActiveCell { row: number; col: EditableColKey }

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmt(cents: number): string {
  if (cents === 0) return '—';
  return (cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtTotal(cents: number): string {
  return (cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function parseCents(val: string): number {
  const n = parseFloat(val.replace(/[^0-9.-]/g, ''));
  return isNaN(n) ? 0 : Math.round(n * 100);
}

const CATEGORY_COLORS: Record<string, string> = {
  assets: 'bg-blue-50 text-blue-700',
  liabilities: 'bg-orange-50 text-orange-700',
  equity: 'bg-purple-50 text-purple-700',
  revenue: 'bg-green-50 text-green-700',
  expenses: 'bg-red-50 text-red-700',
};

// Columns: 0=acct#, 1=name, 2=cat, 3=unaj_dr, 4=unaj_cr, 5=bk_adj_dr, 6=bk_adj_cr,
//          7=bk_dr, 8=bk_cr, 9=tx_adj_dr, 10=tx_adj_cr, 11=tx_dr, 12=tx_cr, 13=tax_line, 14=wp_ref
function colGroupClass(idx: number, isHeader = false): string {
  const b = isHeader ? 'border-gray-300' : 'border-gray-200';
  if (idx === 2)  return `border-r ${b}`;
  if (idx === 4)  return `border-r ${b}`;
  if (idx === 6)  return `border-r ${b}`;
  if (idx === 7)  return `bg-blue-50${isHeader ? '' : '/50'}`;
  if (idx === 8)  return `bg-blue-50${isHeader ? '' : '/50'} border-r ${b}`;
  if (idx === 11) return `bg-purple-50${isHeader ? '' : '/50'}`;
  if (idx === 12) return `bg-purple-50${isHeader ? '' : '/50'} border-r ${b}`;
  return '';
}

function getCellDisplayValue(rowData: TBRow, col: EditableColKey): string {
  switch (col) {
    case 'account_number':    return rowData.account_number;
    case 'account_name':      return rowData.account_name;
    case 'unadjusted_debit':  return rowData.unadjusted_debit === 0 ? '' : (rowData.unadjusted_debit / 100).toFixed(2);
    case 'unadjusted_credit': return rowData.unadjusted_credit === 0 ? '' : (rowData.unadjusted_credit / 100).toFixed(2);
    case 'category':          return rowData.category;
    case 'tax_line':          return rowData.tax_line ?? '';
    case 'workpaper_ref':     return rowData.workpaper_ref ?? '';
  }
}

const columnHelper = createColumnHelper<TBRow>();

// ─── Page component ───────────────────────────────────────────────────────────

export function TrialBalancePage() {
  const { selectedPeriodId } = useUIStore();
  const qc = useQueryClient();
  const [sorting, setSorting] = useState<SortingState>([]);
  const [lastSyncMsg, setLastSyncMsg] = useState<string | null>(null);
  const [syncedUpToDate, setSyncedUpToDate] = useState(false);

  // Excel-like cell selection
  const [activeCell, setActiveCell] = useState<ActiveCell | null>(null);
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const ignoreBlur = useRef(false);
  // Track whether editing was started by typing a character (vs F2/Enter/double-click)
  // Used to decide whether to select-all (replace) or place cursor at end (append)
  const editStartedByChar = useRef(false);

  const queryKey = ['trial-balance', selectedPeriodId];

  useEffect(() => {
    setActiveCell(null);
    setEditing(false);
    setLastSyncMsg(null);
    setSyncedUpToDate(false);
  }, [selectedPeriodId]);

  useEffect(() => {
    if (!editing && activeCell) containerRef.current?.focus();
  }, [editing]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (activeCell) {
      document
        .querySelector(`[data-cell="${activeCell.col}|${activeCell.row}"]`)
        ?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    }
  }, [activeCell]);

  const { data, isLoading, error } = useQuery({
    queryKey,
    queryFn: async () => {
      if (!selectedPeriodId) return [];
      const res = await getTrialBalance(selectedPeriodId);
      if (res.error) throw new Error(res.error.message);
      return res.data;
    },
    enabled: selectedPeriodId !== null,
  });

  const initMutation = useMutation({
    mutationFn: () => initializeTrialBalance(selectedPeriodId!),
    onSuccess: (res) => {
      if (res.error) return;
      const { initialized, removed } = res.data;
      const parts: string[] = [];
      if (initialized > 0) parts.push(`${initialized} added`);
      if (removed > 0) parts.push(`${removed} removed`);
      const msg = parts.length > 0 ? parts.join(', ') : 'Already up to date';
      setLastSyncMsg(msg);
      setSyncedUpToDate(initialized === 0 && removed === 0);
      qc.invalidateQueries({ queryKey });
    },
  });

  const balanceMutation = useMutation({
    mutationFn: ({ accountId, debit, credit }: { accountId: number; debit: number; credit: number }) =>
      updateBalance(selectedPeriodId!, accountId, debit, credit),
    onMutate: async ({ accountId, debit, credit }) => {
      await qc.cancelQueries({ queryKey });
      const prev = qc.getQueryData<TBRow[]>(queryKey);
      qc.setQueryData<TBRow[]>(queryKey, (old) =>
        old?.map((r) =>
          r.account_id === accountId
            ? {
                ...r,
                unadjusted_debit: debit,
                unadjusted_credit: credit,
                book_adjusted_debit: debit + r.book_adj_debit,
                book_adjusted_credit: credit + r.book_adj_credit,
                tax_adjusted_debit: debit + r.book_adj_debit + r.tax_adj_debit,
                tax_adjusted_credit: credit + r.book_adj_credit + r.tax_adj_credit,
              }
            : r,
        ),
      );
      return { prev };
    },
    onError: (_e, _v, ctx) => { if (ctx?.prev) qc.setQueryData(queryKey, ctx.prev); },
    onSettled: () => qc.invalidateQueries({ queryKey }),
  });

  const accountMutation = useMutation({
    mutationFn: ({ accountId, updates }: { accountId: number; updates: Partial<AccountInput> }) =>
      updateAccount(accountId, updates),
    onMutate: async ({ accountId, updates }) => {
      await qc.cancelQueries({ queryKey });
      const prev = qc.getQueryData<TBRow[]>(queryKey);
      qc.setQueryData<TBRow[]>(queryKey, (old) =>
        old?.map((r) => {
          if (r.account_id !== accountId) return r;
          return {
            ...r,
            ...(updates.accountNumber !== undefined ? { account_number: updates.accountNumber } : {}),
            ...(updates.accountName !== undefined ? { account_name: updates.accountName } : {}),
            ...(updates.category !== undefined ? { category: updates.category } : {}),
            ...(updates.taxLine !== undefined ? { tax_line: updates.taxLine || null } : {}),
            ...(updates.workpaperRef !== undefined ? { workpaper_ref: updates.workpaperRef || null } : {}),
          };
        }),
      );
      return { prev };
    },
    onError: (_e, _v, ctx) => { if (ctx?.prev) qc.setQueryData(queryKey, ctx.prev); },
    onSettled: () => qc.invalidateQueries({ queryKey }),
  });

  const handleBalanceEdit = useCallback(
    (row: TBRow, field: 'unadjusted_debit' | 'unadjusted_credit', cents: number) => {
      balanceMutation.mutate({
        accountId: row.account_id,
        debit: field === 'unadjusted_debit' ? cents : row.unadjusted_debit,
        credit: field === 'unadjusted_credit' ? cents : row.unadjusted_credit,
      });
    },
    [balanceMutation],
  );

  // ── Table (placeholder for navigation row count) ───────────────────────────

  const table = useReactTable({
    data: data ?? [],
    columns: [],
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getGroupedRowModel: getGroupedRowModel(),
  });

  // ── Navigation & edit helpers ──────────────────────────────────────────────

  function commitEdit(rowData: TBRow, col: EditableColKey, text: string) {
    const trimmed = text.trim();
    switch (col) {
      case 'unadjusted_debit':
        handleBalanceEdit(rowData, 'unadjusted_debit', parseCents(text));
        break;
      case 'unadjusted_credit':
        handleBalanceEdit(rowData, 'unadjusted_credit', parseCents(text));
        break;
      case 'account_number':
        if (trimmed && trimmed !== rowData.account_number)
          accountMutation.mutate({ accountId: rowData.account_id, updates: { accountNumber: trimmed } });
        break;
      case 'account_name':
        if (trimmed && trimmed !== rowData.account_name)
          accountMutation.mutate({ accountId: rowData.account_id, updates: { accountName: trimmed } });
        break;
      case 'category':
        if (ACCOUNT_CATEGORIES.includes(trimmed as TBRow['category']) && trimmed !== rowData.category)
          accountMutation.mutate({ accountId: rowData.account_id, updates: { category: trimmed as TBRow['category'] } });
        break;
      case 'tax_line':
        if (trimmed !== (rowData.tax_line ?? ''))
          accountMutation.mutate({ accountId: rowData.account_id, updates: { taxLine: trimmed || undefined } });
        break;
      case 'workpaper_ref':
        accountMutation.mutate({ accountId: rowData.account_id, updates: { workpaperRef: trimmed || undefined } });
        break;
    }
  }

  function navigate(
    dir: 'up' | 'down' | 'left' | 'right' | 'tab' | 'shift-tab',
    ac: ActiveCell,
    saveText?: { rowData: TBRow; text: string },
  ) {
    if (saveText) commitEdit(saveText.rowData, ac.col, saveText.text);
    setEditing(false);

    const rows = table.getRowModel().rows;
    const rowCount = rows.length;
    const colIdx = EDITABLE_COLS.indexOf(ac.col);
    let newRow = ac.row;
    let newColIdx = colIdx;

    switch (dir) {
      case 'up':    newRow = Math.max(0, ac.row - 1); break;
      case 'down':  newRow = Math.min(rowCount - 1, ac.row + 1); break;
      case 'left':  newColIdx = Math.max(0, colIdx - 1); break;
      case 'right': newColIdx = Math.min(EDITABLE_COLS.length - 1, colIdx + 1); break;
      case 'tab':
        if (colIdx < EDITABLE_COLS.length - 1) { newColIdx = colIdx + 1; }
        else if (ac.row < rowCount - 1) { newColIdx = 0; newRow = ac.row + 1; }
        break;
      case 'shift-tab':
        if (colIdx > 0) { newColIdx = colIdx - 1; }
        else if (ac.row > 0) { newColIdx = EDITABLE_COLS.length - 1; newRow = ac.row - 1; }
        break;
    }
    setActiveCell({ row: newRow, col: EDITABLE_COLS[newColIdx] });
  }

  function handleContainerKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if (!activeCell || editing) return;
    const rows = table.getRowModel().rows;
    const rowData = rows[activeCell.row]?.original;

    switch (e.key) {
      case 'ArrowUp':    e.preventDefault(); navigate('up', activeCell); break;
      case 'ArrowDown':  e.preventDefault(); navigate('down', activeCell); break;
      case 'ArrowLeft':  e.preventDefault(); navigate('left', activeCell); break;
      case 'ArrowRight': e.preventDefault(); navigate('right', activeCell); break;
      case 'Tab':        e.preventDefault(); navigate(e.shiftKey ? 'shift-tab' : 'tab', activeCell); break;
      case 'Enter':
      case 'F2':
        e.preventDefault();
        if (rowData) {
          editStartedByChar.current = false;
          setEditText(getCellDisplayValue(rowData, activeCell.col));
          setEditing(true);
        }
        break;
      case 'Delete':
      case 'Backspace':
        e.preventDefault();
        editStartedByChar.current = false;
        setEditText('');
        setEditing(true);
        break;
      case 'Escape':
        e.preventDefault();
        setActiveCell(null);
        break;
      default:
        if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
          e.preventDefault();
          editStartedByChar.current = true;
          setEditText(e.key);
          setEditing(true);
        }
    }
  }

  function handleInputKeyDown(e: React.KeyboardEvent<HTMLInputElement | HTMLSelectElement>, ac: ActiveCell, rowData: TBRow) {
    switch (e.key) {
      case 'Enter':
        e.preventDefault();
        ignoreBlur.current = true;
        navigate(e.shiftKey ? 'up' : 'down', ac, { rowData, text: editText });
        break;
      case 'Tab':
        e.preventDefault();
        ignoreBlur.current = true;
        navigate(e.shiftKey ? 'shift-tab' : 'tab', ac, { rowData, text: editText });
        break;
      case 'Escape':
        e.preventDefault();
        ignoreBlur.current = true;
        setEditing(false);
        break;
    }
  }

  function handleInputBlur(ac: ActiveCell, rowData: TBRow) {
    if (ignoreBlur.current) { ignoreBlur.current = false; return; }
    commitEdit(rowData, ac.col, editText);
    setEditing(false);
  }

  // ── Cell renderer ──────────────────────────────────────────────────────────

  function renderCell(rowIndex: number, col: EditableColKey, rowData: TBRow) {
    const isActive = activeCell?.row === rowIndex && activeCell?.col === col;
    const isNumber = col === 'unadjusted_debit' || col === 'unadjusted_credit';
    const isSelect = col === 'category';
    const isMono = false; // no monospace — keeps font consistent across all columns
    const alignClass = isNumber ? 'text-right' : 'text-left';
    const cellId = `${col}|${rowIndex}`;

    // Editing
    if (isActive && editing) {
      if (isSelect) {
        return (
          <select
            autoFocus
            value={editText}
            onChange={(e) => setEditText(e.target.value)}
            onKeyDown={(e) => handleInputKeyDown(e, { row: rowIndex, col }, rowData)}
            onBlur={() => handleInputBlur({ row: rowIndex, col }, rowData)}
            className="w-full text-sm bg-white outline-none px-1 py-0 border-0 capitalize"
          >
            {ACCOUNT_CATEGORIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        );
      }
      return (
        <input
          autoFocus
          value={editText}
          onChange={(e) => setEditText(e.target.value)}
          onKeyDown={(e) => handleInputKeyDown(e, { row: rowIndex, col }, rowData)}
          onBlur={() => handleInputBlur({ row: rowIndex, col }, rowData)}
          onFocus={(e) => {
            if (editStartedByChar.current) {
              // Cursor at end so the typed char is preserved; subsequent typing appends
              const len = e.target.value.length;
              e.target.setSelectionRange(len, len);
            } else {
              e.target.select();
            }
          }}
          className={`w-full text-sm bg-white outline-none px-1 py-0 border-0 ${alignClass} ${isMono ? 'font-mono' : ''}`}
        />
      );
    }

    // Display value
    const rawDisplay = getCellDisplayValue(rowData, col);
    let display: React.ReactNode;
    if (isNumber) {
      display = rawDisplay
        ? fmt(parseCents(rawDisplay) || 0)
        : <span className="text-gray-300">—</span>;
    } else if (col === 'category') {
      display = (
        <span className={`inline-flex px-1.5 py-0.5 rounded text-xs font-medium capitalize ${CATEGORY_COLORS[rawDisplay]}`}>
          {rawDisplay.slice(0, 3)}
        </span>
      );
    } else if (col === 'account_number') {
      display = rawDisplay || <span className="text-gray-300 italic text-xs">—</span>;
    } else {
      display = rawDisplay || <span className="text-gray-300 italic text-xs">—</span>;
    }

    // Selected but not editing
    if (isActive) {
      return (
        <div
          data-cell={cellId}
          className={`w-full px-1 py-0.5 text-sm select-none ring-2 ring-blue-500 ring-inset bg-blue-50/80 rounded-sm ${alignClass}`}
        >
          {display}
        </div>
      );
    }

    // Normal
    return (
      <div
        data-cell={cellId}
        onClick={() => { setActiveCell({ row: rowIndex, col }); setEditing(false); containerRef.current?.focus(); }}
        onDoubleClick={() => {
          editStartedByChar.current = false;
          setActiveCell({ row: rowIndex, col });
          setEditText(getCellDisplayValue(rowData, col));
          setEditing(true);
        }}
        className={`w-full px-1 py-0.5 text-sm cursor-default select-none hover:bg-gray-100 ${alignClass}`}
      >
        {display}
      </div>
    );
  }

  // ── Columns ────────────────────────────────────────────────────────────────

  const columns = [
    columnHelper.accessor('account_number', {
      header: 'Acct #',
      cell: (i) => renderCell(i.row.index, 'account_number', i.row.original),
    }),
    columnHelper.accessor('account_name', {
      header: 'Account Name',
      cell: (i) => renderCell(i.row.index, 'account_name', i.row.original),
    }),
    columnHelper.accessor('category', {
      header: 'Cat.',
      cell: (i) => renderCell(i.row.index, 'category', i.row.original),
    }),
    columnHelper.accessor('unadjusted_debit', {
      header: 'Unaj. Dr',
      cell: (i) => renderCell(i.row.index, 'unadjusted_debit', i.row.original),
    }),
    columnHelper.accessor('unadjusted_credit', {
      header: 'Unaj. Cr',
      cell: (i) => renderCell(i.row.index, 'unadjusted_credit', i.row.original),
    }),
    columnHelper.accessor('book_adj_debit', {
      header: 'Bk Adj Dr',
      cell: (i) => <span className="text-right block text-sm text-blue-700">{fmt(i.getValue())}</span>,
    }),
    columnHelper.accessor('book_adj_credit', {
      header: 'Bk Adj Cr',
      cell: (i) => <span className="text-right block text-sm text-blue-700">{fmt(i.getValue())}</span>,
    }),
    columnHelper.accessor('book_adjusted_debit', {
      header: 'Bk Dr',
      cell: (i) => <span className="text-right block text-sm font-semibold">{fmt(i.getValue())}</span>,
    }),
    columnHelper.accessor('book_adjusted_credit', {
      header: 'Bk Cr',
      cell: (i) => <span className="text-right block text-sm font-semibold">{fmt(i.getValue())}</span>,
    }),
    columnHelper.accessor('tax_adj_debit', {
      header: 'Tx Adj Dr',
      cell: (i) => <span className="text-right block text-sm text-purple-700">{fmt(i.getValue())}</span>,
    }),
    columnHelper.accessor('tax_adj_credit', {
      header: 'Tx Adj Cr',
      cell: (i) => <span className="text-right block text-sm text-purple-700">{fmt(i.getValue())}</span>,
    }),
    columnHelper.accessor('tax_adjusted_debit', {
      header: 'Tx Dr',
      cell: (i) => <span className="text-right block text-sm font-semibold">{fmt(i.getValue())}</span>,
    }),
    columnHelper.accessor('tax_adjusted_credit', {
      header: 'Tx Cr',
      cell: (i) => <span className="text-right block text-sm font-semibold">{fmt(i.getValue())}</span>,
    }),
    columnHelper.accessor('tax_line', {
      header: 'Tax Code',
      cell: (i) => renderCell(i.row.index, 'tax_line', i.row.original),
    }),
    columnHelper.accessor('workpaper_ref', {
      header: 'W/P Ref',
      cell: (i) => renderCell(i.row.index, 'workpaper_ref', i.row.original),
    }),
  ];

  const tableInstance = useReactTable({
    data: data ?? [],
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getGroupedRowModel: getGroupedRowModel(),
  });

  // ── Footer calculations ────────────────────────────────────────────────────

  const rows = data ?? [];
  const colSum = (key: keyof TBRow) => rows.reduce((s, r) => s + (r[key] as number), 0);
  const calcNetIncome = (dk: keyof TBRow, ck: keyof TBRow) => {
    const revNet = rows
      .filter((r) => r.category === 'revenue')
      .reduce((s, r) => s + (r[ck] as number) - (r[dk] as number), 0);
    const expNet = rows
      .filter((r) => r.category === 'expenses')
      .reduce((s, r) => s + (r[dk] as number) - (r[ck] as number), 0);
    return revNet - expNet;
  };

  const unajNetIncome = calcNetIncome('unadjusted_debit', 'unadjusted_credit');
  const bkNetIncome   = calcNetIncome('book_adjusted_debit', 'book_adjusted_credit');
  const txNetIncome   = calcNetIncome('tax_adjusted_debit', 'tax_adjusted_credit');

  function fmtNet(n: number) {
    if (n === 0) return <span className="text-gray-400">—</span>;
    return n > 0
      ? <span className="text-green-700">{fmtTotal(n)}</span>
      : <span className="text-red-600">({fmtTotal(Math.abs(n))})</span>;
  }

  const isEmpty = !data || data.length === 0;
  const showSyncButton = isEmpty || !syncedUpToDate;

  // ── Render ─────────────────────────────────────────────────────────────────

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
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-3 border-b bg-white shrink-0">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Trial Balance</h2>
          {data && <p className="text-xs text-gray-500">{data.length} accounts · click to select · double-click or F2 to edit · Tab/Enter/arrows to navigate</p>}
        </div>
        <div className="flex items-center gap-3">
          {lastSyncMsg && (
            <span className="text-xs text-gray-500">{lastSyncMsg}</span>
          )}
          {showSyncButton && (
            <button
              onClick={() => initMutation.mutate()}
              disabled={initMutation.isPending}
              className="px-3 py-1.5 bg-green-600 text-white text-sm rounded hover:bg-green-700 disabled:opacity-50"
            >
              {initMutation.isPending ? 'Syncing...' : isEmpty ? 'Initialize from COA' : 'Sync with COA'}
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border-b border-red-200 text-red-700 px-4 py-2 text-sm shrink-0">
          {error.message}
        </div>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center flex-1 text-gray-400">Loading...</div>
      ) : (
        <div
          ref={containerRef}
          tabIndex={0}
          onKeyDown={handleContainerKeyDown}
          className="flex-1 overflow-auto outline-none"
          onClick={(e) => {
            if (e.target === e.currentTarget) setActiveCell(null);
          }}
        >
          <table className="w-full text-sm border-collapse">
            <thead className="sticky top-0 z-10">
              <tr className="bg-gray-100 border-b border-gray-300">
                <th colSpan={3} className="px-2 py-1 text-xs text-gray-500 border-r border-gray-300"></th>
                <th colSpan={2} className="px-2 py-1 text-xs text-center text-gray-600 font-semibold border-r border-gray-300">Unadjusted</th>
                <th colSpan={2} className="px-2 py-1 text-xs text-center text-blue-600 font-semibold border-r border-gray-300">Book Adj.</th>
                <th colSpan={2} className="px-2 py-1 text-xs text-center text-gray-700 font-semibold bg-blue-50 border-r border-gray-300">Book Adjusted</th>
                <th colSpan={2} className="px-2 py-1 text-xs text-center text-purple-600 font-semibold border-r border-gray-300">Tax Adj.</th>
                <th colSpan={2} className="px-2 py-1 text-xs text-center text-gray-700 font-semibold bg-purple-50 border-r border-gray-300">Tax Adjusted</th>
                <th className="px-2 py-1 text-xs text-center text-gray-500 font-semibold border-r border-gray-300">Tax Code</th>
                <th className="px-2 py-1 text-xs text-center text-gray-500 font-semibold">W/P</th>
              </tr>
              {tableInstance.getHeaderGroups().map((hg) => (
                <tr key={hg.id} className="bg-gray-50 border-b border-gray-200">
                  {hg.headers.map((header, idx) => (
                    <th
                      key={header.id}
                      onClick={header.column.getToggleSortingHandler()}
                      className={`px-2 py-2 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider cursor-pointer whitespace-nowrap select-none ${colGroupClass(idx, true)}`}
                    >
                      {flexRender(header.column.columnDef.header, header.getContext())}
                      {header.column.getIsSorted() === 'asc' && ' ↑'}
                      {header.column.getIsSorted() === 'desc' && ' ↓'}
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody className="divide-y divide-gray-100">
              {tableInstance.getRowModel().rows.length === 0 ? (
                <tr>
                  <td colSpan={15} className="px-4 py-10 text-center text-gray-400">
                    No trial balance data. Click &ldquo;Initialize from COA&rdquo; to populate from the chart of accounts.
                  </td>
                </tr>
              ) : (
                tableInstance.getRowModel().rows.map((row, rowIdx) => (
                  <tr key={row.id} className={rowIdx % 2 === 0 ? 'bg-white' : 'bg-gray-50/40'}>
                    {row.getVisibleCells().map((cell, cellIdx) => (
                      <td key={cell.id} className={`px-2 py-0.5 text-gray-700 ${colGroupClass(cellIdx)}`}>
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
            {rows.length > 0 && (
              <tfoot className="sticky bottom-0 z-10">
                <tr className="border-t-2 border-gray-400 bg-gray-100 font-semibold">
                  <td colSpan={3} className="px-2 py-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wider border-r border-gray-300">
                    Totals
                  </td>
                  <td className="px-2 py-1.5 text-right text-sm border-r border-gray-200">{fmtTotal(colSum('unadjusted_debit'))}</td>
                  <td className="px-2 py-1.5 text-right text-sm border-r border-gray-200">{fmtTotal(colSum('unadjusted_credit'))}</td>
                  <td className="px-2 py-1.5 text-right text-sm text-blue-700">{fmtTotal(colSum('book_adj_debit'))}</td>
                  <td className="px-2 py-1.5 text-right text-sm text-blue-700 border-r border-gray-200">{fmtTotal(colSum('book_adj_credit'))}</td>
                  <td className="px-2 py-1.5 text-right text-sm font-semibold bg-blue-50/80">{fmtTotal(colSum('book_adjusted_debit'))}</td>
                  <td className="px-2 py-1.5 text-right text-sm font-semibold bg-blue-50/80 border-r border-gray-200">{fmtTotal(colSum('book_adjusted_credit'))}</td>
                  <td className="px-2 py-1.5 text-right text-sm text-purple-700">{fmtTotal(colSum('tax_adj_debit'))}</td>
                  <td className="px-2 py-1.5 text-right text-sm text-purple-700 border-r border-gray-200">{fmtTotal(colSum('tax_adj_credit'))}</td>
                  <td className="px-2 py-1.5 text-right text-sm font-semibold bg-purple-50/80">{fmtTotal(colSum('tax_adjusted_debit'))}</td>
                  <td className="px-2 py-1.5 text-right text-sm font-semibold bg-purple-50/80 border-r border-gray-200">{fmtTotal(colSum('tax_adjusted_credit'))}</td>
                  <td colSpan={2}></td>
                </tr>
                <tr className="border-t border-gray-300 bg-gray-50">
                  <td colSpan={3} className="px-2 py-1 text-xs font-semibold text-gray-500 uppercase tracking-wider border-r border-gray-300">
                    Net Income/(Loss)
                  </td>
                  <td colSpan={2} className="px-2 py-1 text-right text-sm font-semibold border-r border-gray-200">
                    {fmtNet(unajNetIncome)}
                  </td>
                  <td colSpan={2} className="border-r border-gray-200"></td>
                  <td colSpan={2} className="px-2 py-1 text-right text-sm font-semibold bg-blue-50/80 border-r border-gray-200">
                    {fmtNet(bkNetIncome)}
                  </td>
                  <td colSpan={2} className="border-r border-gray-200"></td>
                  <td colSpan={2} className="px-2 py-1 text-right text-sm font-semibold bg-purple-50/80 border-r border-gray-200">
                    {fmtNet(txNetIncome)}
                  </td>
                  <td colSpan={2}></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      )}
    </div>
  );
}
