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
import { updateAccount } from '../api/chartOfAccounts';
import { useUIStore } from '../store/uiStore';

function fmt(cents: number): string {
  if (cents === 0) return '—';
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

// Unique attribute used to locate the next editable button in the grid.
// cellId format: "{colKey}|{rowIndex}"
function nextCell(cellId: string) {
  const [col, rowStr] = cellId.split('|');
  const next = `${col}|${Number(rowStr) + 1}`;
  const el = document.querySelector<HTMLButtonElement>(`[data-cell="${next}"]`);
  el?.click();
}

function EditableCell({
  value,
  onCommit,
  cellId,
}: {
  value: number;
  onCommit: (cents: number) => void;
  cellId: string;
}) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState('');
  const ignoreBlur = useRef(false);

  const commit = (raw: string) => {
    setEditing(false);
    onCommit(parseCents(raw));
  };

  if (editing) {
    return (
      <input
        autoFocus
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={() => {
          if (ignoreBlur.current) { ignoreBlur.current = false; return; }
          commit(text);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            ignoreBlur.current = true;
            commit(text);
            nextCell(cellId);
          }
          if (e.key === 'Escape') {
            ignoreBlur.current = true;
            setEditing(false);
          }
        }}
        className="w-full text-right text-sm border border-blue-400 rounded px-1 py-0.5 focus:outline-none"
      />
    );
  }
  return (
    <button
      data-cell={cellId}
      onClick={() => { setText(value === 0 ? '' : (value / 100).toFixed(2)); setEditing(true); }}
      className="w-full text-right text-sm text-gray-700 hover:bg-blue-50 px-1 py-0.5 rounded"
    >
      {fmt(value)}
    </button>
  );
}

function EditableTextCell({
  value,
  onCommit,
  cellId,
  placeholder = '—',
  className = '',
}: {
  value: string | null;
  onCommit: (val: string) => void;
  cellId: string;
  placeholder?: string;
  className?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState('');
  const ignoreBlur = useRef(false);

  const commit = (raw: string) => {
    setEditing(false);
    onCommit(raw.trim());
  };

  if (editing) {
    return (
      <input
        autoFocus
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={() => {
          if (ignoreBlur.current) { ignoreBlur.current = false; return; }
          commit(text);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            ignoreBlur.current = true;
            commit(text);
            nextCell(cellId);
          }
          if (e.key === 'Escape') {
            ignoreBlur.current = true;
            setEditing(false);
          }
        }}
        className={`w-full text-sm border border-blue-400 rounded px-1 py-0.5 focus:outline-none ${className}`}
      />
    );
  }
  return (
    <button
      data-cell={cellId}
      onClick={() => { setText(value ?? ''); setEditing(true); }}
      className={`w-full text-left text-sm text-gray-700 hover:bg-blue-50 px-1 py-0.5 rounded ${className}`}
    >
      {value || <span className="text-gray-300 italic text-xs">{placeholder}</span>}
    </button>
  );
}

// Column layout (index → group):
// 0  account_number   } info (3 cols)
// 1  account_name     }
// 2  category         } → border-r after idx 2
// 3  unadjusted_debit } Unadjusted (2 cols) → border-r after idx 4
// 4  unadjusted_credit}
// 5  book_adj_debit   } Book Adj. (2 cols) → border-r after idx 6
// 6  book_adj_credit  }
// 7  book_adj_dr(tot) } Book Adjusted (2 cols, blue bg) → border-r after idx 8
// 8  book_adj_cr(tot) }
// 9  tax_adj_debit    } Tax Adj. (2 cols) → border-r after idx 10
// 10 tax_adj_credit   }
// 11 tax_adj_dr(tot)  } Tax Adjusted (2 cols, purple bg) → border-r after idx 12
// 12 tax_adj_cr(tot)  }
// 13 workpaper_ref    } W/P Ref (1 col)

function colGroupClass(idx: number, isHeader = false): string {
  const border = isHeader ? 'border-gray-300' : 'border-gray-200';
  if (idx === 2)  return `border-r ${border}`;
  if (idx === 4)  return `border-r ${border}`;
  if (idx === 6)  return `border-r ${border}`;
  if (idx === 7)  return `bg-blue-50${isHeader ? '' : '/50'}`;
  if (idx === 8)  return `bg-blue-50${isHeader ? '' : '/50'} border-r ${border}`;
  if (idx === 11) return `bg-purple-50${isHeader ? '' : '/50'}`;
  if (idx === 12) return `bg-purple-50${isHeader ? '' : '/50'} border-r ${border}`;
  return '';
}

const columnHelper = createColumnHelper<TBRow>();

export function TrialBalancePage() {
  const { selectedPeriodId } = useUIStore();
  const qc = useQueryClient();
  const [sorting, setSorting] = useState<SortingState>([]);
  // null = unknown (show button), 0 = up to date (hide), >0 = found new (show)
  const [lastSyncCount, setLastSyncCount] = useState<number | null>(null);

  const queryKey = ['trial-balance', selectedPeriodId];

  // Reset sync state whenever the period changes so the button reappears
  useEffect(() => { setLastSyncCount(null); }, [selectedPeriodId]);

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
      setLastSyncCount(res.data.initialized);
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
    mutationFn: ({ accountId, field, value }: { accountId: number; field: 'accountName' | 'workpaperRef'; value: string }) =>
      updateAccount(accountId, { [field]: value || undefined }),
    onMutate: async ({ accountId, field, value }) => {
      await qc.cancelQueries({ queryKey });
      const prev = qc.getQueryData<TBRow[]>(queryKey);
      qc.setQueryData<TBRow[]>(queryKey, (old) =>
        old?.map((r) =>
          r.account_id === accountId
            ? { ...r, ...(field === 'accountName' ? { account_name: value } : { workpaper_ref: value || null }) }
            : r,
        ),
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

  const columns = [
    columnHelper.accessor('account_number', {
      header: 'Acct #',
      cell: (i) => <span className="font-mono text-xs">{i.getValue()}</span>,
    }),
    columnHelper.accessor('account_name', {
      header: 'Account Name',
      cell: (i) => (
        <EditableTextCell
          value={i.getValue()}
          cellId={`account_name|${i.row.index}`}
          onCommit={(v) => { if (v && v !== i.getValue()) accountMutation.mutate({ accountId: i.row.original.account_id, field: 'accountName', value: v }); }}
          className="font-medium"
        />
      ),
    }),
    columnHelper.accessor('category', {
      header: 'Cat.',
      cell: (i) => (
        <span className={`inline-flex px-1.5 py-0.5 rounded text-xs font-medium capitalize ${CATEGORY_COLORS[i.getValue()]}`}>
          {i.getValue().slice(0, 3)}
        </span>
      ),
    }),
    columnHelper.accessor('unadjusted_debit', {
      header: 'Unaj. Dr',
      cell: (i) => (
        <EditableCell
          value={i.getValue()}
          cellId={`unadjusted_debit|${i.row.index}`}
          onCommit={(v) => handleBalanceEdit(i.row.original, 'unadjusted_debit', v)}
        />
      ),
    }),
    columnHelper.accessor('unadjusted_credit', {
      header: 'Unaj. Cr',
      cell: (i) => (
        <EditableCell
          value={i.getValue()}
          cellId={`unadjusted_credit|${i.row.index}`}
          onCommit={(v) => handleBalanceEdit(i.row.original, 'unadjusted_credit', v)}
        />
      ),
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
    columnHelper.accessor('workpaper_ref', {
      header: 'W/P Ref',
      cell: (i) => (
        <EditableTextCell
          value={i.getValue()}
          cellId={`workpaper_ref|${i.row.index}`}
          onCommit={(v) => accountMutation.mutate({ accountId: i.row.original.account_id, field: 'workpaperRef', value: v })}
          placeholder="click to set"
        />
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
    getGroupedRowModel: getGroupedRowModel(),
  });

  const isEmpty = !data || data.length === 0;
  // Show sync button if: no rows yet, OR last sync found new accounts, OR never synced for this period
  const showSyncButton = isEmpty || lastSyncCount === null || lastSyncCount > 0;

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
          {data && <p className="text-xs text-gray-500">{data.length} accounts</p>}
        </div>
        {showSyncButton && (
          <button
            onClick={() => initMutation.mutate()}
            disabled={initMutation.isPending}
            className="px-3 py-1.5 bg-green-600 text-white text-sm rounded hover:bg-green-700 disabled:opacity-50"
            title="Add any COA accounts not yet in this period's trial balance"
          >
            {initMutation.isPending ? 'Syncing...' : isEmpty ? 'Initialize from COA' : 'Sync new accounts'}
          </button>
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
        <div className="flex-1 overflow-auto">
          <table className="w-full text-sm border-collapse">
            <thead className="sticky top-0 z-10">
              {/* Group header row */}
              <tr className="bg-gray-100 border-b border-gray-300">
                <th colSpan={3} className="px-2 py-1 text-xs text-gray-500 border-r border-gray-300"></th>
                <th colSpan={2} className="px-2 py-1 text-xs text-center text-gray-600 font-semibold border-r border-gray-300">Unadjusted</th>
                <th colSpan={2} className="px-2 py-1 text-xs text-center text-blue-600 font-semibold border-r border-gray-300">Book Adj.</th>
                <th colSpan={2} className="px-2 py-1 text-xs text-center text-gray-700 font-semibold bg-blue-50 border-r border-gray-300">Book Adjusted</th>
                <th colSpan={2} className="px-2 py-1 text-xs text-center text-purple-600 font-semibold border-r border-gray-300">Tax Adj.</th>
                <th colSpan={2} className="px-2 py-1 text-xs text-center text-gray-700 font-semibold bg-purple-50 border-r border-gray-300">Tax Adjusted</th>
                <th className="px-2 py-1 text-xs text-center text-gray-500 font-semibold">W/P</th>
              </tr>
              {table.getHeaderGroups().map((hg) => (
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
              {table.getRowModel().rows.length === 0 ? (
                <tr>
                  <td colSpan={14} className="px-4 py-10 text-center text-gray-400">
                    No trial balance data. Click &ldquo;Initialize from COA&rdquo; to populate from the chart of accounts.
                  </td>
                </tr>
              ) : (
                table.getRowModel().rows.map((row, rowIdx) => (
                  <tr key={row.id} className={rowIdx % 2 === 0 ? 'bg-white' : 'bg-gray-50/40'}>
                    {row.getVisibleCells().map((cell, cellIdx) => (
                      <td key={cell.id} className={`px-2 py-1.5 text-gray-700 ${colGroupClass(cellIdx)}`}>
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
