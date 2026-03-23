import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  listSystemTickmarks, createSystemTickmark, updateSystemTickmark, deleteSystemTickmark,
  TICKMARK_COLOR_CLASSES, type SystemTickmark, type TickmarkInput, type TickmarkColor,
} from '../api/tickmarks';

const COLORS: TickmarkColor[] = ['gray', 'blue', 'green', 'red', 'purple', 'amber'];

const COLOR_SWATCH: Record<TickmarkColor, string> = {
  gray:   'bg-gray-400',
  blue:   'bg-blue-400',
  green:  'bg-green-400',
  red:    'bg-red-400',
  purple: 'bg-purple-400',
  amber:  'bg-amber-400',
};

function ColorPicker({ value, onChange }: { value: TickmarkColor; onChange: (c: TickmarkColor) => void }) {
  return (
    <div className="flex items-center gap-1">
      {COLORS.map((c) => (
        <button
          key={c}
          type="button"
          onClick={() => onChange(c)}
          title={c}
          className={`w-5 h-5 rounded-full ${COLOR_SWATCH[c]} ${value === c ? 'ring-2 ring-offset-1 ring-gray-700' : 'opacity-60 hover:opacity-100'}`}
        />
      ))}
    </div>
  );
}

function TickmarkForm({
  initial,
  onSave,
  onCancel,
  saving,
}: {
  initial?: Partial<TickmarkInput>;
  onSave: (input: TickmarkInput) => void;
  onCancel?: () => void;
  saving: boolean;
}) {
  const [symbol, setSymbol] = useState(initial?.symbol ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [color, setColor] = useState<TickmarkColor>(initial?.color ?? 'gray');
  const [sortOrder, setSortOrder] = useState(String(initial?.sortOrder ?? 0));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!symbol.trim() || !description.trim()) return;
    onSave({ symbol: symbol.trim(), description: description.trim(), color, sortOrder: Number(sortOrder) || 0 });
  };

  return (
    <form onSubmit={handleSubmit} className="flex items-end gap-2 flex-wrap">
      <div>
        <label className="block text-xs text-gray-500 dark:text-gray-400 mb-0.5">Symbol</label>
        <input
          value={symbol}
          onChange={(e) => setSymbol(e.target.value)}
          maxLength={10}
          placeholder="A"
          className="border border-gray-300 dark:border-gray-600 rounded px-2 py-1.5 text-sm w-20 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
        />
      </div>
      <div className="flex-1 min-w-48">
        <label className="block text-xs text-gray-500 dark:text-gray-400 mb-0.5">Description</label>
        <input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          maxLength={500}
          placeholder="Agreed to bank statement"
          className="border border-gray-300 dark:border-gray-600 rounded px-2 py-1.5 text-sm w-full focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
        />
      </div>
      <div>
        <label className="block text-xs text-gray-500 dark:text-gray-400 mb-0.5">Color</label>
        <ColorPicker value={color} onChange={setColor} />
      </div>
      <div>
        <label className="block text-xs text-gray-500 dark:text-gray-400 mb-0.5">Order</label>
        <input
          type="number"
          value={sortOrder}
          onChange={(e) => setSortOrder(e.target.value)}
          className="border border-gray-300 dark:border-gray-600 rounded px-2 py-1.5 text-sm w-16 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
        />
      </div>
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={saving || !symbol.trim() || !description.trim()}
          className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
        {onCancel && (
          <button type="button" onClick={onCancel} className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-700/50 dark:text-gray-300">
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}

export function SystemTickmarksPage() {
  const qc = useQueryClient();
  const [editId, setEditId] = useState<number | null>(null);

  const qk = ['system-tickmarks'];

  const { data, isLoading } = useQuery({
    queryKey: qk,
    queryFn: async () => {
      const res = await listSystemTickmarks();
      if (res.error) throw new Error(res.error.message);
      return res.data ?? ([] as SystemTickmark[]);
    },
  });

  const createMut = useMutation({
    mutationFn: (input: TickmarkInput) => createSystemTickmark(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk }),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, input }: { id: number; input: Partial<TickmarkInput> }) => updateSystemTickmark(id, input),
    onSuccess: () => { qc.invalidateQueries({ queryKey: qk }); setEditId(null); },
  });

  const deleteMut = useMutation({
    mutationFn: deleteSystemTickmark,
    onSuccess: () => qc.invalidateQueries({ queryKey: qk }),
  });

  const tickmarks = data ?? [];

  return (
    <div className="p-6 max-w-3xl">
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Default Tickmarks</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
          Define firm-wide default tickmarks. These can be applied to any client's library from the Tickmarks page.
        </p>
      </div>

      {/* Add new */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 px-5 py-4 mb-6">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Add Default Tickmark</h3>
        <TickmarkForm
          onSave={(input) => createMut.mutate(input)}
          saving={createMut.isPending}
        />
        {createMut.isError && (
          <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 text-red-700 dark:text-red-400 px-4 py-3 rounded mt-2 text-sm">
            {(createMut.error as Error).message}
          </div>
        )}
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="text-sm text-gray-400 dark:text-gray-500 text-center py-8">Loading…</div>
      ) : tickmarks.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 px-5 py-10 text-center text-gray-400 dark:text-gray-500 text-sm">
          No default tickmarks defined. Add one above.
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-800/60 border-b border-gray-200 dark:border-gray-700">
              <tr>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 w-20">Symbol</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 dark:text-gray-400">Description</th>
                <th className="px-4 py-2.5 text-center text-xs font-semibold text-gray-500 dark:text-gray-400 w-16">Order</th>
                <th className="px-4 py-2.5 text-right text-xs font-semibold text-gray-500 dark:text-gray-400 w-28">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {tickmarks.map((tm) =>
                editId === tm.id ? (
                  <tr key={tm.id} className="bg-blue-50/40 dark:bg-blue-900/20">
                    <td colSpan={4} className="px-4 py-3">
                      <TickmarkForm
                        initial={{ symbol: tm.symbol, description: tm.description, color: tm.color, sortOrder: tm.sort_order }}
                        onSave={(input) => updateMut.mutate({ id: tm.id, input })}
                        onCancel={() => setEditId(null)}
                        saving={updateMut.isPending}
                      />
                    </td>
                  </tr>
                ) : (
                  <tr key={tm.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                    <td className="px-4 py-2.5">
                      <span className={`inline-flex items-center justify-center w-8 h-8 rounded text-sm font-bold ${TICKMARK_COLOR_CLASSES[tm.color]}`}>
                        {tm.symbol}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-gray-700 dark:text-gray-300">{tm.description}</td>
                    <td className="px-4 py-2.5 text-center text-gray-500 dark:text-gray-400">{tm.sort_order}</td>
                    <td className="px-4 py-2.5 text-right">
                      <button
                        onClick={() => setEditId(tm.id)}
                        className="text-xs text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 mr-3"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => {
                          if (confirm('Delete this default tickmark? Existing client libraries are not affected.'))
                            deleteMut.mutate(tm.id);
                        }}
                        className="text-xs text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ),
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
