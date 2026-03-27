// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2024–2026 [Project Author]

import { useState, useCallback, useRef } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { listAccounts, type Account } from '../../api/chartOfAccounts';
import { savePyManual, getComparison } from '../../api/pyComparison';

function parseCents(val: string): number {
  const n = parseFloat(val.replace(/[^0-9.-]/g, ''));
  return isNaN(n) ? 0 : Math.round(n * 100);
}


interface Props {
  periodId: number;
  clientId: number;
  onClose: () => void;
  onSuccess: () => void;
}

interface EntryRow {
  accountId: number;
  accountNumber: string;
  accountName: string;
  category: string;
  balance: string; // positive = debit, negative = credit
}

const CATEGORY_ORDER: Record<string, number> = { assets: 0, liabilities: 1, equity: 2, revenue: 3, expenses: 4 };

export function ManualEntryGrid({ periodId, clientId, onClose, onSuccess }: Props) {
  const [rows, setRows] = useState<EntryRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const tableRef = useRef<HTMLTableElement>(null);

  // Load COA accounts
  const { isLoading: loadingAccounts } = useQuery({
    queryKey: ['chart-of-accounts', clientId],
    queryFn: async () => {
      const res = await listAccounts(clientId);
      if (res.error) throw new Error(res.error.message);
      return res.data ?? [];
    },
    enabled: !loaded,
  });

  // Load existing PY data to pre-populate
  const { isLoading: loadingPy } = useQuery({
    queryKey: ['py-comparison-prefill', periodId],
    queryFn: async () => {
      const res = await getComparison(periodId);
      if (res.error) throw new Error(res.error.message);
      return res.data;
    },
    enabled: !loaded,
  });

  // Build rows once both queries are done
  useQuery({
    queryKey: ['manual-entry-init', clientId, periodId],
    queryFn: async () => {
      const acctRes = await listAccounts(clientId);
      const accounts: Account[] = acctRes.data ?? [];
      const pyRes = await getComparison(periodId);
      const pyData = pyRes.data;

      const pyMap = new Map<number, { dr: number; cr: number }>();
      if (pyData) {
        for (const a of pyData.accounts) {
          pyMap.set(a.accountId, { dr: a.uploadedPyDebit, cr: a.uploadedPyCredit });
        }
      }

      const sorted = accounts
        .filter((a) => a.is_active)
        .sort((a, b) => {
          const catDiff = (CATEGORY_ORDER[a.category] ?? 9) - (CATEGORY_ORDER[b.category] ?? 9);
          if (catDiff !== 0) return catDiff;
          return a.account_number.localeCompare(b.account_number);
        });

      setRows(sorted.map((a) => {
        const existing = pyMap.get(a.id);
        const net = existing ? existing.dr - existing.cr : 0;
        return {
          accountId: a.id,
          accountNumber: a.account_number,
          accountName: a.account_name,
          category: a.category,
          balance: net !== 0 ? (net / 100).toFixed(2) : '',
        };
      }));
      setLoaded(true);
      return null;
    },
    enabled: !loaded,
  });

  const setCell = useCallback((idx: number, value: string) => {
    setRows((prev) => prev.map((r, i) => i === idx ? { ...r, balance: value } : r));
  }, []);

  // Handle paste from Excel: fill down from current cell
  const handlePaste = useCallback((e: React.ClipboardEvent, startIdx: number) => {
    const text = e.clipboardData.getData('text/plain');
    const values = text.split(/\r?\n/).map((v) => v.trim()).filter(Boolean);
    if (values.length <= 1) return; // Let browser handle single-value paste
    e.preventDefault();
    setRows((prev) => {
      const next = [...prev];
      for (let i = 0; i < values.length && startIdx + i < next.length; i++) {
        next[startIdx + i] = { ...next[startIdx + i], balance: values[i] };
      }
      return next;
    });
  }, []);

  const mutation = useMutation({
    mutationFn: async () => {
      const accounts = rows
        .filter((r) => r.balance.trim())
        .map((r) => {
          const net = parseCents(r.balance);
          return {
            accountId: r.accountId,
            debit: net > 0 ? net : 0,
            credit: net < 0 ? Math.abs(net) : 0,
          };
        })
        .filter((r) => r.debit > 0 || r.credit > 0);

      if (accounts.length === 0) throw new Error('No balances entered.');
      return savePyManual(periodId, accounts);
    },
    onSuccess: (res) => {
      if (res.error) { setError(res.error.message); return; }
      onSuccess();
    },
    onError: (e) => setError(e.message),
  });

  const isLoading = loadingAccounts || loadingPy || !loaded;

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-4xl max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b dark:border-gray-700 shrink-0">
          <div>
            <h2 className="text-base font-semibold dark:text-white">Manual PY Entry</h2>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Enter prior year balances (positive = debit, negative = credit). Supports paste from Excel.</p>
          </div>
          <button onClick={onClose} className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 text-xl leading-none">&times;</button>
        </div>

        <div className="flex-1 overflow-auto px-5 py-3">
          {isLoading ? (
            <div className="flex items-center justify-center py-12 text-gray-400 dark:text-gray-500">Loading accounts...</div>
          ) : (
            <>
              {error && <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 text-red-700 dark:text-red-400 px-3 py-2 rounded text-sm mb-3">{error}</div>}
              <table ref={tableRef} className="w-full text-sm border-collapse">
                <thead className="sticky top-0 z-10 bg-white dark:bg-gray-800">
                  <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/60">
                    <th className="px-2 py-1.5 text-left text-xs font-semibold text-gray-600 dark:text-gray-400">Acct #</th>
                    <th className="px-2 py-1.5 text-left text-xs font-semibold text-gray-600 dark:text-gray-400">Account Name</th>
                    <th className="px-2 py-1.5 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 w-16">Cat.</th>
                    <th className="px-2 py-1.5 text-right text-xs font-semibold text-gray-600 dark:text-gray-400 w-36">PY Balance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                  {rows.map((row, idx) => (
                    <tr key={row.accountId} className={idx % 2 === 0 ? 'bg-white dark:bg-gray-800' : 'bg-gray-50/40 dark:bg-gray-700/20'}>
                      <td className="px-2 py-1 font-mono text-xs text-gray-900 dark:text-white">{row.accountNumber}</td>
                      <td className="px-2 py-1 text-gray-700 dark:text-gray-300 truncate max-w-[16rem]">{row.accountName}</td>
                      <td className="px-2 py-1 text-xs text-gray-500 dark:text-gray-400 capitalize">{row.category.slice(0, 3)}</td>
                      <td className="px-1 py-0.5">
                        <input
                          value={row.balance}
                          onChange={(e) => setCell(idx, e.target.value)}
                          onPaste={(e) => handlePaste(e, idx)}
                          placeholder="0.00"
                          tabIndex={idx + 1}
                          className="w-full text-right border border-gray-200 dark:border-gray-600 rounded px-2 py-0.5 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-blue-500 dark:bg-gray-700 dark:text-white dark:placeholder-gray-500"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </div>

        <div className="px-5 py-3 border-t dark:border-gray-700 flex justify-between items-center shrink-0">
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {rows.filter((r) => r.balance.trim()).length} of {rows.length} accounts with balances
          </p>
          <div className="flex gap-2">
            <button onClick={onClose} className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-700/50 dark:text-gray-300">Cancel</button>
            <button
              onClick={() => mutation.mutate()}
              disabled={mutation.isPending}
              className="px-4 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
            >
              {mutation.isPending ? 'Saving...' : 'Save PY Balances'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
