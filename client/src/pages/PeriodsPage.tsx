import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  listPeriods,
  createPeriod,
  updatePeriod,
  deletePeriod,
  lockPeriod,
  unlockPeriod,
  rollForwardPeriod,
  type Period,
  type PeriodInput,
  type RollForwardInput,
} from '../api/periods';
import { useUIStore, useAuthStore } from '../store/uiStore';

function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <h2 className="text-base font-semibold">{title}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
        </div>
        <div className="px-5 py-4">{children}</div>
      </div>
    </div>
  );
}

interface PeriodFormProps {
  initial?: Partial<PeriodInput>;
  onSave: (input: PeriodInput) => void;
  onCancel: () => void;
  saving: boolean;
  error: string | null;
}

function PeriodForm({ initial, onSave, onCancel, saving, error }: PeriodFormProps) {
  const [form, setForm] = useState<PeriodInput>({
    periodName: initial?.periodName ?? '',
    startDate: initial?.startDate ?? '',
    endDate: initial?.endDate ?? '',
    isCurrent: initial?.isCurrent ?? false,
  });

  const set = <K extends keyof PeriodInput>(k: K, v: PeriodInput[K]) =>
    setForm((p) => ({ ...p, [k]: v }));

  return (
    <form onSubmit={(e) => { e.preventDefault(); onSave({ ...form, startDate: form.startDate || undefined, endDate: form.endDate || undefined }); }} className="space-y-4">
      {error && <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded text-sm">{error}</div>}
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">Period Name</label>
        <input
          value={form.periodName}
          onChange={(e) => set('periodName', e.target.value)}
          placeholder="e.g. FY 2025, Q1 2025"
          className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          required
          autoFocus
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Start Date</label>
          <input
            type="date"
            value={form.startDate ?? ''}
            onChange={(e) => set('startDate', e.target.value)}
            className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">End Date</label>
          <input
            type="date"
            value={form.endDate ?? ''}
            onChange={(e) => set('endDate', e.target.value)}
            className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>
      <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
        <input
          type="checkbox"
          checked={form.isCurrent ?? false}
          onChange={(e) => set('isCurrent', e.target.checked)}
          className="rounded border-gray-300 text-blue-600"
        />
        Mark as current period
      </label>
      <div className="flex justify-end gap-2 pt-2">
        <button type="button" onClick={onCancel} className="px-3 py-1.5 text-sm border border-gray-300 rounded hover:bg-gray-50">Cancel</button>
        <button type="submit" disabled={saving} className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50">
          {saving ? 'Saving...' : 'Save'}
        </button>
      </div>
    </form>
  );
}

function RollForwardModal({ source, onClose, onSuccess }: { source: Period; onClose: () => void; onSuccess: () => void }) {
  const [form, setForm] = useState<RollForwardInput>({
    periodName: `${source.period_name} (copy)`,
    startDate: '',
    endDate: '',
    isCurrent: false,
    copyRecurringJEs: true,
  });
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ tbCount: number; jeCopied: number } | null>(null);

  const mutation = useMutation({
    mutationFn: (input: RollForwardInput) => rollForwardPeriod(source.id, input),
    onSuccess: (res) => {
      if (res.error) { setError(res.error.message); return; }
      setResult({ tbCount: res.data!.tbCount, jeCopied: res.data!.jeCopied });
      onSuccess();
    },
  });

  const set = <K extends keyof RollForwardInput>(k: K, v: RollForwardInput[K]) =>
    setForm((p) => ({ ...p, [k]: v }));

  return (
    <Modal title={`Roll Forward — ${source.period_name}`} onClose={onClose}>
      {result ? (
        <div className="space-y-4">
          <div className="bg-green-50 border border-green-200 rounded px-4 py-3 text-sm text-green-800">
            New period created. <strong>{result.tbCount}</strong> TB accounts rolled forward
            {result.jeCopied > 0 && <>, <strong>{result.jeCopied}</strong> recurring JE{result.jeCopied !== 1 ? 's' : ''} copied</>}.
          </div>
          <div className="flex justify-end">
            <button onClick={onClose} className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700">Done</button>
          </div>
        </div>
      ) : (
        <form onSubmit={(e) => { e.preventDefault(); mutation.mutate(form); }} className="space-y-4">
          {error && <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded text-sm">{error}</div>}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">New Period Name</label>
            <input
              value={form.periodName}
              onChange={(e) => set('periodName', e.target.value)}
              className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              required autoFocus
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Start Date</label>
              <input type="date" value={form.startDate ?? ''} onChange={(e) => set('startDate', e.target.value)}
                className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">End Date</label>
              <input type="date" value={form.endDate ?? ''} onChange={(e) => set('endDate', e.target.value)}
                className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
              <input type="checkbox" checked={form.copyRecurringJEs ?? true} onChange={(e) => set('copyRecurringJEs', e.target.checked)}
                className="rounded border-gray-300 text-blue-600" />
              Copy recurring journal entries to new period
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
              <input type="checkbox" checked={form.isCurrent ?? false} onChange={(e) => set('isCurrent', e.target.checked)}
                className="rounded border-gray-300 text-blue-600" />
              Mark new period as current
            </label>
          </div>
          <p className="text-xs text-gray-500">
            Book-adjusted balances from <strong>{source.period_name}</strong> will become the opening unadjusted balances in the new period.
          </p>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="px-3 py-1.5 text-sm border border-gray-300 rounded hover:bg-gray-50">Cancel</button>
            <button type="submit" disabled={mutation.isPending}
              className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50">
              {mutation.isPending ? 'Creating…' : 'Create New Period'}
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
}

export function PeriodsPage() {
  const { selectedClientId, setSelectedPeriodId } = useUIStore();
  const isAdmin = useAuthStore((s) => s.user?.role === 'admin');
  const qc = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);
  const [editPeriod, setEditPeriod] = useState<Period | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [rollForwardSource, setRollForwardSource] = useState<Period | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ['periods', selectedClientId],
    queryFn: async () => {
      if (!selectedClientId) return [];
      const res = await listPeriods(selectedClientId);
      if (res.error) throw new Error(res.error.message);
      return res.data;
    },
    enabled: selectedClientId !== null,
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ['periods', selectedClientId] });

  const createMutation = useMutation({
    mutationFn: (input: PeriodInput) => createPeriod(selectedClientId!, input),
    onSuccess: (res) => {
      if (res.error) { setFormError(res.error.message); return; }
      invalidate(); setShowAdd(false); setFormError(null);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, input }: { id: number; input: Partial<PeriodInput> }) => updatePeriod(id, input),
    onSuccess: (res) => {
      if (res.error) { setFormError(res.error.message); return; }
      invalidate(); setEditPeriod(null); setFormError(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deletePeriod,
    onSuccess: () => invalidate(),
  });

  const lockMutation = useMutation({
    mutationFn: lockPeriod,
    onSuccess: () => invalidate(),
  });

  const unlockMutation = useMutation({
    mutationFn: unlockPeriod,
    onSuccess: () => invalidate(),
  });

  if (!selectedClientId) {
    return (
      <div className="flex items-center justify-center h-full text-gray-400">
        <div className="text-center">
          <p className="text-lg font-medium">No client selected</p>
          <p className="text-sm mt-1">Choose a client from the sidebar.</p>
        </div>
      </div>
    );
  }

  const periods = data ?? [];

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Periods</h2>
          <p className="text-sm text-gray-500 mt-0.5">{periods.length} period{periods.length !== 1 ? 's' : ''}</p>
        </div>
        <button
          onClick={() => { setShowAdd(true); setFormError(null); }}
          className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
        >
          + Add Period
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded text-sm mb-4">{error.message}</div>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center py-12 text-gray-400">Loading...</div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Period</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Start</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">End</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Status</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Lock</th>
                <th className="px-4 py-2.5"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {periods.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-gray-400">
                    No periods yet. Click &ldquo;+ Add Period&rdquo; to create one.
                  </td>
                </tr>
              ) : (
                periods.map((p) => (
                  <tr key={p.id} className="hover:bg-gray-50">
                    <td className="px-4 py-2.5 font-medium text-gray-900">{p.period_name}</td>
                    <td className="px-4 py-2.5 text-gray-600">{p.start_date?.slice(0, 10) ?? '—'}</td>
                    <td className="px-4 py-2.5 text-gray-600">{p.end_date?.slice(0, 10) ?? '—'}</td>
                    <td className="px-4 py-2.5">
                      {p.is_current ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-700">Current</span>
                      ) : (
                        <button
                          onClick={() => updateMutation.mutate({ id: p.id, input: { isCurrent: true } })}
                          className="text-xs text-gray-400 hover:text-blue-600"
                        >
                          Set current
                        </button>
                      )}
                    </td>
                    <td className="px-4 py-2.5">
                      {p.locked_at ? (
                        <div className="flex items-center gap-2">
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-700">Locked</span>
                          {isAdmin && (
                            <button
                              onClick={() => { if (confirm(`Unlock "${p.period_name}"? Changes will be permitted again.`)) unlockMutation.mutate(p.id); }}
                              className="text-xs text-gray-400 hover:text-blue-600"
                            >
                              Unlock
                            </button>
                          )}
                        </div>
                      ) : (
                        <button
                          onClick={() => { if (confirm(`Lock "${p.period_name}"? No changes can be made until unlocked.`)) lockMutation.mutate(p.id); }}
                          className="text-xs text-gray-400 hover:text-amber-600"
                        >
                          Lock
                        </button>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-right whitespace-nowrap">
                      <button
                        onClick={() => { setSelectedPeriodId(p.id); }}
                        className="text-xs text-green-600 hover:text-green-800 mr-3"
                      >
                        Select
                      </button>
                      <button
                        onClick={() => setRollForwardSource(p)}
                        className="text-xs text-indigo-600 hover:text-indigo-800 mr-3"
                      >
                        Roll Forward
                      </button>
                      <button
                        onClick={() => { setEditPeriod(p); setFormError(null); }}
                        disabled={!!p.locked_at}
                        className="text-xs text-blue-600 hover:text-blue-800 mr-3 disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => { if (confirm(`Delete "${p.period_name}"?`)) deleteMutation.mutate(p.id); }}
                        disabled={!!p.locked_at}
                        className="text-xs text-red-500 hover:text-red-700 disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {showAdd && (
        <Modal title="Add Period" onClose={() => setShowAdd(false)}>
          <PeriodForm
            onSave={(input) => createMutation.mutate(input)}
            onCancel={() => setShowAdd(false)}
            saving={createMutation.isPending}
            error={formError}
          />
        </Modal>
      )}

      {rollForwardSource && (
        <RollForwardModal
          source={rollForwardSource}
          onClose={() => setRollForwardSource(null)}
          onSuccess={() => { invalidate(); setRollForwardSource(null); }}
        />
      )}

      {editPeriod && (
        <Modal title="Edit Period" onClose={() => setEditPeriod(null)}>
          <PeriodForm
            initial={{
              periodName: editPeriod.period_name,
              startDate: editPeriod.start_date?.slice(0, 10) ?? '',
              endDate: editPeriod.end_date?.slice(0, 10) ?? '',
              isCurrent: editPeriod.is_current,
            }}
            onSave={(input) => updateMutation.mutate({ id: editPeriod.id, input })}
            onCancel={() => setEditPeriod(null)}
            saving={updateMutation.isPending}
            error={formError}
          />
        </Modal>
      )}
    </div>
  );
}
