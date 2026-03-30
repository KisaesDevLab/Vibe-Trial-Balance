// SPDX-License-Identifier: BUSL-1.1
// Copyright (C) 2024–2026 Kisaes LLC

import { useState, useMemo } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { listAccounts, type Account } from '../../api/chartOfAccounts';
import { createPyAje, type PyComparisonAccount } from '../../api/pyComparison';
import { AccountSearchDropdown } from '../AccountSearchDropdown';

function fmt(cents: number): string {
  if (cents === 0) return '—';
  return (Math.abs(cents) / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

interface Props {
  periodId: number;
  clientId: number;
  selectedAccounts: PyComparisonAccount[];
  onAjeCreated: () => void;
}

export function AjePanel({ periodId, clientId, selectedAccounts, onAjeCreated }: Props) {
  const [entryType, setEntryType] = useState<'book' | 'tax'>('book');
  const [description, setDescription] = useState('PY true-up — adjust opening balances to bookkeeper final');
  const [offsetAccountId, setOffsetAccountId] = useState<number | ''>('');
  const [error, setError] = useState<string | null>(null);

  const { data: accountsData } = useQuery({
    queryKey: ['chart-of-accounts', clientId],
    queryFn: async () => {
      const res = await listAccounts(clientId);
      if (res.error) throw new Error(res.error.message);
      return res.data ?? [];
    },
  });
  const accounts: Account[] = accountsData ?? [];

  // Sort equity accounts first for offset dropdown
  const sortedAccounts = useMemo(() => {
    return [...accounts].sort((a, b) => {
      if (a.category === 'equity' && b.category !== 'equity') return -1;
      if (a.category !== 'equity' && b.category === 'equity') return 1;
      return a.account_number.localeCompare(b.account_number);
    });
  }, [accounts]);

  // Build preview JE lines
  const jePreview = useMemo(() => {
    const lines: Array<{ accountId: number; accountNumber: string; accountName: string; debit: number; credit: number }> = [];
    let totalDebit = 0;
    let totalCredit = 0;

    for (const a of selectedAccounts) {
      const netVariance = (a.varianceDebit - a.varianceCredit);
      if (netVariance === 0) continue;
      const debit = netVariance > 0 ? netVariance : 0;
      const credit = netVariance < 0 ? Math.abs(netVariance) : 0;
      lines.push({ accountId: a.accountId, accountNumber: a.accountNumber, accountName: a.accountName, debit, credit });
      totalDebit += debit;
      totalCredit += credit;
    }

    // Offset line
    const offsetAcct = offsetAccountId !== '' ? accounts.find((a) => a.id === offsetAccountId) : null;
    const offsetDebit = totalCredit > totalDebit ? totalCredit - totalDebit : 0;
    const offsetCredit = totalDebit > totalCredit ? totalDebit - totalCredit : 0;
    if (offsetAcct) {
      lines.push({
        accountId: offsetAcct.id,
        accountNumber: offsetAcct.account_number,
        accountName: offsetAcct.account_name,
        debit: offsetDebit,
        credit: offsetCredit,
      });
      totalDebit += offsetDebit;
      totalCredit += offsetCredit;
    }

    return { lines, totalDebit, totalCredit, balanced: totalDebit === totalCredit && totalDebit > 0 };
  }, [selectedAccounts, offsetAccountId, accounts]);

  const mutation = useMutation({
    mutationFn: () => createPyAje(periodId, {
      entryType,
      description: description || undefined,
      offsetAccountId: offsetAccountId as number,
      accountIds: selectedAccounts.map((a) => a.accountId),
    }),
    onSuccess: (res) => {
      if (res.error) { setError(res.error.message); return; }
      onAjeCreated();
    },
    onError: (e) => setError(e.message),
  });

  return (
    <div className="border-t-2 border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-900/10 px-6 py-4 shrink-0">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
          Create AJE from {selectedAccounts.length} variance{selectedAccounts.length !== 1 ? 's' : ''}
        </h3>
        <div className="flex items-center gap-3">
          <select
            value={entryType}
            onChange={(e) => setEntryType(e.target.value as 'book' | 'tax')}
            className="border border-gray-300 dark:border-gray-600 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
          >
            <option value="book">Book AJE</option>
            <option value="tax">Tax AJE</option>
          </select>
        </div>
      </div>

      {error && <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 text-red-700 dark:text-red-400 px-3 py-2 rounded text-xs mb-3">{error}</div>}

      <div className="grid grid-cols-2 gap-4 mb-3">
        <div>
          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Description</label>
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full border border-gray-300 dark:border-gray-600 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Offset Account</label>
          <AccountSearchDropdown
            accounts={sortedAccounts}
            value={offsetAccountId}
            onChange={(id) => setOffsetAccountId(id)}
            placeholder="Select offset account..."
          />
        </div>
      </div>

      {/* JE Preview */}
      <div className="bg-white dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700 overflow-hidden mb-3">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-gray-50 dark:bg-gray-800/60 border-b border-gray-200 dark:border-gray-700">
              <th className="px-2 py-1.5 text-left font-semibold text-gray-600 dark:text-gray-400">Account</th>
              <th className="px-2 py-1.5 text-right font-semibold text-gray-600 dark:text-gray-400 w-28">Debit</th>
              <th className="px-2 py-1.5 text-right font-semibold text-gray-600 dark:text-gray-400 w-28">Credit</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
            {jePreview.lines.map((l, i) => (
              <tr key={i} className={i === jePreview.lines.length - 1 && offsetAccountId !== '' ? 'bg-blue-50/50 dark:bg-blue-900/10' : ''}>
                <td className="px-2 py-1 text-gray-700 dark:text-gray-300">
                  <span className="font-mono font-medium">{l.accountNumber}</span>
                  <span className="ml-1 text-gray-500 dark:text-gray-400">— {l.accountName}</span>
                </td>
                <td className="px-2 py-1 text-right font-mono tabular-nums">{l.debit > 0 ? fmt(l.debit) : '—'}</td>
                <td className="px-2 py-1 text-right font-mono tabular-nums">{l.credit > 0 ? fmt(l.credit) : '—'}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800/60 font-semibold">
              <td className="px-2 py-1.5 text-gray-600 dark:text-gray-400">Totals</td>
              <td className={`px-2 py-1.5 text-right font-mono tabular-nums ${jePreview.balanced ? 'text-green-700 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                {fmt(jePreview.totalDebit)}
              </td>
              <td className={`px-2 py-1.5 text-right font-mono tabular-nums ${jePreview.balanced ? 'text-green-700 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                {fmt(jePreview.totalCredit)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      <div className="flex justify-end">
        <button
          onClick={() => mutation.mutate()}
          disabled={mutation.isPending || !jePreview.balanced || offsetAccountId === ''}
          className="px-4 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
        >
          {mutation.isPending ? 'Creating...' : `Create ${entryType === 'book' ? 'Book' : 'Tax'} AJE`}
        </button>
      </div>
    </div>
  );
}
