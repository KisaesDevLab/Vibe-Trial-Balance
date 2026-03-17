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
  type VisibilityState,
} from '@tanstack/react-table';
import {
  getTrialBalance,
  initializeTrialBalance,
  updateBalance,
  importTBBalances,
  importPriorYearBalances,
  type TBRow,
  type TBImportRow,
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

// Column group styles keyed by column ID — works correctly regardless of visibility
function colClass(columnId: string, isHeader = false): string {
  const b  = isHeader ? 'border-gray-300' : 'border-gray-200';
  const br = `border-r ${b}`;
  switch (columnId) {
    case 'category':             return br;
    case 'unadjusted_credit':    return br;
    case 'book_adj_credit':      return br;
    case 'book_adjusted_debit':  return `bg-blue-50${isHeader ? '' : '/50'}`;
    case 'book_adjusted_credit': return `bg-blue-50${isHeader ? '' : '/50'} ${br}`;
    case 'tax_adj_credit':       return br;
    case 'tax_adjusted_debit':   return `bg-purple-50${isHeader ? '' : '/50'}`;
    case 'tax_adjusted_credit':  return `bg-purple-50${isHeader ? '' : '/50'} ${br}`;
    default:                     return '';
  }
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

function downloadCsv(filename: string, rows: string[][]): void {
  const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\r\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

export function TrialBalancePage() {
  const { selectedPeriodId } = useUIStore();
  const qc = useQueryClient();
  const [sorting, setSorting] = useState<SortingState>([]);
  const [lastSyncMsg, setLastSyncMsg] = useState<string | null>(null);
  const [syncedUpToDate, setSyncedUpToDate] = useState(false);
  const [showTax, setShowTax] = useState(true);
  const [notesRow, setNotesRow] = useState<TBRow | null>(null);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showPYImportModal, setShowPYImportModal] = useState(false);
  const [filterText, setFilterText] = useState('');
  const [filterCategory, setFilterCategory] = useState<string>('');

  // Excel-like cell selection
  const [activeCell, setActiveCell] = useState<ActiveCell | null>(null);
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const ignoreBlur = useRef(false);
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

  const handleExportCsv = () => {
    const rows = data ?? [];
    if (!rows.length) return;
    const header = [
      'Account Number', 'Account Name', 'Category', 'Tax Line', 'Workpaper Ref',
      'Unadj Debit', 'Unadj Credit',
      'Book Adj Debit', 'Book Adj Credit',
      'Book Adjusted Debit', 'Book Adjusted Credit',
      'Tax Adj Debit', 'Tax Adj Credit',
      'Tax Adjusted Debit', 'Tax Adjusted Credit',
    ];
    const dataRows = rows.map((r) => [
      r.account_number, r.account_name, r.category, r.tax_line ?? '', r.workpaper_ref ?? '',
      String(r.unadjusted_debit / 100), String(r.unadjusted_credit / 100),
      String(r.book_adj_debit / 100), String(r.book_adj_credit / 100),
      String(r.book_adjusted_debit / 100), String(r.book_adjusted_credit / 100),
      String(r.tax_adj_debit / 100), String(r.tax_adj_credit / 100),
      String(r.tax_adjusted_debit / 100), String(r.tax_adjusted_credit / 100),
    ]);
    downloadCsv(`trial-balance-${selectedPeriodId}.csv`, [header, ...dataRows]);
  };

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

  // ── Filter ────────────────────────────────────────────────────────────────

  const filteredDataForNav = (data ?? []).filter((r) => {
    if (filterCategory && r.category !== filterCategory) return false;
    if (filterText) {
      const q = filterText.toLowerCase();
      return r.account_number.toLowerCase().includes(q) || r.account_name.toLowerCase().includes(q);
    }
    return true;
  });

  // ── Table (placeholder for navigation row count) ───────────────────────────

  const table = useReactTable({
    data: filteredDataForNav,
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
    const alignClass = isNumber ? 'text-right' : 'text-left';
    const cellId = `${col}|${rowIndex}`;

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
              const len = e.target.value.length;
              e.target.setSelectionRange(len, len);
            } else {
              e.target.select();
            }
          }}
          className={`w-full text-sm bg-white outline-none px-1 py-0 border-0 ${alignClass}`}
        />
      );
    }

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
    } else {
      display = rawDisplay || <span className="text-gray-300 italic text-xs">—</span>;
    }

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
    columnHelper.display({
      id: 'notes',
      header: 'Notes',
      cell: ({ row }) => {
        const hasNotes = !!(row.original.preparer_notes || row.original.reviewer_notes);
        return (
          <button
            onClick={() => setNotesRow(row.original)}
            title={hasNotes ? 'View/edit notes' : 'Add notes'}
            className={`w-6 h-6 flex items-center justify-center rounded hover:bg-gray-200 transition-colors ${hasNotes ? 'text-amber-600' : 'text-gray-300 hover:text-gray-500'}`}
          >
            <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
              <path d="M17.414 2.586a2 2 0 00-2.828 0L7 10.172V13h2.828l7.586-7.586a2 2 0 000-2.828z"/>
              <path fillRule="evenodd" d="M2 6a2 2 0 012-2h4a1 1 0 010 2H4v10h10v-4a1 1 0 112 0v4a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" clipRule="evenodd"/>
            </svg>
          </button>
        );
      },
    }),
  ];

  const columnVisibility: VisibilityState = {
    tax_adj_debit:       showTax,
    tax_adj_credit:      showTax,
    tax_adjusted_debit:  showTax,
    tax_adjusted_credit: showTax,
  };

  const tableInstance = useReactTable({
    data: filteredDataForNav,
    columns,
    state: { sorting, columnVisibility },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getGroupedRowModel: getGroupedRowModel(),
  });

  // ── Footer calculations (uses unfiltered data for totals) ─────────────────

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
        <div className="flex items-center gap-4">
          {/* Tax column toggle */}
          <label className="flex items-center gap-1.5 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={showTax}
              onChange={(e) => setShowTax(e.target.checked)}
              className="rounded border-gray-300 text-purple-600"
            />
            <span className="text-sm text-gray-600">Tax</span>
          </label>

          {lastSyncMsg && (
            <span className="text-xs text-gray-500">{lastSyncMsg}</span>
          )}
          <button
            onClick={() => setShowPYImportModal(true)}
            className="px-3 py-1.5 text-sm border border-gray-300 rounded hover:bg-gray-50"
          >
            Import PY
          </button>
          <button
            onClick={() => setShowImportModal(true)}
            className="px-3 py-1.5 text-sm border border-indigo-300 text-indigo-700 rounded hover:bg-indigo-50"
          >
            Import Balances
          </button>
          <button
            onClick={handleExportCsv}
            disabled={!data?.length}
            className="px-3 py-1.5 text-sm border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-40"
          >
            Export CSV
          </button>
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

      {/* Filter bar */}
      <div className="flex items-center gap-2 px-4 py-2 border-b bg-gray-50 shrink-0">
        <input
          type="text"
          value={filterText}
          onChange={(e) => { setFilterText(e.target.value); setActiveCell(null); }}
          placeholder="Search accounts…"
          className="border border-gray-300 rounded px-2 py-1 text-sm w-52 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <select
          value={filterCategory}
          onChange={(e) => { setFilterCategory(e.target.value); setActiveCell(null); }}
          className="border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">All categories</option>
          <option value="assets">Assets</option>
          <option value="liabilities">Liabilities</option>
          <option value="equity">Equity</option>
          <option value="revenue">Revenue</option>
          <option value="expenses">Expenses</option>
        </select>
        {(filterText || filterCategory) && (
          <button
            onClick={() => { setFilterText(''); setFilterCategory(''); }}
            className="text-xs text-gray-500 hover:text-gray-700 px-2 py-1 rounded hover:bg-gray-200"
          >
            Clear
          </button>
        )}
        {(filterText || filterCategory) && data && (
          <span className="text-xs text-gray-500 ml-1">
            {filteredDataForNav.length} of {data.length} accounts
          </span>
        )}
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
              {/* Group header */}
              <tr className="bg-gray-100 border-b border-gray-300">
                <th colSpan={3} className="px-2 py-1 text-xs text-gray-500 border-r border-gray-300"></th>
                <th colSpan={2} className="px-2 py-1 text-xs text-center text-gray-600 font-semibold border-r border-gray-300">Unadjusted</th>
                <th colSpan={2} className="px-2 py-1 text-xs text-center text-blue-600 font-semibold border-r border-gray-300">Book Adj.</th>
                <th colSpan={2} className="px-2 py-1 text-xs text-center text-gray-700 font-semibold bg-blue-50 border-r border-gray-300">Book Adjusted</th>
                {showTax && <th colSpan={2} className="px-2 py-1 text-xs text-center text-purple-600 font-semibold border-r border-gray-300">Tax Adj.</th>}
                {showTax && <th colSpan={2} className="px-2 py-1 text-xs text-center text-gray-700 font-semibold bg-purple-50 border-r border-gray-300">Tax Adjusted</th>}
                <th className="px-2 py-1 text-xs text-center text-gray-500 font-semibold border-r border-gray-300">Tax Code</th>
                <th className="px-2 py-1 text-xs text-center text-gray-500 font-semibold border-r border-gray-300">W/P</th>
                <th className="px-2 py-1 text-xs text-center text-gray-500 font-semibold"></th>
              </tr>
              {/* Column headers */}
              {tableInstance.getHeaderGroups().map((hg) => (
                <tr key={hg.id} className="bg-gray-50 border-b border-gray-200">
                  {hg.headers.map((header) => (
                    <th
                      key={header.id}
                      onClick={header.column.getToggleSortingHandler()}
                      className={`px-2 py-2 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider cursor-pointer whitespace-nowrap select-none ${colClass(header.column.id, true)}`}
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
                  <td colSpan={showTax ? 15 : 11} className="px-4 py-10 text-center text-gray-400">
                    No trial balance data. Click &ldquo;Initialize from COA&rdquo; to populate from the chart of accounts.
                  </td>
                </tr>
              ) : (
                tableInstance.getRowModel().rows.map((row, rowIdx) => (
                  <tr key={row.id} className={rowIdx % 2 === 0 ? 'bg-white' : 'bg-gray-50/40'}>
                    {row.getVisibleCells().map((cell) => (
                      <td key={cell.id} className={`px-2 py-0.5 text-gray-700 ${colClass(cell.column.id)}`}>
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
            {rows.length > 0 && (
              <tfoot className="sticky bottom-0 z-10">
                {/* Column totals */}
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
                  {showTax && <td className="px-2 py-1.5 text-right text-sm text-purple-700">{fmtTotal(colSum('tax_adj_debit'))}</td>}
                  {showTax && <td className="px-2 py-1.5 text-right text-sm text-purple-700 border-r border-gray-200">{fmtTotal(colSum('tax_adj_credit'))}</td>}
                  {showTax && <td className="px-2 py-1.5 text-right text-sm font-semibold bg-purple-50/80">{fmtTotal(colSum('tax_adjusted_debit'))}</td>}
                  {showTax && <td className="px-2 py-1.5 text-right text-sm font-semibold bg-purple-50/80 border-r border-gray-200">{fmtTotal(colSum('tax_adjusted_credit'))}</td>}
                  <td colSpan={2}></td>
                </tr>
                {/* Net income / (loss) */}
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
                  {showTax && <td colSpan={2} className="border-r border-gray-200"></td>}
                  {showTax && (
                    <td colSpan={2} className="px-2 py-1 text-right text-sm font-semibold bg-purple-50/80 border-r border-gray-200">
                      {fmtNet(txNetIncome)}
                    </td>
                  )}
                  <td colSpan={2}></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      )}

      {/* TB Balance Import modal */}
      {showImportModal && selectedPeriodId && (
        <TBImportModal
          periodId={selectedPeriodId}
          mode="current"
          onClose={() => setShowImportModal(false)}
          onSuccess={() => { setShowImportModal(false); qc.invalidateQueries({ queryKey }); }}
        />
      )}

      {/* Prior Year Import modal */}
      {showPYImportModal && selectedPeriodId && (
        <TBImportModal
          periodId={selectedPeriodId}
          mode="prior-year"
          onClose={() => setShowPYImportModal(false)}
          onSuccess={() => { setShowPYImportModal(false); qc.invalidateQueries({ queryKey }); }}
        />
      )}

      {/* Notes modal */}
      {notesRow && (
        <NotesModal
          row={notesRow}
          onClose={() => setNotesRow(null)}
          onSave={(accountId, preparerNotes, reviewerNotes) => {
            accountMutation.mutate({ accountId, updates: { preparerNotes, reviewerNotes } });
            setNotesRow(null);
          }}
        />
      )}
    </div>
  );
}

// ─── TB Import Modal ───────────────────────────────────────────────────────────

interface TBMapping {
  accountNumberCol: string;
  debitCol: string;
  creditCol: string;
}

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') { inQuotes = !inQuotes; }
    else if (ch === ',' && !inQuotes) { result.push(current.trim()); current = ''; }
    else { current += ch; }
  }
  result.push(current.trim());
  return result;
}

function bestTBMatch(headers: string[], candidates: string[]): string {
  const lower = headers.map((h) => h.toLowerCase().replace(/[\s_-]/g, ''));
  for (const c of candidates) {
    const idx = lower.indexOf(c.toLowerCase().replace(/[\s_-]/g, ''));
    if (idx !== -1) return headers[idx];
  }
  return '';
}

function autoDetectTBMapping(headers: string[]): TBMapping {
  return {
    accountNumberCol: bestTBMatch(headers, ['accountnumber', 'account_number', 'acct#', 'acctno', 'acct', 'number', 'code']),
    debitCol: bestTBMatch(headers, ['debit', 'dr', 'debitamount', 'debit_amount']),
    creditCol: bestTBMatch(headers, ['credit', 'cr', 'creditamount', 'credit_amount']),
  };
}

function TBImportModal({ periodId, mode, onClose, onSuccess }: {
  periodId: number;
  mode: 'current' | 'prior-year';
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [step, setStep] = useState<1 | 2>(1);
  const [headers, setHeaders] = useState<string[]>([]);
  const [rawRows, setRawRows] = useState<string[][]>([]);
  const [mapping, setMapping] = useState<TBMapping>({ accountNumberCol: '', debitCol: '', creditCol: '' });
  const [error, setError] = useState('');
  const [result, setResult] = useState<{ upserted: number; skipped: number; total: number } | null>(null);
  const [importing, setImporting] = useState(false);

  const title = mode === 'current' ? 'Import Unadjusted Balances' : 'Import Prior Year Balances';

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const lines = text.split(/\r?\n/).filter((l) => l.trim());
      if (lines.length < 2) { setError('File must have at least a header row and one data row.'); return; }
      const hdrs = parseCsvLine(lines[0]);
      const rows = lines.slice(1).map(parseCsvLine);
      setHeaders(hdrs);
      setRawRows(rows);
      setMapping(autoDetectTBMapping(hdrs));
      setError('');
      setStep(2);
    };
    reader.readAsText(file);
  }

  async function handleImport() {
    if (!mapping.accountNumberCol) { setError('Account Number column is required.'); return; }
    if (!mapping.debitCol) { setError('Debit column is required.'); return; }
    if (!mapping.creditCol) { setError('Credit column is required.'); return; }

    const acctIdx = headers.indexOf(mapping.accountNumberCol);
    const drIdx = headers.indexOf(mapping.debitCol);
    const crIdx = headers.indexOf(mapping.creditCol);

    const rows: TBImportRow[] = rawRows
      .filter((r) => r[acctIdx]?.trim())
      .map((r) => ({
        accountNumber: r[acctIdx]?.trim() ?? '',
        debit: Math.round((parseFloat(r[drIdx]?.replace(/[^0-9.-]/g, '') || '0') || 0) * 100),
        credit: Math.round((parseFloat(r[crIdx]?.replace(/[^0-9.-]/g, '') || '0') || 0) * 100),
      }));

    if (!rows.length) { setError('No valid rows to import.'); return; }
    setImporting(true);
    setError('');
    try {
      const fn = mode === 'current' ? importTBBalances : importPriorYearBalances;
      const res = await fn(periodId, rows);
      if (res.error) { setError(res.error.message); setImporting(false); return; }
      setResult(res.data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Import failed');
    } finally {
      setImporting(false);
    }
  }

  if (result) {
    return (
      <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-lg shadow-xl w-full max-w-sm">
          <div className="px-5 py-4 border-b">
            <h2 className="text-base font-semibold">{title} — Complete</h2>
          </div>
          <div className="px-5 py-4 space-y-2 text-sm">
            <p><span className="font-medium">{result.upserted}</span> rows imported</p>
            {result.skipped > 0 && <p className="text-amber-600"><span className="font-medium">{result.skipped}</span> rows skipped (account number not found in COA)</p>}
            <p className="text-gray-500">Total in file: {result.total}</p>
          </div>
          <div className="px-5 py-3 border-t flex justify-end">
            <button onClick={onSuccess} className="px-4 py-1.5 bg-blue-600 text-white text-sm rounded hover:bg-blue-700">Done</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-lg">
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <div>
            <h2 className="text-base font-semibold">{title}</h2>
            <p className="text-xs text-gray-500 mt-0.5">Step {step} of 2 — {step === 1 ? 'Select CSV file' : 'Map columns'}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
        </div>

        <div className="px-5 py-4">
          {step === 1 && (
            <div className="space-y-3">
              <p className="text-sm text-gray-600">
                CSV must have columns for Account Number, Debit, and Credit (in dollars, not cents).
              </p>
              <label className="block">
                <span className="sr-only">Choose CSV file</span>
                <input
                  type="file"
                  accept=".csv,.txt"
                  onChange={handleFile}
                  className="block w-full text-sm text-gray-500 file:mr-3 file:py-1.5 file:px-3 file:rounded file:border file:border-gray-300 file:text-sm file:bg-gray-50 hover:file:bg-gray-100"
                />
              </label>
              {error && <p className="text-sm text-red-600">{error}</p>}
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <p className="text-xs text-gray-500">{rawRows.length} data rows detected · {headers.length} columns</p>

              <div className="space-y-2">
                {([
                  { label: 'Account Number *', key: 'accountNumberCol' as keyof TBMapping },
                  { label: 'Debit *', key: 'debitCol' as keyof TBMapping },
                  { label: 'Credit *', key: 'creditCol' as keyof TBMapping },
                ] as Array<{ label: string; key: keyof TBMapping }>).map(({ label, key }) => (
                  <div key={key} className="flex items-center gap-3">
                    <span className="text-xs text-gray-600 w-36 shrink-0">{label}</span>
                    <select
                      value={mapping[key]}
                      onChange={(e) => setMapping((m) => ({ ...m, [key]: e.target.value }))}
                      className="flex-1 border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">— skip —</option>
                      {headers.map((h) => <option key={h} value={h}>{h}</option>)}
                    </select>
                  </div>
                ))}
              </div>

              {/* Preview */}
              <div className="overflow-auto max-h-40 border border-gray-200 rounded">
                <table className="w-full text-xs">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr>
                      <th className="px-2 py-1 text-left font-medium text-gray-500">Acct #</th>
                      <th className="px-2 py-1 text-right font-medium text-gray-500">Debit</th>
                      <th className="px-2 py-1 text-right font-medium text-gray-500">Credit</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {rawRows.slice(0, 50).map((row, i) => {
                      const acctIdx = headers.indexOf(mapping.accountNumberCol);
                      const drIdx = headers.indexOf(mapping.debitCol);
                      const crIdx = headers.indexOf(mapping.creditCol);
                      return (
                        <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50/40'}>
                          <td className="px-2 py-0.5 text-gray-700">{acctIdx >= 0 ? row[acctIdx] : '—'}</td>
                          <td className="px-2 py-0.5 text-right text-gray-700">{drIdx >= 0 ? row[drIdx] : '—'}</td>
                          <td className="px-2 py-0.5 text-right text-gray-700">{crIdx >= 0 ? row[crIdx] : '—'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {error && <p className="text-sm text-red-600">{error}</p>}
            </div>
          )}
        </div>

        {step === 2 && (
          <div className="px-5 py-3 border-t flex justify-between items-center">
            <button onClick={() => setStep(1)} className="text-sm text-gray-500 hover:text-gray-700">← Back</button>
            <div className="flex gap-2">
              <button onClick={onClose} className="px-3 py-1.5 text-sm border border-gray-300 rounded hover:bg-gray-50">Cancel</button>
              <button
                onClick={handleImport}
                disabled={importing}
                className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
              >
                {importing ? 'Importing…' : 'Import'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function NotesModal({ row, onClose, onSave }: {
  row: TBRow;
  onClose: () => void;
  onSave: (accountId: number, preparerNotes: string, reviewerNotes: string) => void;
}) {
  const [preparer, setPreparer] = useState(row.preparer_notes ?? '');
  const [reviewer, setReviewer] = useState(row.reviewer_notes ?? '');

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-lg">
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <div>
            <h2 className="text-base font-semibold">{row.account_number} — {row.account_name}</h2>
            <p className="text-xs text-gray-500 mt-0.5">Workpaper Notes</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
        </div>
        <div className="px-5 py-4 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Preparer Notes</label>
            <textarea
              value={preparer}
              onChange={(e) => setPreparer(e.target.value)}
              rows={4}
              autoFocus
              placeholder="Enter preparer notes, tick marks, or references…"
              className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Reviewer Notes</label>
            <textarea
              value={reviewer}
              onChange={(e) => setReviewer(e.target.value)}
              rows={3}
              placeholder="Enter reviewer comments or sign-off…"
              className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button onClick={onClose} className="px-3 py-1.5 text-sm border border-gray-300 rounded hover:bg-gray-50">Cancel</button>
            <button
              onClick={() => onSave(row.account_id, preparer, reviewer)}
              className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Save Notes
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
