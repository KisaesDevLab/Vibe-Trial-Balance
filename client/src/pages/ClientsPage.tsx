import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  listClients,
  createClient,
  updateClient,
  deleteClient,
  type Client,
  type ClientInput,
} from '../api/clients';

const ENTITY_TYPES = ['1065', '1120', '1120S', '1040_C'] as const;
const TAX_SOFTWARE = ['ultratax', 'cch', 'lacerte', 'drake'] as const;

function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-lg">
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <h2 className="text-base font-semibold">{title}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
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
  });

  const set = <K extends keyof ClientInput>(k: K, v: ClientInput[K]) =>
    setForm((p) => ({ ...p, [k]: v }));

  return (
    <form
      onSubmit={(e) => { e.preventDefault(); onSave(form); }}
      className="space-y-4"
    >
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded text-sm">{error}</div>
      )}
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">Client Name</label>
        <input
          value={form.name}
          onChange={(e) => set('name', e.target.value)}
          className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          required
          autoFocus
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Entity Type</label>
          <select
            value={form.entityType}
            onChange={(e) => set('entityType', e.target.value as ClientInput['entityType'])}
            className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {ENTITY_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Tax Year End (MMDD)</label>
          <input
            value={form.taxYearEnd ?? ''}
            onChange={(e) => set('taxYearEnd', e.target.value)}
            placeholder="1231"
            className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Tax Software</label>
          <select
            value={form.defaultTaxSoftware ?? 'ultratax'}
            onChange={(e) => set('defaultTaxSoftware', e.target.value as ClientInput['defaultTaxSoftware'])}
            className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {TAX_SOFTWARE.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">EIN / Tax ID</label>
          <input
            value={form.taxId ?? ''}
            onChange={(e) => set('taxId', e.target.value || null)}
            placeholder="XX-XXXXXXX"
            className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <button type="button" onClick={onCancel} className="px-3 py-1.5 text-sm border border-gray-300 rounded hover:bg-gray-50">Cancel</button>
        <button type="submit" disabled={saving} className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50">
          {saving ? 'Saving...' : 'Save'}
        </button>
      </div>
    </form>
  );
}

export function ClientsPage() {
  const qc = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);
  const [editClient, setEditClient] = useState<Client | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

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
    onSuccess: () => invalidate(),
  });

  const clients = data ?? [];

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Clients</h2>
          <p className="text-sm text-gray-500 mt-0.5">{clients.length} client{clients.length !== 1 ? 's' : ''}</p>
        </div>
        <button
          onClick={() => { setShowAdd(true); setFormError(null); }}
          className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
        >
          + Add Client
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
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Name</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Entity</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">EIN</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Tax Year End</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Software</th>
                <th className="px-4 py-2.5"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {clients.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-gray-400">
                    No clients yet. Click &ldquo;+ Add Client&rdquo; to create one.
                  </td>
                </tr>
              ) : (
                clients.map((c) => (
                  <tr key={c.id} className="hover:bg-gray-50">
                    <td className="px-4 py-2.5 font-medium text-gray-900">{c.name}</td>
                    <td className="px-4 py-2.5 text-gray-600">{c.entity_type}</td>
                    <td className="px-4 py-2.5 text-gray-500 font-mono text-xs">{c.tax_id ?? '—'}</td>
                    <td className="px-4 py-2.5 text-gray-600">{c.tax_year_end}</td>
                    <td className="px-4 py-2.5 text-gray-600 capitalize">{c.default_tax_software}</td>
                    <td className="px-4 py-2.5 text-right">
                      <button
                        onClick={() => { setEditClient(c); setFormError(null); }}
                        className="text-xs text-blue-600 hover:text-blue-800 mr-3"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => { if (confirm(`Delete "${c.name}"?`)) deleteMutation.mutate(c.id); }}
                        className="text-xs text-red-500 hover:text-red-700"
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
