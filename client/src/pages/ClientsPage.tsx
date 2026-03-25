import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  listClients,
  createClient,
  updateClient,
  deleteClient,
  type Client,
  type ClientInput,
} from '../api/clients';
import { useUIStore } from '../store/uiStore';

const ENTITY_TYPES = ['1065', '1120', '1120S', '1040_C'] as const;
const TAX_SOFTWARE = ['ultratax', 'cch', 'lacerte', 'drake'] as const;
const ACTIVITY_TYPES = [
  { value: 'business',     label: 'Business' },
  { value: 'rental',       label: 'Rental' },
  { value: 'farm',         label: 'Farm' },
  { value: 'farm_rental',  label: 'Farm Rental' },
] as const;

function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-lg">
        <div className="flex items-center justify-between px-5 py-4 border-b dark:border-gray-700">
          <h2 className="text-base font-semibold dark:text-white">{title}</h2>
          <button onClick={onClose} className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 text-xl leading-none">&times;</button>
        </div>
        <div className="px-5 py-4">{children}</div>
      </div>
    </div>
  );
}

interface ClientFormProps {
  initial?: Partial<ClientInput>;
  onSave: (input: ClientInput) => void;
  onCancel: () => void;
  saving: boolean;
  error: string | null;
}

function ClientForm({ initial, onSave, onCancel, saving, error }: ClientFormProps) {
  const [form, setForm] = useState<ClientInput>({
    name: initial?.name ?? '',
    entityType: initial?.entityType ?? '1065',
    taxYearEnd: initial?.taxYearEnd ?? '1231',
    defaultTaxSoftware: initial?.defaultTaxSoftware ?? 'ultratax',
    taxId: initial?.taxId ?? '',
    activityType: initial?.activityType ?? 'business',
  });

  const set = <K extends keyof ClientInput>(k: K, v: ClientInput[K]) =>
    setForm((p) => ({ ...p, [k]: v }));

  return (
    <form
      onSubmit={(e) => { e.preventDefault(); onSave(form); }}
      className="space-y-4"
    >
      {error && (
        <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 text-red-700 dark:text-red-400 px-3 py-2 rounded text-sm">{error}</div>
      )}
      <div>
        <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Client Name</label>
        <input
          value={form.name}
          onChange={(e) => set('name', e.target.value)}
          className="w-full border border-gray-300 dark:border-gray-600 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
          required
          autoFocus
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Entity Type</label>
          <select
            value={form.entityType}
            onChange={(e) => set('entityType', e.target.value as ClientInput['entityType'])}
            className="w-full border border-gray-300 dark:border-gray-600 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
          >
            {ENTITY_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Activity Type</label>
          <select
            value={form.activityType ?? 'business'}
            onChange={(e) => set('activityType', e.target.value as ClientInput['activityType'])}
            className="w-full border border-gray-300 dark:border-gray-600 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
          >
            {ACTIVITY_TYPES.map((a) => <option key={a.value} value={a.value}>{a.label}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Tax Year End (MMDD)</label>
          <input
            value={form.taxYearEnd ?? ''}
            onChange={(e) => set('taxYearEnd', e.target.value)}
            placeholder="1231"
            className="w-full border border-gray-300 dark:border-gray-600 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white dark:placeholder-gray-400"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Tax Software</label>
          <select
            value={form.defaultTaxSoftware ?? 'ultratax'}
            onChange={(e) => set('defaultTaxSoftware', e.target.value as ClientInput['defaultTaxSoftware'])}
            className="w-full border border-gray-300 dark:border-gray-600 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
          >
            {TAX_SOFTWARE.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">EIN / Tax ID</label>
          <input
            value={form.taxId ?? ''}
            onChange={(e) => set('taxId', e.target.value || null)}
            placeholder="XX-XXXXXXX"
            className="w-full border border-gray-300 dark:border-gray-600 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white dark:placeholder-gray-400"
          />
        </div>
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <button type="button" onClick={onCancel} className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-700/50 dark:text-gray-300">Cancel</button>
        <button type="submit" disabled={saving} className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50">
          {saving ? 'Saving...' : 'Save'}
        </button>
      </div>
    </form>
  );
}

export function ClientsPage() {
  const qc = useQueryClient();
  const { selectedClientId, setSelectedClientId } = useUIStore();
  const [showAdd, setShowAdd] = useState(false);
  const [editClient, setEditClient] = useState<Client | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const { data, isLoading, error } = useQuery({
    queryKey: ['clients'],
    queryFn: async () => {
      const res = await listClients();
      if (res.error) throw new Error(res.error.message);
      return res.data;
    },
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ['clients'] });

  const createMutation = useMutation({
    mutationFn: createClient,
    onSuccess: (res) => {
      if (res.error) { setFormError(res.error.message); return; }
      invalidate(); setShowAdd(false); setFormError(null);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, input }: { id: number; input: Partial<ClientInput> }) => updateClient(id, input),
    onSuccess: (res) => {
      if (res.error) { setFormError(res.error.message); return; }
      invalidate(); setEditClient(null); setFormError(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteClient,
    onSuccess: (_, id) => {
      if (selectedClientId === id) setSelectedClientId(null);
      invalidate();
    },
  });

  const allClients = data ?? [];

  const filteredClients = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return allClients;
    return allClients.filter((c) =>
      c.name.toLowerCase().includes(q) ||
      (c.tax_id ?? '').toLowerCase().includes(q) ||
      c.entity_type.toLowerCase().includes(q),
    );
  }, [allClients, search]);

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Clients</h2>
          <p className="text-sm text-gray-500 dark:text-gray-500 mt-0.5">
            {filteredClients.length !== allClients.length
              ? `${filteredClients.length} of ${allClients.length} client${allClients.length !== 1 ? 's' : ''}`
              : `${allClients.length} client${allClients.length !== 1 ? 's' : ''}`}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search clients…"
            className="border border-gray-300 dark:border-gray-600 rounded px-3 py-1.5 text-sm w-56 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white dark:placeholder-gray-400"
          />
          <button
            onClick={() => { setShowAdd(true); setFormError(null); }}
            className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
          >
            + Add Client
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 text-red-700 dark:text-red-400 px-4 py-3 rounded text-sm mb-4">{error.message}</div>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center py-12 text-gray-400 dark:text-gray-500">Loading...</div>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/60">
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">Name</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">Entity</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">Activity</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">EIN</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">Tax Year End</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">Software</th>
                <th className="px-4 py-2.5"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {filteredClients.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-gray-400 dark:text-gray-500">
                    {search ? `No clients match "${search}".` : 'No clients yet. Click "+ Add Client" to create one.'}
                  </td>
                </tr>
              ) : (
                filteredClients.map((c) => {
                  const isSelected = c.id === selectedClientId;
                  return (
                    <tr
                      key={c.id}
                      className={isSelected ? 'bg-blue-50 dark:bg-blue-900/20' : 'hover:bg-gray-50 dark:hover:bg-gray-700/50'}
                    >
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-2">
                          {isSelected && (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-400">
                              Active
                            </span>
                          )}
                          <span className="font-medium text-gray-900 dark:text-white">{c.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-2.5 text-gray-600 dark:text-gray-400">{c.entity_type}</td>
                      <td className="px-4 py-2.5 text-gray-600 dark:text-gray-400 capitalize">{(c.activity_type ?? 'business').replace('_', ' ')}</td>
                      <td className="px-4 py-2.5 text-gray-500 dark:text-gray-500 font-mono text-sm">{c.tax_id ?? '—'}</td>
                      <td className="px-4 py-2.5 text-gray-600 dark:text-gray-400">{c.tax_year_end}</td>
                      <td className="px-4 py-2.5 text-gray-600 dark:text-gray-400 capitalize">{c.default_tax_software}</td>
                      <td className="px-4 py-2.5 text-right whitespace-nowrap">
                        {isSelected ? (
                          <button
                            onClick={() => setSelectedClientId(null)}
                            className="text-xs text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 mr-3"
                          >
                            Deselect
                          </button>
                        ) : (
                          <button
                            onClick={() => setSelectedClientId(c.id)}
                            className="text-xs text-green-600 hover:text-green-800 dark:text-green-400 dark:hover:text-green-300 font-medium mr-3"
                          >
                            Select
                          </button>
                        )}
                        <button
                          onClick={() => { setEditClient(c); setFormError(null); }}
                          className="text-xs text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 mr-3"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => { if (confirm(`Delete "${c.name}"?`)) deleteMutation.mutate(c.id); }}
                          className="text-xs text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}

      {showAdd && (
        <Modal title="Add Client" onClose={() => setShowAdd(false)}>
          <ClientForm
            onSave={(input) => createMutation.mutate(input)}
            onCancel={() => setShowAdd(false)}
            saving={createMutation.isPending}
            error={formError}
          />
        </Modal>
      )}

      {editClient && (
        <Modal title="Edit Client" onClose={() => setEditClient(null)}>
          <ClientForm
            initial={{
              name: editClient.name,
              entityType: editClient.entity_type,
              taxYearEnd: editClient.tax_year_end,
              defaultTaxSoftware: editClient.default_tax_software,
              taxId: editClient.tax_id,
              activityType: editClient.activity_type ?? 'business',
            }}
            onSave={(input) => updateMutation.mutate({ id: editClient.id, input })}
            onCancel={() => setEditClient(null)}
            saving={updateMutation.isPending}
            error={formError}
          />
        </Modal>
      )}
    </div>
  );
}
