import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore, useUIStore } from '../store/uiStore';
import {
  listCoaTemplates,
  getCoaTemplate,
  createCoaTemplate,
  updateCoaTemplate,
  deleteCoaTemplate,
  createTemplateFromClient,
  applyTemplate,
  exportTemplateUrl,
  importTemplatePreview,
  importTemplate,
  type CоaTemplate,
  type CoaTemplateInput,
  type ImportPreviewRow,
} from '../api/coaTemplates';

// ── Constants ─────────────────────────────────────────────────────────────────

// Cycle through a palette of colours for the 32 system types + custom fallback.
const COLOR_PALETTE = [
  'bg-blue-50 dark:bg-blue-900/40 text-blue-700 dark:text-blue-400',
  'bg-purple-50 dark:bg-purple-900/40 text-purple-700 dark:text-purple-400',
  'bg-orange-50 dark:bg-orange-900/40 text-orange-700 dark:text-orange-400',
  'bg-indigo-50 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-400',
  'bg-emerald-50 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400',
  'bg-amber-50 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400',
  'bg-lime-50 dark:bg-lime-900/40 text-lime-700 dark:text-lime-400',
  'bg-teal-50 dark:bg-teal-900/40 text-teal-700 dark:text-teal-400',
  'bg-rose-50 dark:bg-rose-900/40 text-rose-700 dark:text-rose-400',
  'bg-sky-50 dark:bg-sky-900/40 text-sky-700 dark:text-sky-400',
  'bg-fuchsia-50 dark:bg-fuchsia-900/40 text-fuchsia-700 dark:text-fuchsia-400',
  'bg-cyan-50 dark:bg-cyan-900/40 text-cyan-700 dark:text-cyan-400',
];

function businessTypeColor(slug: string): string {
  if (slug === 'custom') return 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300';
  // Hash the slug to pick a stable colour from the palette
  let h = 0;
  for (let i = 0; i < slug.length; i++) h = (h * 31 + slug.charCodeAt(i)) >>> 0;
  return COLOR_PALETTE[h % COLOR_PALETTE.length];
}

function businessTypeLabel(template: { business_type: string; name: string }): string {
  return template.name;
}

const CATEGORY_ORDER = ['assets', 'liabilities', 'equity', 'revenue', 'expenses'];

// ── Helpers ───────────────────────────────────────────────────────────────────

function Badge({ label, colorClass }: { label: string; colorClass: string }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${colorClass}`}>
      {label}
    </span>
  );
}

function Modal({
  title,
  onClose,
  children,
  wide,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className={`bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full ${wide ? 'max-w-4xl' : 'max-w-lg'} max-h-[90vh] flex flex-col`}>
        <div className="flex items-center justify-between px-5 py-4 border-b dark:border-gray-700 shrink-0">
          <h2 className="text-base font-semibold text-gray-900 dark:text-white">{title}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 text-xl leading-none">
            &times;
          </button>
        </div>
        <div className="px-5 py-4 overflow-y-auto flex-1">{children}</div>
      </div>
    </div>
  );
}

// ── View Accounts Modal ───────────────────────────────────────────────────────

function ViewAccountsModal({
  template,
  onClose,
}: {
  template: CоaTemplate;
  onClose: () => void;
}) {
  const { data, isLoading } = useQuery({
    queryKey: ['coa-template', template.id],
    queryFn: async () => {
      const res = await getCoaTemplate(template.id);
      if (res.error) throw new Error(res.error.message);
      return res.data;
    },
  });

  const grouped = data?.accounts
    ? CATEGORY_ORDER.reduce<Record<string, typeof data.accounts>>((acc, cat) => {
        const rows = data.accounts.filter((a) => a.category === cat);
        if (rows.length > 0) acc[cat] = rows;
        return acc;
      }, {})
    : {};

  return (
    <Modal title={`${template.name} — Accounts`} onClose={onClose} wide>
      {isLoading ? (
        <p className="text-sm text-gray-400 dark:text-gray-500 text-center py-8">Loading…</p>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {data?.account_count ?? 0} accounts &mdash;{' '}
              <Badge
                label={businessTypeLabel(template)}
                colorClass={businessTypeColor(template.business_type)}
              />
            </p>
            <a
              href={exportTemplateUrl(template.id)}
              target="_blank"
              rel="noreferrer"
              className="text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
            >
              Export Excel
            </a>
          </div>

          {Object.entries(grouped).map(([cat, accounts]) => (
            <div key={cat}>
              <p className="text-xs font-bold uppercase tracking-wide text-gray-400 dark:text-gray-500 mb-1 capitalize">{cat}</p>
              <div className="border border-gray-200 dark:border-gray-700 rounded overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 dark:bg-gray-800/60">
                    <tr>
                      <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 w-24">Number</th>
                      <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 dark:text-gray-400">Name</th>
                      <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 w-20">Balance</th>
                      <th className="px-3 py-2 text-right text-xs font-semibold text-gray-600 dark:text-gray-400 w-16">Sort</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                    {accounts.map((a) => (
                      <tr key={a.id}>
                        <td className="px-3 py-1.5 font-mono text-sm text-gray-700 dark:text-gray-300">{a.account_number}</td>
                        <td className="px-3 py-1.5 text-gray-800 dark:text-gray-200">{a.account_name}</td>
                        <td className="px-3 py-1.5 text-gray-500 dark:text-gray-400 capitalize">{a.normal_balance}</td>
                        <td className="px-3 py-1.5 text-right text-gray-400 dark:text-gray-500">{a.sort_order}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
}

// ── Apply Template Modal ──────────────────────────────────────────────────────

function ApplyModal({
  template,
  defaultClientId,
  onClose,
  onSuccess,
}: {
  template: CоaTemplate;
  defaultClientId: number | null;
  onClose: () => void;
  onSuccess: (added: number, skipped: number) => void;
}) {
  const [clientId, setClientId] = useState<string>(defaultClientId ? String(defaultClientId) : '');
  const [mode, setMode] = useState<'merge' | 'replace'>('merge');
  const [error, setError] = useState<string | null>(null);

  const { data: clientsData } = useQuery({
    queryKey: ['clients-list-for-apply'],
    queryFn: async () => {
      const res = await fetch('/api/v1/clients', {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      const json = await res.json() as { data: { id: number; name: string }[]; error: null };
      return json.data ?? [];
    },
  });

  const applyMutation = useMutation({
    mutationFn: () => applyTemplate(template.id, Number(clientId), mode),
    onSuccess: (res) => {
      if (res.error) { setError(res.error.message); return; }
      onSuccess(res.data?.added ?? 0, res.data?.skipped ?? 0);
    },
  });

  const clients = clientsData ?? [];

  return (
    <Modal title={`Apply Template: ${template.name}`} onClose={onClose}>
      <div className="space-y-4">
        <div className="bg-gray-50 dark:bg-gray-800/60 rounded-lg p-3 text-sm">
          <p className="font-medium text-gray-800 dark:text-gray-200">{template.name}</p>
          <p className="text-gray-500 dark:text-gray-400 mt-0.5">{template.account_count} accounts &mdash;{' '}
            <Badge
              label={businessTypeLabel(template)}
              colorClass={businessTypeColor(template.business_type)}
            />
          </p>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Client</label>
          <select
            value={clientId}
            onChange={(e) => setClientId(e.target.value)}
            className="w-full border border-gray-300 dark:border-gray-600 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
          >
            <option value="">Select client…</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Mode</label>
          <div className="space-y-2">
            <label className="flex items-start gap-2 cursor-pointer">
              <input
                type="radio"
                name="mode"
                value="merge"
                checked={mode === 'merge'}
                onChange={() => setMode('merge')}
                className="mt-0.5"
              />
              <div>
                <span className="text-sm font-medium text-gray-800 dark:text-gray-200">Merge — add missing accounts</span>
                <p className="text-xs text-gray-500 dark:text-gray-400">Accounts already in the client COA (by account number) will be skipped.</p>
              </div>
            </label>
            <label className="flex items-start gap-2 cursor-pointer">
              <input
                type="radio"
                name="mode"
                value="replace"
                checked={mode === 'replace'}
                onChange={() => setMode('replace')}
                className="mt-0.5"
              />
              <div>
                <span className="text-sm font-medium text-gray-800 dark:text-gray-200">Replace — clear and replace COA</span>
                <p className="text-xs text-gray-500 dark:text-gray-400">This will delete all existing accounts with no trial balance data.</p>
              </div>
            </label>
          </div>
        </div>

        {mode === 'replace' && (
          <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded px-3 py-2 text-sm text-amber-800 dark:text-amber-400">
            Warning: This will permanently delete all accounts with no trial balance data from the selected client.
          </div>
        )}

        {error && (
          <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 rounded px-3 py-2 text-sm text-red-700 dark:text-red-400">{error}</div>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-700/50 dark:text-gray-300"
          >
            Cancel
          </button>
          <button
            onClick={() => applyMutation.mutate()}
            disabled={!clientId || applyMutation.isPending}
            className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
          >
            {applyMutation.isPending ? 'Applying…' : 'Apply Template'}
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ── Create/Edit Template Modal ────────────────────────────────────────────────

function TemplateFormModal({
  initial,
  onClose,
  onSave,
  saving,
  error,
}: {
  initial?: CоaTemplate;
  onClose: () => void;
  onSave: (data: CoaTemplateInput) => void;
  saving: boolean;
  error?: string | null;
}) {
  const [form, setForm] = useState<CoaTemplateInput>({
    name: initial?.name ?? '',
    description: initial?.description ?? '',
    businessType: initial?.business_type ?? 'custom',
    isActive: initial?.is_active ?? true,
  });

  const set = <K extends keyof CoaTemplateInput>(k: K, v: CoaTemplateInput[K]) =>
    setForm((prev) => ({ ...prev, [k]: v }));

  return (
    <Modal title={initial ? 'Edit Template' : 'Create Template'} onClose={onClose}>
      <form
        onSubmit={(e) => { e.preventDefault(); onSave(form); }}
        className="space-y-3"
      >
        {error && (
          <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 rounded px-3 py-2 text-sm text-red-700 dark:text-red-400">{error}</div>
        )}
        <div>
          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Name</label>
          <input
            value={form.name}
            onChange={(e) => set('name', e.target.value)}
            className="w-full border border-gray-300 dark:border-gray-600 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
            required
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Description</label>
          <textarea
            value={form.description ?? ''}
            onChange={(e) => set('description', e.target.value)}
            rows={3}
            className="w-full border border-gray-300 dark:border-gray-600 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none dark:bg-gray-700 dark:text-white"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Business Type</label>
          <input
            type="text"
            value={form.businessType ?? ''}
            onChange={(e) => set('businessType', e.target.value)}
            placeholder="e.g. retail, restaurant, farm"
            className="w-full border border-gray-300 dark:border-gray-600 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
          />
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => set('isActive', !form.isActive)}
            className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${form.isActive ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-600'}`}
          >
            <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${form.isActive ? 'translate-x-4' : 'translate-x-1'}`} />
          </button>
          <span className="text-sm text-gray-700 dark:text-gray-300">{form.isActive ? 'Active' : 'Inactive'}</span>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-700/50 dark:text-gray-300">
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

// ── Create-From-Client Modal ──────────────────────────────────────────────────

function CreateFromClientModal({
  defaultClientId,
  onClose,
  onSuccess,
}: {
  defaultClientId: number | null;
  onClose: () => void;
  onSuccess: (template: CоaTemplate) => void;
}) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [businessType, setBusinessType] = useState('custom');
  const [clientId, setClientId] = useState<string>(defaultClientId ? String(defaultClientId) : '');
  const [error, setError] = useState<string | null>(null);

  const { data: clientsData } = useQuery({
    queryKey: ['clients-list-for-create'],
    queryFn: async () => {
      const res = await fetch('/api/v1/clients', {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      const json = await res.json() as { data: { id: number; name: string }[]; error: null };
      return json.data ?? [];
    },
  });

  const createMutation = useMutation({
    mutationFn: () =>
      createTemplateFromClient(Number(clientId), { name, description: description || undefined, businessType }),
    onSuccess: (res) => {
      if (res.error) { setError(res.error.message); return; }
      if (res.data) onSuccess(res.data);
    },
  });

  const clients = clientsData ?? [];

  return (
    <Modal title="Create Template from Client COA" onClose={onClose}>
      <form
        onSubmit={(e) => { e.preventDefault(); createMutation.mutate(); }}
        className="space-y-3"
      >
        {error && (
          <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 rounded px-3 py-2 text-sm text-red-700 dark:text-red-400">{error}</div>
        )}

        <div>
          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Source Client</label>
          <select
            value={clientId}
            onChange={(e) => setClientId(e.target.value)}
            className="w-full border border-gray-300 dark:border-gray-600 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
            required
          >
            <option value="">Select client…</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Template Name</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full border border-gray-300 dark:border-gray-600 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
            required
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            className="w-full border border-gray-300 dark:border-gray-600 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none dark:bg-gray-700 dark:text-white"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Business Type</label>
          <input
            type="text"
            value={businessType}
            onChange={(e) => setBusinessType(e.target.value)}
            placeholder="e.g. retail, restaurant, farm"
            className="w-full border border-gray-300 dark:border-gray-600 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
          />
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-700/50 dark:text-gray-300">
            Cancel
          </button>
          <button
            type="submit"
            disabled={!clientId || !name || createMutation.isPending}
            className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
          >
            {createMutation.isPending ? 'Creating…' : 'Create Template'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

// ── Import Modal ──────────────────────────────────────────────────────────────

function ImportModal({
  onClose,
  onSuccess,
}: {
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [csvText, setCsvText] = useState('');
  const [fileName, setFileName] = useState('');
  const [preview, setPreview] = useState<ImportPreviewRow[] | null>(null);
  const [templateName, setTemplateName] = useState('');
  const [businessType, setBusinessType] = useState('custom');
  const fileRef = useRef<HTMLInputElement>(null);

  const previewMutation = useMutation({
    mutationFn: (csv: string) => importTemplatePreview(csv),
    onSuccess: (res) => { if (res.data) setPreview(res.data); },
  });

  const importMutation = useMutation({
    mutationFn: () => importTemplate(csvText, { templateName, businessType }),
    onSuccess: (res) => { if (!res.error) onSuccess(); },
  });

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = (ev.target?.result as string) ?? '';
      setCsvText(text);
      previewMutation.mutate(text);
    };
    reader.readAsText(file);
  };

  const newCount = preview?.filter((r) => r.status === 'new').length ?? 0;
  const errorCount = preview?.filter((r) => r.status === 'error').length ?? 0;

  const result = importMutation.data;

  return (
    <Modal title="Import Template from CSV" onClose={onClose} wide>
      <div className="space-y-4">
        {result?.data ? (
          <>
            <div className="bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-700 rounded px-4 py-3 text-sm text-green-800 dark:text-green-400">
              Import complete: <strong>{result.data.imported}</strong> accounts imported into template.
            </div>
            <div className="flex justify-end">
              <button onClick={onClose} className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700">
                Done
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Required columns:{' '}
              <code className="bg-gray-100 dark:bg-gray-700 px-1 rounded text-xs">account_number, account_name, category</code>.
              Optional:{' '}
              <code className="bg-gray-100 dark:bg-gray-700 px-1 rounded text-xs">normal_balance, subcategory, tax_line, unit, workpaper_ref, sort_order</code>.
            </p>
            <div className="bg-gray-50 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700 rounded p-3 text-xs">
              <p className="font-semibold text-gray-600 dark:text-gray-400 mb-1.5">Valid values</p>
              <div className="grid grid-cols-2 gap-x-6 gap-y-0.5">
                <div>
                  <span className="font-medium text-gray-700 dark:text-gray-300">category</span>
                  <ul className="mt-0.5 space-y-0.5 text-gray-500 dark:text-gray-400">
                    {[
                      ['assets', 'debit'],
                      ['liabilities', 'credit'],
                      ['equity', 'credit'],
                      ['revenue', 'credit'],
                      ['expenses', 'debit'],
                    ].map(([cat, bal]) => (
                      <li key={cat}>
                        <code className="text-gray-800">{cat}</code>
                        <span className="text-gray-400 ml-1">→ defaults to <code>{bal}</code></span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <span className="font-medium text-gray-700 dark:text-gray-300">normal_balance</span>
                  <ul className="mt-0.5 space-y-0.5 text-gray-500 dark:text-gray-400">
                    <li><code className="text-gray-800 dark:text-gray-200">debit</code></li>
                    <li><code className="text-gray-800 dark:text-gray-200">credit</code></li>
                    <li className="text-gray-400 dark:text-gray-500 italic">omit to use category default</li>
                  </ul>
                </div>
              </div>
            </div>

            <div
              className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-6 text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50/30 dark:hover:bg-blue-900/10 transition-colors"
              onClick={() => fileRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); }}
              onDrop={(e) => {
                e.preventDefault();
                const file = e.dataTransfer.files[0];
                if (file && fileRef.current) {
                  const dt = new DataTransfer();
                  dt.items.add(file);
                  fileRef.current.files = dt.files;
                  fileRef.current.dispatchEvent(new Event('change', { bubbles: true }));
                }
              }}
            >
              <input ref={fileRef} type="file" accept=".csv,.txt" onChange={handleFile} className="hidden" />
              {fileName ? (
                <p className="text-sm text-gray-700 dark:text-gray-300 font-medium">{fileName}</p>
              ) : (
                <p className="text-sm text-gray-400 dark:text-gray-500">Click or drag a CSV file here</p>
              )}
            </div>

            {previewMutation.isPending && (
              <p className="text-sm text-gray-500 text-center">Analyzing file…</p>
            )}

            {preview && (
              <>
                <div className="flex items-center gap-4 text-sm">
                  <span className="text-green-700 font-medium">{newCount} valid rows</span>
                  {errorCount > 0 && <span className="text-red-600 font-medium">{errorCount} errors</span>}
                </div>

                <div className="border border-gray-200 dark:border-gray-700 rounded overflow-auto max-h-48">
                  <table className="w-full text-xs">
                    <thead className="bg-gray-50 dark:bg-gray-800/60 sticky top-0">
                      <tr>
                        <th className="px-2 py-1.5 text-left font-semibold text-gray-500 dark:text-gray-400 w-20">Status</th>
                        <th className="px-2 py-1.5 text-left font-semibold text-gray-500 dark:text-gray-400">Number</th>
                        <th className="px-2 py-1.5 text-left font-semibold text-gray-500 dark:text-gray-400">Name</th>
                        <th className="px-2 py-1.5 text-left font-semibold text-gray-500 dark:text-gray-400">Category</th>
                        <th className="px-2 py-1.5 text-left font-semibold text-gray-500 dark:text-gray-400">Error</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                      {preview.slice(0, 100).map((row, i) => (
                        <tr key={i} className={row.status === 'error' ? 'bg-red-50 dark:bg-red-900/20' : ''}>
                          <td className="px-2 py-1 font-medium text-gray-600 dark:text-gray-400 capitalize">{row.status}</td>
                          <td className="px-2 py-1 font-mono text-sm">{row.account_number}</td>
                          <td className="px-2 py-1 max-w-40 truncate">{row.account_name}</td>
                          <td className="px-2 py-1">{row.category}</td>
                          <td className="px-2 py-1 text-red-600">{row.error ?? ''}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Template Name</label>
                    <input
                      value={templateName}
                      onChange={(e) => setTemplateName(e.target.value)}
                      placeholder="New template name…"
                      className="w-full border border-gray-300 dark:border-gray-600 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white dark:placeholder-gray-400"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Business Type</label>
                    <input
                      type="text"
                      value={businessType}
                      onChange={(e) => setBusinessType(e.target.value)}
                      placeholder="e.g. retail, restaurant, farm"
                      className="w-full border border-gray-300 dark:border-gray-600 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white dark:placeholder-gray-400"
                    />
                  </div>
                </div>
              </>
            )}

            {importMutation.data?.error && (
              <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 text-red-700 dark:text-red-400 px-3 py-2 rounded text-sm">
                {importMutation.data.error.message}
              </div>
            )}

            <div className="flex justify-end gap-2">
              <button onClick={onClose} className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-700/50 dark:text-gray-300">
                Cancel
              </button>
              <button
                onClick={() => importMutation.mutate()}
                disabled={!preview || newCount === 0 || !templateName || importMutation.isPending}
                className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-40"
              >
                {importMutation.isPending ? 'Importing…' : `Import ${newCount} Account${newCount !== 1 ? 's' : ''}`}
              </button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}

// ── Token helper ──────────────────────────────────────────────────────────────

function getToken(): string {
  const stored = localStorage.getItem('auth');
  try {
    const parsed = JSON.parse(stored ?? '{}') as { state?: { token?: string } };
    return parsed.state?.token ?? '';
  } catch {
    return '';
  }
}

// ── Template Card ─────────────────────────────────────────────────────────────

function TemplateCard({
  template,
  isAdmin,
  onApply,
  onViewAccounts,
  onEdit,
  onDelete,
}: {
  template: CоaTemplate;
  isAdmin: boolean;
  onApply: (t: CоaTemplate) => void;
  onViewAccounts: (t: CоaTemplate) => void;
  onEdit?: (t: CоaTemplate) => void;
  onDelete?: (t: CоaTemplate) => void;
}) {
  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 flex flex-col gap-3 hover:shadow-sm transition-shadow">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-gray-900 dark:text-white truncate">{template.name}</p>
          {template.description && (
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-2">{template.description}</p>
          )}
        </div>
        {template.is_system && (
          <span className="shrink-0 text-xs text-amber-600 bg-amber-50 dark:bg-amber-900/40 dark:text-amber-400 px-1.5 py-0.5 rounded">System</span>
        )}
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <Badge
          label={businessTypeLabel(template)}
          colorClass={businessTypeColor(template.business_type)}
        />
        <span className="text-xs text-gray-400 dark:text-gray-500">{template.account_count} accounts</span>
        {!template.is_active && (
          <span className="text-xs text-red-500 bg-red-50 dark:bg-red-900/30 dark:text-red-400 px-1.5 py-0.5 rounded">Inactive</span>
        )}
      </div>

      <div className="flex items-center gap-2 mt-auto">
        <button
          onClick={() => onViewAccounts(template)}
          className="flex-1 px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-700/50 text-gray-700 dark:text-gray-300"
        >
          View Accounts
        </button>
        <button
          onClick={() => onApply(template)}
          className="flex-1 px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          Apply to Client
        </button>
      </div>

      {isAdmin && !template.is_system && onEdit && onDelete && (
        <div className="flex items-center gap-2 border-t border-gray-100 dark:border-gray-700 pt-2">
          <button
            onClick={() => onEdit(template)}
            className="text-xs text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
          >
            Edit
          </button>
          <button
            onClick={() => onDelete(template)}
            className="text-xs text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
          >
            Delete
          </button>
        </div>
      )}
    </div>
  );
}

// ── Success Banner ────────────────────────────────────────────────────────────

function SuccessBanner({ message, onClose }: { message: string; onClose: () => void }) {
  return (
    <div className="bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-700 rounded px-4 py-3 flex items-center justify-between text-sm text-green-800 dark:text-green-400 mb-4">
      <span>{message}</span>
      <button onClick={onClose} className="text-green-600 dark:text-green-400 hover:text-green-800 text-base leading-none">&times;</button>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

type ModalState =
  | { type: 'apply'; template: CоaTemplate }
  | { type: 'view'; template: CоaTemplate }
  | { type: 'edit'; template: CоaTemplate }
  | { type: 'create' }
  | { type: 'create-from-client' }
  | { type: 'import' }
  | null;

export function CoaTemplatesPage() {
  const { user } = useAuthStore();
  const { selectedClientId } = useUIStore();
  const qc = useQueryClient();

  const [tab, setTab] = useState<'system' | 'custom'>('system');
  const [modal, setModal] = useState<ModalState>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const isAdmin = user?.role === 'admin';

  const { data: templatesData, isLoading } = useQuery({
    queryKey: ['coa-templates'],
    queryFn: async () => {
      const res = await listCoaTemplates();
      if (res.error) throw new Error(res.error.message);
      return res.data ?? [];
    },
  });

  const templates = templatesData ?? [];
  const systemTemplates = templates.filter((t) => t.is_system);
  const customTemplates = templates.filter((t) => !t.is_system);

  const createMutation = useMutation({
    mutationFn: (data: CoaTemplateInput) => createCoaTemplate(data),
    onSuccess: (res) => {
      if (res.error) { setFormError(res.error.message); return; }
      qc.invalidateQueries({ queryKey: ['coa-templates'] });
      setModal(null);
      setSuccessMessage('Template created successfully.');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<CoaTemplateInput> }) =>
      updateCoaTemplate(id, data),
    onSuccess: (res) => {
      if (res.error) { setFormError(res.error.message); return; }
      qc.invalidateQueries({ queryKey: ['coa-templates'] });
      setModal(null);
      setSuccessMessage('Template updated.');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteCoaTemplate(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['coa-templates'] });
      setSuccessMessage('Template deleted.');
    },
  });

  const handleDelete = (template: CоaTemplate) => {
    if (!confirm(`Delete template "${template.name}"? This cannot be undone.`)) return;
    deleteMutation.mutate(template.id);
  };

  const displayedTemplates = tab === 'system' ? systemTemplates : customTemplates;

  if (user?.role !== 'admin') {
    return (
      <div className="flex items-center justify-center h-full text-gray-400 dark:text-gray-500">
        <div className="text-center">
          <p className="text-lg font-medium text-gray-700 dark:text-gray-300">Admin access required</p>
          <p className="text-sm mt-1">You must be an administrator to manage COA templates.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">COA Templates</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            Preset and custom chart of account templates for quick client setup
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => { setModal({ type: 'import' }); }}
            className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-700/50 text-gray-700 dark:text-gray-300"
          >
            Import CSV
          </button>
          <button
            onClick={() => { setModal({ type: 'create-from-client' }); }}
            className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-700/50 text-gray-700 dark:text-gray-300"
          >
            From Client COA
          </button>
          <button
            onClick={() => { setFormError(null); setModal({ type: 'create' }); }}
            className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            + Create Blank
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        {[
          { label: 'Total Templates', value: templates.length },
          { label: 'System Templates', value: systemTemplates.length },
          { label: 'Custom Templates', value: customTemplates.length },
        ].map((s) => (
          <div key={s.label} className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 px-4 py-3">
            <p className="text-xs text-gray-500 dark:text-gray-400">{s.label}</p>
            <p className="text-2xl font-semibold text-gray-900 dark:text-white">{s.value}</p>
          </div>
        ))}
      </div>

      {/* Success banner */}
      {successMessage && (
        <SuccessBanner message={successMessage} onClose={() => setSuccessMessage(null)} />
      )}

      {/* Tabs */}
      <div className="flex border-b border-gray-200 dark:border-gray-700 mb-4">
        {(['system', 'custom'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              tab === t
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            {t === 'system' ? `System Templates (${systemTemplates.length})` : `Custom Templates (${customTemplates.length})`}
          </button>
        ))}
      </div>

      {/* Template grid */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16 text-gray-400 dark:text-gray-500">Loading…</div>
      ) : displayedTemplates.length === 0 ? (
        <div className="text-center py-16 text-gray-400 dark:text-gray-600">
          {tab === 'custom' ? (
            <>
              <p className="text-base font-medium text-gray-600 dark:text-gray-400">No custom templates yet</p>
              <p className="text-sm mt-1">Create a blank template or import from a client COA.</p>
            </>
          ) : (
            <p className="text-sm">No system templates found. Run the seed file to populate them.</p>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {displayedTemplates.map((template) => (
            <TemplateCard
              key={template.id}
              template={template}
              isAdmin={isAdmin}
              onApply={(t) => setModal({ type: 'apply', template: t })}
              onViewAccounts={(t) => setModal({ type: 'view', template: t })}
              onEdit={(t) => { setFormError(null); setModal({ type: 'edit', template: t }); }}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}

      {/* Modals */}

      {modal?.type === 'view' && (
        <ViewAccountsModal
          template={modal.template}
          onClose={() => setModal(null)}
        />
      )}

      {modal?.type === 'apply' && (
        <ApplyModal
          template={modal.template}
          defaultClientId={selectedClientId}
          onClose={() => setModal(null)}
          onSuccess={(added, skipped) => {
            setModal(null);
            setSuccessMessage(`Template applied: ${added} accounts added, ${skipped} skipped.`);
            qc.invalidateQueries({ queryKey: ['chart-of-accounts'] });
          }}
        />
      )}

      {modal?.type === 'create' && (
        <TemplateFormModal
          onClose={() => setModal(null)}
          onSave={(data) => createMutation.mutate(data)}
          saving={createMutation.isPending}
          error={formError}
        />
      )}

      {modal?.type === 'edit' && (
        <TemplateFormModal
          initial={modal.template}
          onClose={() => setModal(null)}
          onSave={(data) => updateMutation.mutate({ id: modal.template.id, data })}
          saving={updateMutation.isPending}
          error={formError}
        />
      )}

      {modal?.type === 'create-from-client' && (
        <CreateFromClientModal
          defaultClientId={selectedClientId}
          onClose={() => setModal(null)}
          onSuccess={(template) => {
            setModal(null);
            qc.invalidateQueries({ queryKey: ['coa-templates'] });
            setSuccessMessage(`Template "${template.name}" created from client COA with ${template.account_count} accounts.`);
            setTab('custom');
          }}
        />
      )}

      {modal?.type === 'import' && (
        <ImportModal
          onClose={() => setModal(null)}
          onSuccess={() => {
            setModal(null);
            qc.invalidateQueries({ queryKey: ['coa-templates'] });
            setSuccessMessage('Template imported successfully.');
            setTab('custom');
          }}
        />
      )}
    </div>
  );
}
