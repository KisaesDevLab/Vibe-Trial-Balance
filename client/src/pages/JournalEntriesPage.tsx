import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  listJournalEntries,
  createJournalEntry,
  updateJournalEntry,
  deleteJournalEntry,
  type JournalEntry,
  type JEInput,
} from '../api/journalEntries';
import { listAccounts, type Account } from '../api/chartOfAccounts';
import { useUIStore } from '../store/uiStore';

function fmt(cents: number): string {
  if (cents === 0) return '—';
  return (cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function parseCents(val: string): number {
  const n = parseFloat(val.replace(/[^0-9.-]/g, ''));
  return isNaN(n) ? 0 : Math.round(n * 100);
}

function fmtDate(dateStr: string): string {
  return dateStr.slice(0, 10);
}

function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-3xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b shrink-0">
          <h2 className="text-base font-semibold">{title}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
        </div>
        <div className="px-5 py-4 overflow-auto">{children}</div>
      </div>
    </div>
  );
}

interface JEFormLine {
  accountId: number | '';
  debit: string;
  credit: string;
}

function JEForm({
  periodId,
  clientId,
  onSave,
  onCancel,
  saving,
  error,
  initialType,
  initialDate,
  initialDescription,
  initialLines,
}: {
  periodId: number;
  clientId: number;
  onSave: (input: JEInput) => void;
  onCancel: () => void;
  saving: boolean;
  error: string | null;
  initialType?: 'book' | 'tax';
  initialDate?: string;
  initialDescription?: string;
  initialLines?: JEFormLine[];
}) {
  const [entryType, setEntryType] = useState<'book' | 'tax'>(initialType ?? 'book');
  const [entryDate, setEntryDate] = useState(initialDate ?? new Date().toISOString().slice(0, 10));
  const [description, setDescription] = useState(initialDescription ?? '');
  const [lines, setLines] = useState<JEFormLine[]>(
    initialLines ?? [
      { accountId: '', debit: '', credit: '' },
      { accountId: '', debit: '', credit: '' },
    ],
  );

  const { data: accountsData } = useQuery({
    queryKey: ['chart-of-accounts', clientId],
    queryFn: async () => {
      const res = await listAccounts(clientId);
      if (res.error) throw new Error(res.error.message);
      return res.data;
    },
  });
  const accounts: Account[] = accountsData ?? [];

  const totalDebit = lines.reduce((s, l) => s + parseCents(l.debit), 0);
  const totalCredit = lines.reduce((s, l) => s + parseCents(l.credit), 0);
  const balanced = totalDebit === totalCredit && totalDebit > 0;

  const setLine = (idx: number, field: keyof JEFormLine, value: string | number) =>
    setLines((prev) => prev.map((l, i) => i === idx ? { ...l, [field]: value } : l));

  const addLine = () => setLines((prev) => [...prev, { accountId: '', debit: '', credit: '' }]);
  const removeLine = (idx: number) => setLines((prev) => prev.filter((_, i) => i !== idx));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!balanced) return;
    const validLines = lines.filter((l) => l.accountId !== '');
    onSave({
      periodId,
      entryType,
      entryDate,
      description: description || undefined,
      lines: validLines.map((l) => ({
        accountId: l.accountId as number,
        debit: parseCents(l.debit),
        credit: parseCents(l.credit),
      })),
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded text-sm">{error}</div>}

      <div className="grid grid-cols-3 gap-4">
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Type</label>
          <select
            value={entryType}
            onChange={(e) => setEntryType(e.target.value as 'book' | 'tax')}
            className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="book">Book AJE</option>
            <option value="tax">Tax AJE</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Date</label>
          <input
            type="date"
            value={entryDate}
            onChange={(e) => setEntryDate(e.target.value)}
            required
            className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Description</label>
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Optional memo"
            className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      <div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50">
              <th className="px-2 py-1.5 text-left text-xs font-semibold text-gray-600">Account</th>
              <th className="px-2 py-1.5 text-right text-xs font-semibold text-gray-600 w-36">Debit</th>
              <th className="px-2 py-1.5 text-right text-xs font-semibold text-gray-600 w-36">Credit</th>
              <th className="w-8"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {lines.map((line, idx) => (
              <tr key={idx}>
                <td className="px-1 py-1">
                  <select
                    value={line.accountId}
                    onChange={(e) => setLine(idx, 'accountId', e.target.value ? Number(e.target.value) : '')}
                    className="w-full border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select account…</option>
                    {accounts.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.account_number} – {a.account_name}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-1 py-1">
                  <input
                    value={line.debit}
                    onChange={(e) => setLine(idx, 'debit', e.target.value)}
                    placeholder="0.00"
                    className="w-full text-right border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </td>
                <td className="px-1 py-1">
                  <input
                    value={line.credit}
                    onChange={(e) => setLine(idx, 'credit', e.target.value)}
                    placeholder="0.00"
                    className="w-full text-right border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </td>
                <td className="px-1 py-1 text-center">
                  {lines.length > 2 && (
                    <button type="button" onClick={() => removeLine(idx)} className="text-gray-400 hover:text-red-500 text-lg leading-none">&times;</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t border-gray-300 bg-gray-50">
              <td className="px-2 py-1.5 text-xs text-gray-500">
                <button type="button" onClick={addLine} className="text-blue-600 hover:text-blue-800 text-xs">+ Add line</button>
              </td>
              <td className={`px-2 py-1.5 text-right text-sm font-semibold ${balanced ? 'text-green-700' : 'text-red-600'}`}>
                {fmt(totalDebit)}
              </td>
              <td className={`px-2 py-1.5 text-right text-sm font-semibold ${balanced ? 'text-green-700' : 'text-red-600'}`}>
                {fmt(totalCredit)}
              </td>
              <td></td>
            </tr>
          </tfoot>
        </table>
        {!balanced && totalDebit > 0 && (
          <p className="text-xs text-red-600 mt-1">
            Entry is out of balance by {fmt(Math.abs(totalDebit - totalCredit))}.
          </p>
        )}
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <button type="button" onClick={onCancel} className="px-3 py-1.5 text-sm border border-gray-300 rounded hover:bg-gray-50">Cancel</button>
        <button
          type="submit"
          disabled={saving || !balanced}
          className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
        >
          {saving ? 'Saving...' : 'Save Entry'}
        </button>
      </div>
    </form>
  );
}

function JEDetail({ entry }: { entry: JournalEntry }) {
  const totalDebit = entry.lines.reduce((s, l) => s + l.debit, 0);
  const totalCredit = entry.lines.reduce((s, l) => s + l.credit, 0);
  return (
    <div className="mt-2 border-t border-gray-100 pt-2">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-gray-500">
            <th className="text-left pb-1 font-medium">Account</th>
            <th className="text-right pb-1 font-medium w-28">Debit</th>
            <th className="text-right pb-1 font-medium w-28">Credit</th>
          </tr>
        </thead>
        <tbody>
          {entry.lines.map((l, i) => (
            <tr key={i} className="border-t border-gray-100">
              <td className="py-0.5 text-gray-700">{l.account_number} – {l.account_name}</td>
              <td className="py-0.5 text-right text-gray-700">{l.debit > 0 ? fmt(l.debit) : ''}</td>
              <td className="py-0.5 text-right text-gray-700">{l.credit > 0 ? fmt(l.credit) : ''}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t border-gray-300 font-semibold text-gray-700">
            <td className="pt-1">Total</td>
            <td className="pt-1 text-right">{fmt(totalDebit)}</td>
            <td className="pt-1 text-right">{fmt(totalCredit)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

export function JournalEntriesPage() {
  const { selectedPeriodId, selectedClientId } = useUIStore();
  const qc = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);
  const [editEntry, setEditEntry] = useState<JournalEntry | null>(null);
  // collapsed tracks which entries are folded; default = all expanded
  const [collapsed, setCollapsed] = useState<Set<number>>(new Set());
  const [formError, setFormError] = useState<string | null>(null);

  const queryKey = ['journal-entries', selectedPeriodId];

  const { data, isLoading, error } = useQuery({
    queryKey,
    queryFn: async () => {
      if (!selectedPeriodId) return [];
      const res = await listJournalEntries(selectedPeriodId);
      if (res.error) throw new Error(res.error.message);
      return res.data;
    },
    enabled: selectedPeriodId !== null,
  });

  const invalidateBoth = () => {
    qc.invalidateQueries({ queryKey });
    qc.invalidateQueries({ queryKey: ['trial-balance', selectedPeriodId] });
  };

  const createMutation = useMutation({
    mutationFn: createJournalEntry,
    onSuccess: (res) => {
      if (res.error) { setFormError(res.error.message); return; }
      invalidateBoth();
      setShowAdd(false);
      setFormError(null);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Parameters<typeof updateJournalEntry>[1] }) =>
      updateJournalEntry(id, data),
    onSuccess: (res) => {
      if (res.error) { setFormError(res.error.message); return; }
      invalidateBoth();
      setEditEntry(null);
      setFormError(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteJournalEntry,
    onSuccess: () => invalidateBoth(),
  });

  const toggleCollapsed = (id: number) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
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

  const entries = data ?? [];
  const bookEntries = entries.filter((e) => e.entry_type === 'book');
  const taxEntries = entries.filter((e) => e.entry_type === 'tax');

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Journal Entries</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            {bookEntries.length} book · {taxEntries.length} tax
          </p>
        </div>
        <button
          onClick={() => { setShowAdd(true); setFormError(null); }}
          className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
        >
          + New Entry
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded text-sm mb-4">{error.message}</div>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center py-12 text-gray-400">Loading...</div>
      ) : entries.length === 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 px-4 py-10 text-center text-gray-400">
          No journal entries yet. Click &ldquo;+ New Entry&rdquo; to add an AJE.
        </div>
      ) : (
        <div className="space-y-3">
          {entries.map((entry) => {
            const isExpanded = !collapsed.has(entry.id);
            return (
              <div key={entry.id} className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                <div
                  className="flex items-center px-4 py-3 cursor-pointer hover:bg-gray-50"
                  onClick={() => toggleCollapsed(entry.id)}
                >
                  <span className={`inline-flex px-2 py-0.5 rounded text-xs font-semibold mr-3 ${entry.entry_type === 'book' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'}`}>
                    {entry.entry_type === 'book' ? 'BOOK' : 'TAX'} #{entry.entry_number}
                  </span>
                  <span className="text-sm font-medium text-gray-700 flex-1">{entry.description ?? '(no description)'}</span>
                  <span className="text-sm text-gray-400 mr-4">{fmtDate(entry.entry_date)}</span>
                  <button
                    onClick={(e) => { e.stopPropagation(); setEditEntry(entry); setFormError(null); }}
                    className="text-xs text-blue-500 hover:text-blue-700 mr-3"
                  >
                    Edit
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); if (confirm('Delete this entry?')) deleteMutation.mutate(entry.id); }}
                    className="text-xs text-red-400 hover:text-red-600 mr-2"
                  >
                    Delete
                  </button>
                  <span className="text-gray-400 text-sm">{isExpanded ? '▲' : '▼'}</span>
                </div>
                {isExpanded && (
                  <div className="px-4 pb-4">
                    <JEDetail entry={entry} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {showAdd && selectedClientId && (
        <Modal title="New Journal Entry" onClose={() => setShowAdd(false)}>
          <JEForm
            periodId={selectedPeriodId}
            clientId={selectedClientId}
            onSave={(input) => createMutation.mutate(input)}
            onCancel={() => setShowAdd(false)}
            saving={createMutation.isPending}
            error={formError}
          />
        </Modal>
      )}

      {editEntry && selectedClientId && (
        <Modal title="Edit Journal Entry" onClose={() => { setEditEntry(null); setFormError(null); }}>
          <JEForm
            periodId={selectedPeriodId}
            clientId={selectedClientId}
            initialType={editEntry.entry_type}
            initialDate={fmtDate(editEntry.entry_date)}
            initialDescription={editEntry.description ?? ''}
            initialLines={editEntry.lines.map((l) => ({
              accountId: l.account_id,
              debit: l.debit > 0 ? (l.debit / 100).toFixed(2) : '',
              credit: l.credit > 0 ? (l.credit / 100).toFixed(2) : '',
            }))}
            onSave={(input) =>
              updateMutation.mutate({
                id: editEntry.id,
                data: {
                  entryType: input.entryType,
                  entryDate: input.entryDate,
                  description: input.description ?? null,
                  lines: input.lines,
                },
              })
            }
            onCancel={() => { setEditEntry(null); setFormError(null); }}
            saving={updateMutation.isPending}
            error={formError}
          />
        </Modal>
      )}
    </div>
  );
}
