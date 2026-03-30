// SPDX-License-Identifier: BUSL-1.1
// Copyright (C) 2024–2026 Kisaes LLC

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getJournalEntry,
  updateJournalEntry,
  deleteJournalEntry,
  type JournalEntry,
} from '../api/journalEntries';
import { listAccounts, type Account } from '../api/chartOfAccounts';
import { AccountSearchDropdown } from './AccountSearchDropdown';
import { QuickAddAccountModal } from './QuickAddAccountModal';
import { DateInput } from './DateInput';
import { evalAndFormatAmount } from '../utils/evalAmountExpr';

// ── Helpers ──────────────────────────────────────────────────────────────────

function fmt(cents: number): string {
  if (cents === 0) return '—';
  return (cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function parseCents(val: string): number {
  const n = parseFloat(val.replace(/[^0-9.-]/g, ''));
  return isNaN(n) ? 0 : Math.round(n * 100);
}

function centsToStr(cents: number): string {
  return cents === 0 ? '' : (cents / 100).toFixed(2);
}

interface FormLine {
  accountId: number | '';
  debit: string;
  credit: string;
}

interface Props {
  journalEntryId: number;
  clientId: number;
  onClose: () => void;
  onSaved: () => void;
}

const TYPE_LABEL: Record<string, string> = { book: 'Book AJE', tax: 'Tax AJE', trans: 'Transaction' };

export function JournalEntryEditDialog({ journalEntryId, clientId, onClose, onSaved }: Props) {
  const qc = useQueryClient();
  const [entryType, setEntryType] = useState<'book' | 'tax'>('book');
  const [entryDate, setEntryDate] = useState('');
  const [description, setDescription] = useState('');
  const [lines, setLines] = useState<FormLine[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isTrans, setIsTrans] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [quickAddLineIdx, setQuickAddLineIdx] = useState<number | null>(null);

  const { data: jeData, isLoading: jeLoading } = useQuery({
    queryKey: ['journal-entry', journalEntryId],
    queryFn: async () => {
      const res = await getJournalEntry(journalEntryId);
      if (res.error) throw new Error(res.error.message);
      return res.data!;
    },
  });

  const { data: accountsData } = useQuery({
    queryKey: ['chart-of-accounts', clientId],
    queryFn: async () => {
      const res = await listAccounts(clientId);
      if (res.error) throw new Error(res.error.message);
      return res.data;
    },
  });
  const accounts: Account[] = accountsData ?? [];

  // Populate form when JE data loads
  useEffect(() => {
    if (jeData && !loaded) {
      setEntryType(jeData.entry_type === 'trans' ? 'book' : jeData.entry_type);
      setEntryDate(jeData.entry_date.slice(0, 10));
      setDescription(jeData.description ?? '');
      setIsTrans(jeData.entry_type === 'trans');
      setLines(
        jeData.lines.map((l) => ({
          accountId: l.account_id,
          debit: centsToStr(l.debit),
          credit: centsToStr(l.credit),
        })),
      );
      setLoaded(true);
    }
  }, [jeData, loaded]);

  const totalDebit = lines.reduce((s, l) => s + parseCents(l.debit), 0);
  const totalCredit = lines.reduce((s, l) => s + parseCents(l.credit), 0);
  const balanced = totalDebit === totalCredit && totalDebit > 0;

  const setLine = (idx: number, field: keyof FormLine, value: string | number) =>
    setLines((prev) => prev.map((l, i) => (i === idx ? { ...l, [field]: value } : l)));

  const addLine = () => setLines((prev) => [...prev, { accountId: '', debit: '', credit: '' }]);
  const removeLine = (idx: number) => setLines((prev) => prev.filter((_, i) => i !== idx));

  const saveMutation = useMutation({
    mutationFn: (data: Parameters<typeof updateJournalEntry>[1]) => updateJournalEntry(journalEntryId, data),
    onSuccess: (res) => {
      if (res.error) { setError(res.error.message); return; }
      // Invalidate all related caches
      qc.invalidateQueries({ queryKey: ['general-ledger'] });
      qc.invalidateQueries({ queryKey: ['trial-balance'] });
      qc.invalidateQueries({ queryKey: ['journal-entries'] });
      qc.invalidateQueries({ queryKey: ['journal-entry'] });
      qc.invalidateQueries({ queryKey: ['bank-transactions'] });
      onSaved();
    },
    onError: (e) => setError(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteJournalEntry(journalEntryId),
    onSuccess: (res) => {
      if (res.error) { setError(res.error.message); return; }
      qc.invalidateQueries({ queryKey: ['general-ledger'] });
      qc.invalidateQueries({ queryKey: ['trial-balance'] });
      qc.invalidateQueries({ queryKey: ['journal-entries'] });
      qc.invalidateQueries({ queryKey: ['bank-transactions'] });
      onSaved();
    },
    onError: (e) => setError(e.message),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!balanced) return;
    setError(null);
    const validLines = lines.filter((l) => l.accountId !== '');
    saveMutation.mutate({
      ...(isTrans ? {} : { entryType }),
      entryDate,
      description: description || null,
      lines: validLines.map((l) => ({
        accountId: l.accountId as number,
        debit: parseCents(l.debit),
        credit: parseCents(l.credit),
      })),
    });
  };

  const handleDelete = () => {
    if (!confirm('Delete this journal entry? This cannot be undone.')) return;
    deleteMutation.mutate();
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div role="dialog" aria-modal="true" className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-visible">
        <div className="flex items-center justify-between px-5 py-4 border-b dark:border-gray-700 shrink-0">
          <div>
            <h2 className="text-base font-semibold dark:text-white">
              Edit {isTrans ? 'Transaction' : 'Journal Entry'}
              {jeData && ` #${jeData.entry_number}`}
            </h2>
            {jeData && (
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                {TYPE_LABEL[jeData.entry_type] ?? jeData.entry_type}
                {isTrans && ' — changes will sync to the linked bank transaction'}
              </p>
            )}
          </div>
          <button onClick={onClose} className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 text-xl leading-none">&times;</button>
        </div>
        <div className="px-5 py-4 overflow-visible">
          {jeLoading ? (
            <div className="py-8 text-center text-gray-400 dark:text-gray-500">Loading...</div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 text-red-700 dark:text-red-400 px-3 py-2 rounded text-sm">{error}</div>}

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Type</label>
                  {isTrans ? (
                    <div className="w-full border border-gray-200 dark:border-gray-600 rounded px-2 py-1.5 text-sm bg-gray-50 dark:bg-gray-700 text-gray-500 dark:text-gray-400">Transaction</div>
                  ) : (
                    <select
                      value={entryType}
                      onChange={(e) => setEntryType(e.target.value as 'book' | 'tax')}
                      className="w-full border border-gray-300 dark:border-gray-600 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                    >
                      <option value="book">Book AJE</option>
                      <option value="tax">Tax AJE</option>
                    </select>
                  )}
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Date</label>
                  <DateInput
                    value={entryDate}
                    onChange={(e) => setEntryDate(e.target.value)}
                    required
                    className="w-full border border-gray-300 dark:border-gray-600 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Description</label>
                  <input
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Optional memo"
                    className="w-full border border-gray-300 dark:border-gray-600 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white dark:placeholder-gray-400"
                  />
                </div>
              </div>

              <div>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/60">
                      <th className="px-2 py-1.5 text-left text-xs font-semibold text-gray-600 dark:text-gray-400">Account</th>
                      <th className="px-2 py-1.5 text-right text-xs font-semibold text-gray-600 dark:text-gray-400 w-36">Debit</th>
                      <th className="px-2 py-1.5 text-right text-xs font-semibold text-gray-600 dark:text-gray-400 w-36">Credit</th>
                      <th className="w-8"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                    {lines.map((line, idx) => (
                      <tr key={idx}>
                        <td className="px-1 py-1">
                          <AccountSearchDropdown
                            accounts={accounts}
                            value={line.accountId}
                            onChange={(accountId) => setLine(idx, 'accountId', accountId)}
                            onCreateNew={() => setQuickAddLineIdx(idx)}
                          />
                        </td>
                        <td className="px-1 py-1">
                          <input
                            value={line.debit}
                            onChange={(e) => setLine(idx, 'debit', e.target.value)}
                            onBlur={(e) => setLine(idx, 'debit', evalAndFormatAmount(e.target.value))}
                            onKeyDown={(e) => { if (e.key === 'Enter') setLine(idx, 'debit', evalAndFormatAmount((e.target as HTMLInputElement).value)); }}
                            placeholder="0.00"
                            className="w-full text-right border border-gray-300 dark:border-gray-600 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white dark:placeholder-gray-400"
                          />
                        </td>
                        <td className="px-1 py-1">
                          <input
                            value={line.credit}
                            onChange={(e) => setLine(idx, 'credit', e.target.value)}
                            onBlur={(e) => setLine(idx, 'credit', evalAndFormatAmount(e.target.value))}
                            onKeyDown={(e) => { if (e.key === 'Enter') setLine(idx, 'credit', evalAndFormatAmount((e.target as HTMLInputElement).value)); }}
                            placeholder="0.00"
                            className="w-full text-right border border-gray-300 dark:border-gray-600 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white dark:placeholder-gray-400"
                          />
                        </td>
                        <td className="px-1 py-1 text-center">
                          {lines.length > 2 && (
                            <button type="button" onClick={() => removeLine(idx)} className="text-gray-400 dark:text-gray-500 hover:text-red-500 text-lg leading-none">&times;</button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800/60">
                      <td className="px-2 py-1.5 text-xs text-gray-500 dark:text-gray-400">
                        <button type="button" onClick={addLine} className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 text-xs">+ Add line</button>
                      </td>
                      <td className={`px-2 py-1.5 text-right text-sm font-semibold ${balanced ? 'text-green-700 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                        {fmt(totalDebit)}
                      </td>
                      <td className={`px-2 py-1.5 text-right text-sm font-semibold ${balanced ? 'text-green-700 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                        {fmt(totalCredit)}
                      </td>
                      <td></td>
                    </tr>
                  </tfoot>
                </table>

                {!balanced && totalDebit > 0 && (
                  <p className="text-xs text-red-600 dark:text-red-400 mt-1">
                    Entry is out of balance by {fmt(Math.abs(totalDebit - totalCredit))}.
                  </p>
                )}
              </div>

              <div className="flex justify-between pt-2">
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={saveMutation.isPending || deleteMutation.isPending}
                  className="px-3 py-1.5 text-sm text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 disabled:opacity-50"
                >
                  Delete Entry
                </button>
                <div className="flex gap-2">
                  <button type="button" onClick={onClose} className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-700/50 dark:text-gray-300">Cancel</button>
                  <button
                    type="submit"
                    disabled={saveMutation.isPending || !balanced}
                    className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                  >
                    {saveMutation.isPending ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              </div>
            </form>
          )}
        </div>
      </div>
      {quickAddLineIdx !== null && (
        <QuickAddAccountModal
          clientId={clientId}
          onClose={() => setQuickAddLineIdx(null)}
          onCreated={(accountId) => {
            setLine(quickAddLineIdx, 'accountId', accountId);
            setQuickAddLineIdx(null);
          }}
        />
      )}
    </div>
  );
}
