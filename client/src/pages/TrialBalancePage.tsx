import { useState, useCallback } from 'react';
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
import { useUIStore } from '../store/uiStore';

// Cents → display string
function fmt(cents: number): string {
  if (cents === 0) return '—';
  return (cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// Display string → cents (strips commas/$ etc)
function parseCents(val: string): number {
  const n = parseFloat(val.replace(/[^0-9.-]/g, ''));
  if (isNaN(n)) return 0;
  return Math.round(n * 100);
}

const CATEGORY_COLORS: Record<string, string> = {
  assets: 'bg-blue-50 text-blue-700',
  liabilities: 'bg-orange-50 text-orange-700',
  equity: 'bg-purple-50 text-purple-700',
  revenue: 'bg-green-50 text-green-700',
  expenses: 'bg-red-50 text-red-700',
};

// Editable cell for unadjusted debit/credit
function EditableCell({
  value,
  onCommit,
}: {
  value: number;
  onCommit: (cents: number) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState('');

  if (editing) {
    return (
      <input
        autoFocus
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={() => {
          setEditing(false);
          onCommit(parseCents(text));
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') { setEditing(false); onCommit(parseCents(text)); }
          if (e.key === 'Escape') setEditing(false);
        }}
        className="w-full text-right text-sm border border-blue-400 rounded px-1 py-0.5 focus:outline-none"
      />
    );
  }
  return (
    <button
      onClick={() => { setText(value === 0 ? '' : (value / 100).toFixed(2)); setEditing(true); }}
      className="w-full text-right text-sm text-gray-700 hover:bg-blue-50 px-1 py-0.5 rounded"
      title="Click to edit"
    >
      {fmt(value)}
    </button>
  );
}

const columnHelper = createColumnHelper<TBRow>();

export function TrialBalancePage() {
  const { selectedPeriodId } = useUIStore();
  const qc = useQueryClient();
  const [sorting, setSorting] = useState<SortingState>([]);

  const queryKey = ['trial-balance', selectedPeriodId];

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
    onSuccess: () => qc.invalidateQueries({ queryKey }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ accountId, debit, credit }: { accountId: number; debit: number; credit: number }) =>
      updateBalance(selectedPeriodId!, accountId, debit, credit),
    onMutate: async ({ accountId, debit, credit }) => {
      // Optimistic update
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
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(queryKey, ctx.prev);
    },
    onSettled: () => qc.invalidateQueries({ queryKey }),
  });

  const handleBalanceEdit = useCallback(
    (row: TBRow, field: 'unadjusted_debit' | 'unadjusted_credit', newCents: number) => {
      updateMutation.mutate({
        accountId: row.account_id,
        debit: field === 'unadjusted_debit' ? newCents : row.unadjusted_debit,
        credit: field === 'unadjusted_credit' ? newCents : row.unadjusted_credit,
      });
    },
    [updateMutation],
  );

  const columns = [
    columnHelper.accessor('account_number', {
      header: 'Acct #',
      cell: (i) => <span className="font-mono text-xs">{i.getValue()}</span>,
      size: 80,
    }),
    columnHelper.accessor('account_name', {
      header: 'Account Name',
      cell: (i) => <span className="font-medium text-sm">{i.getValue()}</span>,
    }),
    columnHelper.accessor('category', {
      header: 'Cat.',
      cell: (i) => (
        <span className={`inline-flex px-1.5 py-0.5 rounded text-xs font-medium capitalize ${CATEGORY_COLORS[i.getValue()]}`}>
          {i.getValue().slice(0, 3)}
        </span>
      ),
      size: 60,
    }),
    columnHelper.accessor('unadjusted_debit', {
      header: 'Unaj. Dr',
      cell: (i) => (
        <EditableCell
          value={i.getValue()}
          onCommit={(v) => handleBalanceEdit(i.row.original, 'unadjusted_debit', v)}
        />
      ),
    }),
    columnHelper.accessor('unadjusted_credit', {
      header: 'Unaj. Cr',
      cell: (i) => (
        <EditableCell
          value={i.getValue()}
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
      header: 'Bk Adj Dr',
      cell: (i) => <span className="text-right block text-sm font-semibold">{fmt(i.getValue())}</span>,
    }),
    columnHelper.accessor('book_adjusted_credit', {
      header: 'Bk Adj Cr',
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
      header: 'Tx Adj Dr',
      cell: (i) => <span className="text-right block text-sm font-semibold">{fmt(i.getValue())}</span>,
    }),
    columnHelper.accessor('tax_adjusted_credit', {
      header: 'Tx Adj Cr',
      cell: (i) => <span className="text-right block text-sm font-semibold">{fmt(i.getValue())}</span>,
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
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b bg-white shrink-0">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Trial Balance</h2>
          {data && <p className="text-xs text-gray-500">{data.length} accounts</p>}
        </div>
        <div className="flex gap-2">
          {data?.length === 0 && (
            <button
              onClick={() => initMutation.mutate()}
              disabled={initMutation.isPending}
              className="px-3 py-1.5 bg-green-600 text-white text-sm rounded hover:bg-green-700 disabled:opacity-50"
            >
              {initMutation.isPending ? 'Initializing...' : 'Initialize from COA'}
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
        <div className="flex-1 overflow-auto">
          {/* Column group headers */}
          <table className="w-full text-sm border-collapse">
            <thead className="sticky top-0 z-10">
              <tr className="bg-gray-100 border-b border-gray-300">
                <th colSpan={3} className="px-2 py-1 text-xs text-gray-500 border-r border-gray-300 text-left"></th>
                <th colSpan={2} className="px-2 py-1 text-xs text-center text-gray-600 font-semibold border-r border-gray-300">Unadjusted</th>
                <th colSpan={2} className="px-2 py-1 text-xs text-center text-blue-600 font-semibold border-r border-gray-300">Book Adj.</th>
                <th colSpan={2} className="px-2 py-1 text-xs text-center text-gray-700 font-semibold bg-blue-50 border-r border-gray-300">Book Adjusted</th>
                <th colSpan={2} className="px-2 py-1 text-xs text-center text-purple-600 font-semibold border-r border-gray-300">Tax Adj.</th>
                <th colSpan={2} className="px-2 py-1 text-xs text-center text-gray-700 font-semibold bg-purple-50">Tax Adjusted</th>
              </tr>
              {table.getHeaderGroups().map((hg) => (
                <tr key={hg.id} className="bg-gray-50 border-b border-gray-200">
                  {hg.headers.map((header, idx) => {
                    const groupClass =
                      idx < 3 ? 'border-r border-gray-300' :
                      idx === 4 ? 'border-r border-gray-300' :
                      idx === 6 ? 'border-r border-gray-300' :
                      idx === 8 ? 'bg-blue-50 border-r border-gray-300' :
                      idx === 10 ? 'border-r border-gray-300' :
                      idx >= 11 ? 'bg-purple-50' : '';
                    return (
                      <th
                        key={header.id}
                        onClick={header.column.getToggleSortingHandler()}
                        className={`px-2 py-2 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider cursor-pointer whitespace-nowrap select-none ${groupClass}`}
                      >
                        {flexRender(header.column.columnDef.header, header.getContext())}
                        {header.column.getIsSorted() === 'asc' && ' ↑'}
                        {header.column.getIsSorted() === 'desc' && ' ↓'}
                      </th>
                    );
                  })}
                </tr>
              ))}
            </thead>
            <tbody className="divide-y divide-gray-100">
              {table.getRowModel().rows.length === 0 ? (
                <tr>
                  <td colSpan={13} className="px-4 py-10 text-center text-gray-400">
                    No trial balance data. Click &ldquo;Initialize from COA&rdquo; to populate from the chart of accounts.
                  </td>
                </tr>
              ) : (
                table.getRowModel().rows.map((row, rowIdx) => (
                  <tr key={row.id} className={rowIdx % 2 === 0 ? 'bg-white' : 'bg-gray-50/40'}>
                    {row.getVisibleCells().map((cell, cellIdx) => {
                      const groupClass =
                        cellIdx < 3 ? 'border-r border-gray-200' :
                        cellIdx === 4 ? 'border-r border-gray-200' :
                        cellIdx === 6 ? 'border-r border-gray-200' :
                        cellIdx === 8 ? 'bg-blue-50/50 border-r border-gray-200' :
                        cellIdx === 10 ? 'border-r border-gray-200' :
                        cellIdx >= 11 ? 'bg-purple-50/50' : '';
                      return (
                        <td key={cell.id} className={`px-2 py-1.5 text-gray-700 ${groupClass}`}>
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </td>
                      );
                    })}
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
