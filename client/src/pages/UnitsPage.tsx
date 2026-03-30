import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useUIStore } from '../store/uiStore';
import {
  listUnits, listUnitAccounts, renameUnit, mergeUnit, clearUnit, bulkAssignUnit, cloneSelected,
  type UnitSummary, type ClonePreviewRow,
} from '../api/units';
import { listAccounts, type Account } from '../api/chartOfAccounts';

const CATEGORY_COLORS: Record<string, string> = {
  assets: 'bg-blue-50 dark:bg-blue-900/40 text-blue-700 dark:text-blue-400',
  liabilities: 'bg-orange-50 dark:bg-orange-900/40 text-orange-700 dark:text-orange-400',
  equity: 'bg-purple-50 dark:bg-purple-900/40 text-purple-700 dark:text-purple-400',
  revenue: 'bg-green-50 dark:bg-green-900/40 text-green-700 dark:text-green-400',
  expenses: 'bg-red-50 dark:bg-red-900/40 text-red-700 dark:text-red-400',
};

function Badge({ value, color }: { value: number; color: string }) {
  if (value === 0) return <span className="text-gray-300 dark:text-gray-600">—</span>;
  return <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium ${color}`}>{value}</span>;
}

// ─── Rename Modal ──────────────────────────────────────────────────────────────
function RenameModal({ unit, clientId, onClose }: { unit: string; clientId: number; onClose: () => void }) {
  const qc = useQueryClient();
  const [to, setTo] = useState(unit);
  const mut = useMutation({
    mutationFn: () => renameUnit(clientId, unit, to.trim()),
    onSuccess: (r) => { if (!r.error) { qc.invalidateQueries({ queryKey: ['units', clientId] }); onClose(); } },
  });
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-sm">
        <div className="flex items-center justify-between px-5 py-4 border-b dark:border-gray-700">
          <h2 className="text-base font-semibold dark:text-white">Rename Unit</h2>
          <button onClick={onClose} className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 text-xl leading-none">&times;</button>
        </div>
        <div className="px-5 py-4 space-y-3">
          <p className="text-sm text-gray-600 dark:text-gray-400">Rename <strong>{unit}</strong> — all accounts will be updated.</p>
          <input
            autoFocus
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="w-full border border-gray-300 dark:border-gray-600 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
          />
          {mut.data?.error && <p className="text-sm text-red-600 dark:text-red-400">{mut.data.error.message}</p>}
          <div className="flex justify-end gap-2 pt-1">
            <button onClick={onClose} className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-700/50 dark:text-gray-300">Cancel</button>
            <button
              onClick={() => mut.mutate()}
              disabled={!to.trim() || to.trim() === unit || mut.isPending}
              className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
            >
              {mut.isPending ? 'Saving…' : 'Rename'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Merge Modal ───────────────────────────────────────────────────────────────
function MergeModal({ unit, allUnits, clientId, onClose }: { unit: string; allUnits: string[]; clientId: number; onClose: () => void }) {
  const qc = useQueryClient();
  const [into, setInto] = useState('');
  const others = allUnits.filter((u) => u !== unit);
  const mut = useMutation({
    mutationFn: () => mergeUnit(clientId, unit, into),
    onSuccess: (r) => { if (!r.error) { qc.invalidateQueries({ queryKey: ['units', clientId] }); onClose(); } },
  });
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-sm">
        <div className="flex items-center justify-between px-5 py-4 border-b dark:border-gray-700">
          <h2 className="text-base font-semibold dark:text-white">Merge Unit</h2>
          <button onClick={onClose} className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 text-xl leading-none">&times;</button>
        </div>
        <div className="px-5 py-4 space-y-3">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Move all accounts from <strong>{unit}</strong> into another unit.
          </p>
          <select
            value={into}
            onChange={(e) => setInto(e.target.value)}
            className="w-full border border-gray-300 dark:border-gray-600 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
          >
            <option value="">— Select target unit —</option>
            {others.map((u) => <option key={u} value={u}>{u}</option>)}
          </select>
          {mut.data?.error && <p className="text-sm text-red-600 dark:text-red-400">{mut.data.error.message}</p>}
          <div className="flex justify-end gap-2 pt-1">
            <button onClick={onClose} className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-700/50 dark:text-gray-300">Cancel</button>
            <button
              onClick={() => mut.mutate()}
              disabled={!into || mut.isPending}
              className="px-3 py-1.5 text-sm bg-orange-600 text-white rounded hover:bg-orange-700 disabled:opacity-50"
            >
              {mut.isPending ? 'Merging…' : 'Merge'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Clear Modal ───────────────────────────────────────────────────────────────
function ClearModal({ unit, count, clientId, onClose }: { unit: string; count: number; clientId: number; onClose: () => void }) {
  const qc = useQueryClient();
  const mut = useMutation({
    mutationFn: () => clearUnit(clientId, unit),
    onSuccess: (r) => { if (!r.error) { qc.invalidateQueries({ queryKey: ['units', clientId] }); onClose(); } },
  });
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-sm">
        <div className="flex items-center justify-between px-5 py-4 border-b dark:border-gray-700">
          <h2 className="text-base font-semibold dark:text-white">Clear Unit Tag</h2>
          <button onClick={onClose} className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 text-xl leading-none">&times;</button>
        </div>
        <div className="px-5 py-4 space-y-3">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Remove the unit tag from all <strong>{count}</strong> account{count !== 1 ? 's' : ''} in <strong>{unit}</strong>.
            They will become unassigned.
          </p>
          <div className="flex justify-end gap-2 pt-1">
            <button onClick={onClose} className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-700/50 dark:text-gray-300">Cancel</button>
            <button
              onClick={() => mut.mutate()}
              disabled={mut.isPending}
              className="px-3 py-1.5 text-sm bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50"
            >
              {mut.isPending ? 'Clearing…' : 'Clear'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Account Drawer ────────────────────────────────────────────────────────────
function AccountDrawer({
  unit, clientId, allUnits, onClose,
}: { unit: string | null; clientId: number; allUnits: string[]; onClose: () => void }) {
  const qc = useQueryClient();
  const [movingId, setMovingId] = useState<number | null>(null);
  const [moveTarget, setMoveTarget] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['unit-accounts', clientId, unit],
    queryFn: async () => {
      const res = await listUnitAccounts(clientId, unit);
      return res.data ?? [];
    },
  });

  const moveMut = useMutation({
    mutationFn: ({ id, target }: { id: number; target: string | null }) =>
      bulkAssignUnit(clientId, [id], target),
    onSuccess: (r) => {
      if (!r.error) {
        qc.invalidateQueries({ queryKey: ['unit-accounts', clientId, unit] });
        qc.invalidateQueries({ queryKey: ['units', clientId] });
        setMovingId(null);
      }
    },
  });

  const title = unit === null ? 'Unassigned Accounts' : `Accounts — ${unit}`;
  const otherUnits = allUnits.filter((u) => u !== unit);

  return (
    <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-2xl max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b dark:border-gray-700 shrink-0">
          <h2 className="text-base font-semibold dark:text-white">{title}</h2>
          <button onClick={onClose} className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 text-xl leading-none">&times;</button>
        </div>
        <div className="overflow-y-auto flex-1">
          {isLoading ? (
            <div className="p-8 text-center text-gray-400 dark:text-gray-500">Loading…</div>
          ) : (data ?? []).length === 0 ? (
            <div className="p-8 text-center text-gray-400 dark:text-gray-500">No accounts.</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b dark:border-gray-700 bg-gray-50 dark:bg-gray-800/60 text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide">
                  <th className="px-4 py-2 text-left">Acct #</th>
                  <th className="px-4 py-2 text-left">Name</th>
                  <th className="px-4 py-2 text-left">Category</th>
                  <th className="px-4 py-2 text-right">Move to</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {(data ?? []).map((a: Account) => (
                  <tr key={a.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                    <td className="px-4 py-2 font-mono text-sm dark:text-gray-300">{a.account_number}</td>
                    <td className="px-4 py-2 dark:text-gray-300">{a.account_name}</td>
                    <td className="px-4 py-2">
                      <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium ${CATEGORY_COLORS[a.category]}`}>
                        {a.category}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-right">
                      {movingId === a.id ? (
                        <div className="flex items-center gap-1 justify-end">
                          <select
                            autoFocus
                            value={moveTarget}
                            onChange={(e) => setMoveTarget(e.target.value)}
                            className="border border-gray-300 dark:border-gray-600 rounded px-1.5 py-0.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                          >
                            <option value="">— unassign —</option>
                            {otherUnits.map((u) => <option key={u} value={u}>{u}</option>)}
                          </select>
                          <button
                            onClick={() => moveMut.mutate({ id: a.id, target: moveTarget || null })}
                            disabled={moveMut.isPending}
                            className="text-xs text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 px-1"
                          >
                            Go
                          </button>
                          <button onClick={() => setMovingId(null)} className="text-xs text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-400 px-1">✕</button>
                        </div>
                      ) : (
                        <button
                          onClick={() => { setMovingId(a.id); setMoveTarget(''); }}
                          className="text-xs text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
                        >
                          Move
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

const CATEGORIES = ['assets', 'liabilities', 'equity', 'revenue', 'expenses'] as const;

const CATEGORY_BUTTON_STYLES: Record<string, { active: string; inactive: string }> = {
  assets:      { active: 'bg-blue-600 text-white border-blue-600',     inactive: 'bg-white dark:bg-gray-700 text-blue-700 dark:text-blue-400 border-blue-300 dark:border-blue-700 hover:bg-blue-50 dark:hover:bg-blue-900/20' },
  liabilities: { active: 'bg-orange-600 text-white border-orange-600', inactive: 'bg-white dark:bg-gray-700 text-orange-700 dark:text-orange-400 border-orange-300 dark:border-orange-700 hover:bg-orange-50 dark:hover:bg-orange-900/20' },
  equity:      { active: 'bg-purple-600 text-white border-purple-600', inactive: 'bg-white dark:bg-gray-700 text-purple-700 dark:text-purple-400 border-purple-300 dark:border-purple-700 hover:bg-purple-50 dark:hover:bg-purple-900/20' },
  revenue:     { active: 'bg-green-600 text-white border-green-600',   inactive: 'bg-white dark:bg-gray-700 text-green-700 dark:text-green-400 border-green-300 dark:border-green-700 hover:bg-green-50 dark:hover:bg-green-900/20' },
  expenses:    { active: 'bg-red-600 text-white border-red-600',       inactive: 'bg-white dark:bg-gray-700 text-red-700 dark:text-red-400 border-red-300 dark:border-red-700 hover:bg-red-50 dark:hover:bg-red-900/20' },
};

// ─── Create Unit Modal ─────────────────────────────────────────────────────────
function CreateUnitModal({
  clientId, onClose,
}: { clientId: number; onClose: () => void }) {
  const qc = useQueryClient();
  const [step, setStep] = useState<'select' | 'preview'>('select');
  const [newUnit, setNewUnit] = useState('');
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [filterText, setFilterText] = useState('');
  const [strategy, setStrategy] = useState<'prefix' | 'suffix'>('prefix');
  const [strategyValue, setStrategyValue] = useState('');
  const [previewRows, setPreviewRows] = useState<ClonePreviewRow[]>([]);
  const [previewStats, setPreviewStats] = useState<{ duplicateCount: number; wouldInsert: number } | null>(null);

  const { data: allAccounts, isLoading } = useQuery({
    queryKey: ['chart-of-accounts', clientId],
    queryFn: async () => {
      const res = await listAccounts(clientId);
      return res.data ?? [];
    },
  });

  const accounts = allAccounts ?? [];

  const filtered = useMemo(() => {
    if (!filterText) return accounts;
    const q = filterText.toLowerCase();
    return accounts.filter((a: Account) =>
      a.account_number.toLowerCase().includes(q) ||
      a.account_name.toLowerCase().includes(q),
    );
  }, [accounts, filterText]);

  const categoryCounts = useMemo(() => {
    const counts: Record<string, { total: number; selected: number }> = {};
    for (const cat of CATEGORIES) counts[cat] = { total: 0, selected: 0 };
    for (const a of filtered) {
      if (a.category in counts) {
        counts[a.category].total++;
        if (selected.has(a.id)) counts[a.category].selected++;
      }
    }
    return counts;
  }, [filtered, selected]);

  const isCategoryFull = (cat: string) => {
    const c = categoryCounts[cat];
    return c.total > 0 && c.selected === c.total;
  };

  const toggleCategory = (cat: string) => {
    const ids = filtered.filter((a: Account) => a.category === cat).map((a: Account) => a.id);
    if (isCategoryFull(cat)) {
      setSelected((s) => { const n = new Set(s); ids.forEach((id) => n.delete(id)); return n; });
    } else {
      setSelected((s) => { const n = new Set(s); ids.forEach((id) => n.add(id)); return n; });
    }
  };

  const previewMut = useMutation({
    mutationFn: () =>
      cloneSelected(clientId, [...selected], newUnit.trim(), strategy, strategyValue, true),
    onSuccess: (r) => {
      if (!r.error && r.data && 'preview' in r.data) {
        setPreviewRows(r.data.preview);
        setPreviewStats({ duplicateCount: r.data.duplicateCount, wouldInsert: r.data.wouldInsert });
        setStep('preview');
      }
    },
  });

  const createMut = useMutation({
    mutationFn: () =>
      selected.size > 0
        ? cloneSelected(clientId, [...selected], newUnit.trim(), strategy, strategyValue, false)
        : Promise.resolve({ data: { inserted: 0 }, error: null }),
    onSuccess: (r) => {
      if (!r.error) {
        qc.invalidateQueries({ queryKey: ['units', clientId] });
        qc.invalidateQueries({ queryKey: ['unit-accounts'] });
        qc.invalidateQueries({ queryKey: ['chart-of-accounts', clientId] });
        onClose();
      }
    },
  });

  const canPreview = newUnit.trim().length > 0 && selected.size > 0 && strategyValue.trim().length > 0;

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-3xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b dark:border-gray-700 shrink-0">
          <h2 className="text-base font-semibold dark:text-white">
            {step === 'select' ? 'Create Unit' : `Preview — ${newUnit}`}
          </h2>
          <button onClick={onClose} className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 text-xl leading-none">&times;</button>
        </div>

        {step === 'select' ? (
          <>
            {/* Unit name */}
            <div className="px-5 pt-3 pb-2 border-b dark:border-gray-700 shrink-0 space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Unit Name <span className="text-red-500">*</span></label>
                <input
                  autoFocus
                  value={newUnit}
                  onChange={(e) => setNewUnit(e.target.value)}
                  placeholder="e.g. Oak Ave, Unit B, Farm South"
                  className="w-full border border-gray-300 dark:border-gray-600 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                />
              </div>

              {/* Account number adjustment */}
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                  Account number adjustment <span className="text-red-500">*</span>
                  <span className="ml-1 font-normal text-gray-400 dark:text-gray-500">(required — account numbers must be unique per client)</span>
                </label>
                <div className="flex items-center gap-2 flex-wrap">
                  {(['prefix', 'suffix'] as const).map((s) => (
                    <label
                      key={s}
                      className={`flex items-center gap-1.5 cursor-pointer px-2.5 py-1 rounded border text-xs font-medium transition-colors ${
                        strategy === s ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:border-gray-300 dark:hover:border-gray-500'
                      }`}
                    >
                      <input type="radio" name="strategy" value={s} checked={strategy === s} onChange={() => { setStrategy(s); setStrategyValue(''); }} className="sr-only" />
                      {s === 'prefix' ? 'Prepend' : 'Append'}
                    </label>
                  ))}
                  <div className="flex items-center gap-1.5 ml-1">
                    <input
                      value={strategyValue}
                      onChange={(e) => setStrategyValue(e.target.value)}
                      placeholder={strategy === 'prefix' ? 'e.g. B-' : 'e.g. -B'}
                      className="border border-gray-300 dark:border-gray-600 rounded px-2 py-1 text-sm w-28 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                    />
                    {strategyValue && (
                      <span className="text-xs text-gray-400 dark:text-gray-500 font-mono">
                        {strategy === 'prefix' ? `"${strategyValue}1010"` : `"1010${strategyValue}"`}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Category toggle buttons */}
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-medium text-gray-500 dark:text-gray-400 mr-1">Select by category:</span>
                {CATEGORIES.map((cat) => {
                  const full = isCategoryFull(cat);
                  const styles = CATEGORY_BUTTON_STYLES[cat];
                  const count = categoryCounts[cat];
                  return (
                    <button
                      key={cat}
                      onClick={() => toggleCategory(cat)}
                      disabled={count.total === 0}
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded border text-xs font-medium transition-colors disabled:opacity-30 disabled:cursor-not-allowed ${full ? styles.active : styles.inactive}`}
                    >
                      <span className="capitalize">{cat}</span>
                      <span className={`text-xs font-bold ${full ? 'opacity-80' : 'opacity-60'}`}>
                        {count.selected}/{count.total}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Search + select-all bar */}
            <div className="px-5 py-2 border-b dark:border-gray-700 shrink-0 flex items-center gap-3">
              <input
                type="text"
                value={filterText}
                onChange={(e) => setFilterText(e.target.value)}
                placeholder="Search accounts…"
                className="border border-gray-300 dark:border-gray-600 rounded px-2 py-1 text-sm w-48 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
              />
              <label className="flex items-center gap-1.5 text-sm text-gray-600 dark:text-gray-400 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={filtered.length > 0 && filtered.every((a: Account) => selected.has(a.id))}
                  onChange={() => {
                    const allSel = filtered.every((a: Account) => selected.has(a.id));
                    setSelected((s) => {
                      const n = new Set(s);
                      filtered.forEach((a: Account) => allSel ? n.delete(a.id) : n.add(a.id));
                      return n;
                    });
                  }}
                  className="rounded"
                />
                Select all ({filtered.length})
              </label>
              {selected.size > 0 && (
                <span className="text-xs text-blue-600 dark:text-blue-400 font-medium">{selected.size} selected</span>
              )}
            </div>

            {/* Account list */}
            <div className="overflow-y-auto flex-1">
              {isLoading ? (
                <div className="p-8 text-center text-gray-400 dark:text-gray-500">Loading…</div>
              ) : filtered.length === 0 ? (
                <div className="p-8 text-center text-gray-400 dark:text-gray-500">No accounts found.</div>
              ) : (
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-white dark:bg-gray-800 border-b dark:border-gray-700">
                    <tr className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide">
                      <th className="px-4 py-2 w-8"></th>
                      <th className="px-2 py-2 text-left">Acct #</th>
                      <th className="px-2 py-2 text-left">Name</th>
                      <th className="px-2 py-2 text-left">Category</th>
                      <th className="px-2 py-2 text-left">Current Unit</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                    {filtered.map((a: Account) => (
                      <tr
                        key={a.id}
                        onClick={() => setSelected((s) => { const n = new Set(s); n.has(a.id) ? n.delete(a.id) : n.add(a.id); return n; })}
                        className={`cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50 ${selected.has(a.id) ? 'bg-blue-50 dark:bg-blue-900/20' : ''}`}
                      >
                        <td className="px-4 py-1.5">
                          <input type="checkbox" checked={selected.has(a.id)} onChange={() => {}} className="rounded" />
                        </td>
                        <td className="px-2 py-1.5 font-mono text-sm dark:text-gray-300">{a.account_number}</td>
                        <td className="px-2 py-1.5 text-gray-800 dark:text-gray-200">{a.account_name}</td>
                        <td className="px-2 py-1.5">
                          <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium ${CATEGORY_COLORS[a.category]}`}>
                            {a.category}
                          </span>
                        </td>
                        <td className="px-2 py-1.5 text-xs text-gray-400 dark:text-gray-500 italic">{a.unit ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* Footer */}
            <div className="px-5 py-3 border-t dark:border-gray-700 shrink-0 flex items-center justify-between">
              <span className="text-xs text-gray-400 dark:text-gray-500">
                {selected.size === 0
                  ? 'Select accounts to include in this unit'
                  : `${selected.size} account${selected.size !== 1 ? 's' : ''} selected`}
              </span>
              <div className="flex gap-2">
                <button onClick={onClose} className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-700/50 dark:text-gray-300">Cancel</button>
                {selected.size === 0 ? (
                  <button
                    onClick={onClose}
                    disabled={!newUnit.trim()}
                    className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                  >
                    Create Empty Unit
                  </button>
                ) : (
                  <button
                    onClick={() => previewMut.mutate()}
                    disabled={!canPreview || previewMut.isPending}
                    className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                  >
                    {previewMut.isPending ? 'Loading…' : `Preview ${selected.size} Accounts →`}
                  </button>
                )}
              </div>
            </div>
          </>
        ) : (
          <>
            {/* Preview step */}
            <div className="px-5 py-3 border-b dark:border-gray-700 shrink-0 flex items-center gap-3 flex-wrap">
              <span className="text-sm text-gray-600 dark:text-gray-400">
                Unit: <strong>{newUnit}</strong>
                {' · '}{strategy === 'prefix' ? 'Prepend' : 'Append'} <code className="bg-gray-100 dark:bg-gray-700 px-1 rounded text-xs">{strategyValue}</code>
              </span>
              {previewStats && previewStats.duplicateCount > 0 && (
                <span className="bg-yellow-100 dark:bg-amber-900/20 text-yellow-800 dark:text-amber-400 text-xs px-2 py-0.5 rounded">
                  {previewStats.duplicateCount} duplicate{previewStats.duplicateCount !== 1 ? 's' : ''} — will skip
                </span>
              )}
              {previewStats && (
                <span className="bg-green-100 dark:bg-green-900/20 text-green-800 dark:text-green-400 text-xs px-2 py-0.5 rounded font-medium">
                  {previewStats.wouldInsert} accounts to create
                </span>
              )}
            </div>

            <div className="overflow-y-auto flex-1">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-white dark:bg-gray-800 border-b dark:border-gray-700">
                  <tr className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide">
                    <th className="px-3 py-2 text-left">Source #</th>
                    <th className="px-3 py-2 text-left">New #</th>
                    <th className="px-3 py-2 text-left">Account Name</th>
                    <th className="px-3 py-2 text-left">Category</th>
                    <th className="px-3 py-2 text-left">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                  {previewRows.map((row, i) => (
                    <tr key={i} className={row.duplicate ? 'bg-yellow-50 dark:bg-amber-900/10' : ''}>
                      <td className="px-3 py-1.5 font-mono dark:text-gray-300">{row.sourceNumber}</td>
                      <td className="px-3 py-1.5 font-mono dark:text-gray-300">{row.newNumber}</td>
                      <td className="px-3 py-1.5 text-gray-700 dark:text-gray-300">{row.accountName}</td>
                      <td className="px-3 py-1.5 capitalize text-gray-500 dark:text-gray-400">{row.category}</td>
                      <td className="px-3 py-1.5">
                        {row.duplicate
                          ? <span className="text-yellow-700 dark:text-amber-400 font-medium">Skip — duplicate</span>
                          : <span className="text-green-700 dark:text-green-400">Create</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {createMut.data?.error && (
              <div className="px-5 py-2 shrink-0">
                <p className="text-sm text-red-600 dark:text-red-400">{createMut.data.error.message}</p>
              </div>
            )}

            <div className="px-5 py-3 border-t dark:border-gray-700 shrink-0 flex justify-end gap-2">
              <button onClick={() => setStep('select')} className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-700/50 dark:text-gray-300">← Back</button>
              <button
                onClick={() => createMut.mutate()}
                disabled={(previewStats?.wouldInsert ?? 0) === 0 || createMut.isPending}
                className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
              >
                {createMut.isPending ? 'Creating…' : `Create ${previewStats?.wouldInsert ?? 0} Accounts`}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Bulk Assign Modal ─────────────────────────────────────────────────────────
function BulkAssignModal({
  clientId, allUnits, sourceUnit, onClose,
}: { clientId: number; allUnits: string[]; sourceUnit: string | null; onClose: () => void }) {
  const qc = useQueryClient();
  const [targetUnit, setTargetUnit] = useState('');
  const [newUnitName, setNewUnitName] = useState('');
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [filterText, setFilterText] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['unit-accounts', clientId, sourceUnit],
    queryFn: async () => {
      const res = await listUnitAccounts(clientId, sourceUnit);
      return res.data ?? [];
    },
  });

  const accounts = data ?? [];
  const filtered = useMemo(
    () => filterText
      ? accounts.filter((a: Account) =>
          a.account_number.toLowerCase().includes(filterText.toLowerCase()) ||
          a.account_name.toLowerCase().includes(filterText.toLowerCase()))
      : accounts,
    [accounts, filterText],
  );

  const toggleAll = () => {
    if (selected.size === filtered.length) setSelected(new Set());
    else setSelected(new Set(filtered.map((a: Account) => a.id)));
  };

  const resolvedTarget = targetUnit === '__new__' ? newUnitName.trim() : targetUnit;

  const mut = useMutation({
    mutationFn: () => bulkAssignUnit(clientId, [...selected], resolvedTarget || null),
    onSuccess: (r) => {
      if (!r.error) {
        qc.invalidateQueries({ queryKey: ['units', clientId] });
        qc.invalidateQueries({ queryKey: ['unit-accounts'] });
        qc.invalidateQueries({ queryKey: ['chart-of-accounts', clientId] });
        onClose();
      }
    },
  });

  const title = sourceUnit === null ? 'Assign Unassigned Accounts' : `Reassign Accounts — ${sourceUnit}`;

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-2xl max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b dark:border-gray-700 shrink-0">
          <h2 className="text-base font-semibold dark:text-white">{title}</h2>
          <button onClick={onClose} className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 text-xl leading-none">&times;</button>
        </div>

        <div className="px-5 py-3 border-b dark:border-gray-700 shrink-0 space-y-2">
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Assign selected accounts to</label>
            <select
              value={targetUnit}
              onChange={(e) => setTargetUnit(e.target.value)}
              className="w-full border border-gray-300 dark:border-gray-600 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
            >
              <option value="">— Unassign (remove unit tag) —</option>
              {allUnits.filter((u) => u !== sourceUnit).map((u) => <option key={u} value={u}>{u}</option>)}
              <option value="__new__">+ New unit name…</option>
            </select>
          </div>
          {targetUnit === '__new__' && (
            <input
              autoFocus
              value={newUnitName}
              onChange={(e) => setNewUnitName(e.target.value)}
              placeholder="Enter new unit name"
              className="w-full border border-gray-300 dark:border-gray-600 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
            />
          )}
        </div>

        <div className="px-5 py-2 border-b dark:border-gray-700 shrink-0 flex items-center gap-3">
          <input
            type="text"
            value={filterText}
            onChange={(e) => setFilterText(e.target.value)}
            placeholder="Search accounts…"
            className="border border-gray-300 dark:border-gray-600 rounded px-2 py-1 text-sm w-48 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
          />
          <label className="flex items-center gap-1.5 text-sm text-gray-600 dark:text-gray-400 cursor-pointer select-none">
            <input type="checkbox" checked={filtered.length > 0 && selected.size === filtered.length} onChange={toggleAll} className="rounded" />
            Select all ({filtered.length})
          </label>
          {selected.size > 0 && (
            <span className="text-xs text-blue-600 font-medium">{selected.size} selected</span>
          )}
        </div>

        <div className="overflow-y-auto flex-1">
          {isLoading ? (
            <div className="p-8 text-center text-gray-400 dark:text-gray-500">Loading…</div>
          ) : (
            <table className="w-full text-sm">
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {filtered.map((a: Account) => (
                  <tr
                    key={a.id}
                    onClick={() => setSelected((s) => { const n = new Set(s); n.has(a.id) ? n.delete(a.id) : n.add(a.id); return n; })}
                    className={`cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50 ${selected.has(a.id) ? 'bg-blue-50 dark:bg-blue-900/20' : ''}`}
                  >
                    <td className="px-4 py-2 w-8">
                      <input type="checkbox" checked={selected.has(a.id)} onChange={() => {}} className="rounded" />
                    </td>
                    <td className="px-2 py-2 font-mono text-sm dark:text-gray-300">{a.account_number}</td>
                    <td className="px-2 py-2 text-gray-800 dark:text-gray-200">{a.account_name}</td>
                    <td className="px-2 py-2">
                      <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium ${CATEGORY_COLORS[a.category]}`}>
                        {a.category}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="px-5 py-3 border-t dark:border-gray-700 shrink-0 flex justify-end gap-2">
          <button onClick={onClose} className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-700/50 dark:text-gray-300">Cancel</button>
          <button
            onClick={() => mut.mutate()}
            disabled={selected.size === 0 || (targetUnit === '__new__' && !newUnitName.trim()) || mut.isPending}
            className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
          >
            {mut.isPending ? 'Assigning…' : `Assign ${selected.size} Account${selected.size !== 1 ? 's' : ''}`}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────
export function UnitsPage() {
  const { selectedClientId } = useUIStore();
  const [modal, setModal] = useState<
    | { type: 'rename'; unit: string }
    | { type: 'merge'; unit: string }
    | { type: 'clear'; unit: string }
    | { type: 'drawer'; unit: string | null }
    | { type: 'assign'; unit: string | null }
    | { type: 'create' }
    | null
  >(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ['units', selectedClientId],
    queryFn: async () => {
      if (!selectedClientId) return [];
      const res = await listUnits(selectedClientId);
      if (res.error) throw new Error(res.error.message);
      return res.data ?? [];
    },
    enabled: selectedClientId !== null,
  });

  const namedUnits = useMemo(
    () => (data ?? []).filter((u: UnitSummary) => u.unit !== null).map((u: UnitSummary) => u.unit as string),
    [data],
  );
  const unassigned = useMemo(
    () => (data ?? []).find((u: UnitSummary) => u.unit === null) ?? null,
    [data],
  );

  const close = () => setModal(null);

  if (!selectedClientId) {
    return (
      <div className="flex items-center justify-center h-full text-gray-400 dark:text-gray-500">
        <div className="text-center">
          <p className="text-lg font-medium dark:text-gray-300">No client selected</p>
          <p className="text-sm mt-1">Choose a client from the sidebar.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Units</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Manage multi-property or multi-entity account groupings</p>
        </div>
        <button
          onClick={() => setModal({ type: 'create' })}
          className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
        >
          + Create Unit
        </button>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 text-red-700 dark:text-red-400 px-4 py-3 rounded text-sm mb-4">{(error as Error).message}</div>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center py-12 text-gray-400 dark:text-gray-500">Loading…</div>
      ) : (data ?? []).filter((u: UnitSummary) => u.unit !== null).length === 0 && !unassigned ? (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 px-4 py-12 text-center text-gray-400 dark:text-gray-500">
          <p className="font-medium dark:text-gray-400">No units defined yet</p>
          <p className="text-sm mt-1">Units are created when accounts in the Chart of Accounts are tagged with a unit name.</p>
          <button onClick={() => setModal({ type: 'create' })} className="mt-4 px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700">
            + Create First Unit
          </button>
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/60 text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                <th className="px-4 py-3 text-left">Unit</th>
                <th className="px-4 py-3 text-center">Total</th>
                <th className="px-4 py-3 text-center">Assets</th>
                <th className="px-4 py-3 text-center">Liabilities</th>
                <th className="px-4 py-3 text-center">Equity</th>
                <th className="px-4 py-3 text-center">Revenue</th>
                <th className="px-4 py-3 text-center">Expenses</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {(data ?? []).filter((u: UnitSummary) => u.unit !== null).map((u: UnitSummary) => (
                <tr key={u.unit} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                  <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">{u.unit}</td>
                  <td className="px-4 py-3 text-center">
                    <button
                      onClick={() => setModal({ type: 'drawer', unit: u.unit })}
                      className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 font-medium"
                    >
                      {u.total}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-center"><Badge value={u.assets} color={CATEGORY_COLORS.assets} /></td>
                  <td className="px-4 py-3 text-center"><Badge value={u.liabilities} color={CATEGORY_COLORS.liabilities} /></td>
                  <td className="px-4 py-3 text-center"><Badge value={u.equity} color={CATEGORY_COLORS.equity} /></td>
                  <td className="px-4 py-3 text-center"><Badge value={u.revenue} color={CATEGORY_COLORS.revenue} /></td>
                  <td className="px-4 py-3 text-center"><Badge value={u.expenses} color={CATEGORY_COLORS.expenses} /></td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center gap-3 justify-end">
                      <button onClick={() => setModal({ type: 'assign', unit: u.unit })} className="text-xs text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200">Assign</button>
                      <button onClick={() => setModal({ type: 'rename', unit: u.unit! })} className="text-xs text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300">Rename</button>
                      <button onClick={() => setModal({ type: 'merge', unit: u.unit! })} className="text-xs text-orange-600 hover:text-orange-800 dark:text-orange-400 dark:hover:text-orange-300">Merge</button>
                      <button onClick={() => setModal({ type: 'clear', unit: u.unit! })} className="text-xs text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300">Clear</button>
                    </div>
                  </td>
                </tr>
              ))}

              {/* Unassigned row */}
              {unassigned && unassigned.total > 0 && (
                <tr className="bg-gray-50/50 dark:bg-gray-700/20">
                  <td className="px-4 py-3 text-gray-400 dark:text-gray-500 italic">Unassigned</td>
                  <td className="px-4 py-3 text-center">
                    <button
                      onClick={() => setModal({ type: 'drawer', unit: null })}
                      className="text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 font-medium"
                    >
                      {unassigned.total}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-center"><Badge value={unassigned.assets} color={CATEGORY_COLORS.assets} /></td>
                  <td className="px-4 py-3 text-center"><Badge value={unassigned.liabilities} color={CATEGORY_COLORS.liabilities} /></td>
                  <td className="px-4 py-3 text-center"><Badge value={unassigned.equity} color={CATEGORY_COLORS.equity} /></td>
                  <td className="px-4 py-3 text-center"><Badge value={unassigned.revenue} color={CATEGORY_COLORS.revenue} /></td>
                  <td className="px-4 py-3 text-center"><Badge value={unassigned.expenses} color={CATEGORY_COLORS.expenses} /></td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => setModal({ type: 'assign', unit: null })} className="text-xs text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300">Assign</button>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Modals */}
      {modal?.type === 'create' && (
        <CreateUnitModal clientId={selectedClientId} onClose={close} />
      )}
      {modal?.type === 'rename' && (
        <RenameModal unit={modal.unit} clientId={selectedClientId} onClose={close} />
      )}
      {modal?.type === 'merge' && (
        <MergeModal unit={modal.unit} allUnits={namedUnits} clientId={selectedClientId} onClose={close} />
      )}
      {modal?.type === 'clear' && (
        <ClearModal
          unit={modal.unit}
          count={(data ?? []).find((u: UnitSummary) => u.unit === modal.unit)?.total ?? 0}
          clientId={selectedClientId}
          onClose={close}
        />
      )}
      {modal?.type === 'drawer' && (
        <AccountDrawer unit={modal.unit} clientId={selectedClientId} allUnits={namedUnits} onClose={close} />
      )}
      {modal?.type === 'assign' && (
        <BulkAssignModal clientId={selectedClientId} allUnits={namedUnits} sourceUnit={modal.unit} onClose={close} />
      )}
    </div>
  );
}
