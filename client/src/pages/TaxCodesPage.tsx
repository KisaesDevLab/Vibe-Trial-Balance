import { useState, useRef, useCallback, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../store/uiStore';
import {
  listTaxCodes,
  createTaxCode,
  updateTaxCode,
  deleteTaxCode,
  getTaxCode,
  importTaxCodePreview,
  importTaxCodes,
  exportTaxCodesUrl,
  createSoftwareMap,
  updateSoftwareMap,
  deleteSoftwareMap,
  type TaxCode,
  type TaxCodeInput,
  type SoftwareMap,
  type SoftwareMapInput,
  type ImportPreviewRow,
  type ListTaxCodesParams,
} from '../api/taxCodes';

// ---- Constants ----

const RETURN_FORMS = ['1040', '1065', '1120', '1120S', 'common'] as const;
const ACTIVITY_TYPES = ['business', 'rental', 'farm', 'farm_rental', 'common'] as const;
const SOFTWARE_TYPES = ['ultratax', 'cch', 'lacerte', 'gosystem', 'generic'] as const;

const RETURN_FORM_LABELS: Record<string, string> = {
  '1040': '1040',
  '1065': '1065',
  '1120': '1120',
  '1120S': '1120S',
  common: 'Common',
};

const ACTIVITY_TYPE_LABELS: Record<string, string> = {
  business: 'Business',
  rental: 'Rental',
  farm: 'Farm',
  farm_rental: 'Farm Rental',
  common: 'Common',
};

const SOFTWARE_LABELS: Record<string, string> = {
  ultratax: 'UltraTax',
  cch: 'CCH',
  lacerte: 'Lacerte',
  gosystem: 'GoSystem',
  generic: 'Generic',
};

const BADGE_FORM: Record<string, string> = {
  '1040': 'bg-blue-50 dark:bg-blue-900/40 text-blue-700 dark:text-blue-400',
  '1065': 'bg-purple-50 dark:bg-purple-900/40 text-purple-700 dark:text-purple-400',
  '1120': 'bg-amber-50 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400',
  '1120S': 'bg-green-50 dark:bg-green-900/40 text-green-700 dark:text-green-400',
  common: 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300',
};

const BADGE_ACTIVITY: Record<string, string> = {
  business: 'bg-indigo-50 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-400',
  rental: 'bg-orange-50 dark:bg-orange-900/40 text-orange-700 dark:text-orange-400',
  farm: 'bg-lime-50 dark:bg-lime-900/40 text-lime-700 dark:text-lime-400',
  farm_rental: 'bg-teal-50 dark:bg-teal-900/40 text-teal-700 dark:text-teal-400',
  common: 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300',
};

const PREVIEW_STATUS_CLASSES: Record<string, string> = {
  new: 'bg-green-50',
  update: 'bg-yellow-50',
  duplicate: 'bg-gray-50',
  error: 'bg-red-50',
};

const PREVIEW_STATUS_LABELS: Record<string, string> = {
  new: 'New',
  update: 'Update',
  duplicate: 'Duplicate',
  error: 'Error',
};

// ---- Helpers ----

function Badge({ label, colorClass }: { label: string; colorClass: string }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${colorClass}`}>
      {label}
    </span>
  );
}

function YesNoBadge({ value }: { value: boolean }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${value ? 'bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-400' : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400'}`}>
      {value ? 'Yes' : 'No'}
    </span>
  );
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-3xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b dark:border-gray-700 shrink-0">
          <h2 className="text-base font-semibold dark:text-white">{title}</h2>
          <button onClick={onClose} className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 text-xl leading-none">&times;</button>
        </div>
        <div className="px-5 py-4 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}

// ---- Software Mappings sub-table ----

interface SoftwareRowState {
  software: string;
  map?: SoftwareMap;
  code: string;
  description: string;
  dirty: boolean;
}

function SoftwareMappingsTable({
  taxCodeId,
  maps,
  onChanged,
}: {
  taxCodeId: number;
  maps: SoftwareMap[];
  onChanged: () => void;
}) {
  const buildRows = useCallback((): SoftwareRowState[] =>
    SOFTWARE_TYPES.map((sw) => {
      const existing = maps.find((m) => m.tax_software === sw);
      return {
        software: sw,
        map: existing,
        code: existing?.software_code ?? '',
        description: existing?.software_description ?? '',
        dirty: false,
      };
    }),
  [maps]);

  const [rows, setRows] = useState<SoftwareRowState[]>(buildRows);

  // Reset rows when maps prop changes
  const prevMapsRef = useRef<SoftwareMap[]>(maps);
  if (prevMapsRef.current !== maps) {
    prevMapsRef.current = maps;
    setRows(buildRows());
  }

  const saveMutation = useMutation({
    mutationFn: async (row: SoftwareRowState) => {
      const data: SoftwareMapInput = {
        taxSoftware: row.software,
        softwareCode: row.code || undefined,
        softwareDescription: row.description || undefined,
      };
      if (row.map) {
        if (!row.code && !row.description) {
          return deleteSoftwareMap(row.map.id);
        }
        return updateSoftwareMap(row.map.id, data);
      }
      if (row.code || row.description) {
        return createSoftwareMap(taxCodeId, data);
      }
      return null;
    },
    onSuccess: () => onChanged(),
  });

  const setRow = (idx: number, field: 'code' | 'description', value: string) => {
    setRows((prev) => prev.map((r, i) => i === idx ? { ...r, [field]: value, dirty: true } : r));
  };

  const saveRow = (idx: number) => {
    const row = rows[idx];
    if (!row.dirty) return;
    saveMutation.mutate(row);
    setRows((prev) => prev.map((r, i) => i === idx ? { ...r, dirty: false } : r));
  };

  return (
    <div>
      <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">Software Mappings</p>
      <div className="border border-gray-200 dark:border-gray-700 rounded overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 dark:bg-gray-800/60">
            <tr>
              <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 w-28">Software</th>
              <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 dark:text-gray-400">Software Code</th>
              <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 dark:text-gray-400">Software Description</th>
              <th className="px-3 py-2 w-16"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
            {rows.map((row, idx) => (
              <tr key={row.software}>
                <td className="px-3 py-1.5 text-xs text-gray-700 dark:text-gray-300 font-medium">{SOFTWARE_LABELS[row.software]}</td>
                <td className="px-3 py-1">
                  <input
                    value={row.code}
                    onChange={(e) => setRow(idx, 'code', e.target.value)}
                    onBlur={() => saveRow(idx)}
                    className="w-full border border-gray-200 dark:border-gray-600 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                    placeholder="—"
                  />
                </td>
                <td className="px-3 py-1">
                  <input
                    value={row.description}
                    onChange={(e) => setRow(idx, 'description', e.target.value)}
                    onBlur={() => saveRow(idx)}
                    className="w-full border border-gray-200 dark:border-gray-600 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                    placeholder="—"
                  />
                </td>
                <td className="px-3 py-1 text-center">
                  {row.dirty && (
                    <button
                      onClick={() => saveRow(idx)}
                      className="text-xs text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
                    >
                      Save
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Changes auto-save on blur. Clearing both fields removes the mapping.</p>
    </div>
  );
}

// ---- Edit / Create Panel ----

interface EditPanelProps {
  initial?: TaxCode;
  onSave: (data: TaxCodeInput) => void;
  onCancel: () => void;
  onDelete?: () => void;
  saving: boolean;
  error?: string | null;
  mapRefresh: () => void;
}

function EditPanel({ initial, onSave, onCancel, onDelete, saving, error, mapRefresh }: EditPanelProps) {
  const [form, setForm] = useState<TaxCodeInput>({
    returnForm: initial?.return_form ?? '1040',
    activityType: initial?.activity_type ?? 'business',
    taxCode: initial?.tax_code ?? '',
    description: initial?.description ?? '',
    sortOrder: initial?.sort_order ?? 0,
    notes: initial?.notes ?? '',
    isActive: initial?.is_active ?? true,
    isM1Adjustment: initial?.is_m1_adjustment ?? false,
  });

  const set = <K extends keyof TaxCodeInput>(k: K, v: TaxCodeInput[K]) =>
    setForm((prev) => ({ ...prev, [k]: v }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({ ...form, notes: form.notes || undefined });
  };

  const isSystem = initial?.is_system ?? false;
  const showMappings = !!initial;

  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-800/60 p-4 mt-4">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="flex items-center justify-between mb-1">
          <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200">
            {initial ? 'Edit Tax Code' : 'New Tax Code'}
            {isSystem && (
              <span className="ml-2 text-xs font-normal text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/30 px-2 py-0.5 rounded">System</span>
            )}
          </h3>
          <button type="button" onClick={onCancel} className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 text-xl leading-none">&times;</button>
        </div>

        {error && (
          <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 text-red-700 dark:text-red-400 px-3 py-2 rounded text-sm">{error}</div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-400 mb-1">Return Form</label>
            <select
              value={form.returnForm}
              onChange={(e) => set('returnForm', e.target.value)}
              className="w-full border border-gray-300 dark:border-gray-600 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
            >
              {RETURN_FORMS.map((f) => (
                <option key={f} value={f}>{RETURN_FORM_LABELS[f]}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-400 mb-1">Activity Type</label>
            <select
              value={form.activityType}
              onChange={(e) => set('activityType', e.target.value)}
              className="w-full border border-gray-300 dark:border-gray-600 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
            >
              {ACTIVITY_TYPES.map((a) => (
                <option key={a} value={a}>{ACTIVITY_TYPE_LABELS[a]}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-400 mb-1">Tax Code</label>
            <input
              value={form.taxCode}
              onChange={(e) => set('taxCode', e.target.value)}
              readOnly={isSystem}
              className={`w-full border border-gray-300 dark:border-gray-600 rounded px-2 py-1.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white ${isSystem ? 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-500 cursor-not-allowed' : ''}`}
              required
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-400 mb-1">Sort Order</label>
            <input
              type="number"
              value={form.sortOrder ?? 0}
              onChange={(e) => set('sortOrder', Number(e.target.value))}
              className="w-full border border-gray-300 dark:border-gray-600 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
            />
          </div>
          <div className="col-span-2">
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-400 mb-1">Description</label>
            <input
              value={form.description}
              onChange={(e) => set('description', e.target.value)}
              className="w-full border border-gray-300 dark:border-gray-600 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
              required
            />
          </div>
          <div className="col-span-2">
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-400 mb-1">Notes</label>
            <textarea
              value={form.notes ?? ''}
              onChange={(e) => set('notes', e.target.value)}
              rows={2}
              className="w-full border border-gray-300 dark:border-gray-600 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white resize-none"
              placeholder="Optional"
            />
          </div>
          <div className="col-span-2 flex items-center gap-6">
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
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={form.isM1Adjustment ?? false}
                onChange={(e) => set('isM1Adjustment', e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm text-gray-700 dark:text-gray-300">M-1 Adjustment</span>
            </label>
          </div>
        </div>

        <div className="flex items-center justify-between pt-2">
          <div>
            {onDelete && !isSystem && (
              <button
                type="button"
                onClick={onDelete}
                className="px-3 py-1.5 text-sm text-red-600 dark:text-red-400 border border-red-200 dark:border-red-700 rounded hover:bg-red-50 dark:hover:bg-red-900/20"
              >
                Delete
              </button>
            )}
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={onCancel} className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-100 dark:hover:bg-gray-700/50 dark:text-gray-300">
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
        </div>
      </form>

      {showMappings && initial && (
        <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
          <SoftwareMappingsTable
            taxCodeId={initial.id}
            maps={initial.maps ?? []}
            onChanged={mapRefresh}
          />
        </div>
      )}
    </div>
  );
}

// ---- Import Modal ----

function ImportModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [preview, setPreview] = useState<ImportPreviewRow[] | null>(null);
  const [csvText, setCsvText] = useState('');
  const [fileName, setFileName] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const previewMutation = useMutation({
    mutationFn: (csv: string) => importTaxCodePreview(csv),
    onSuccess: (res) => {
      if (res.data) setPreview(res.data);
    },
  });

  const importMutation = useMutation({
    mutationFn: (csv: string) => importTaxCodes(csv),
    onSuccess: (res) => {
      if (!res.error) onSuccess();
    },
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
  const updateCount = preview?.filter((r) => r.status === 'update').length ?? 0;
  const errorCount = preview?.filter((r) => r.status === 'error').length ?? 0;
  const importableCount = newCount + updateCount;

  const result = importMutation.data;

  return (
    <Modal title="Import Tax Codes from CSV" onClose={onClose}>
      <div className="space-y-4">
        {result?.data ? (
          <>
            <div className="bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-700 rounded px-4 py-3 text-sm text-green-800 dark:text-green-400">
              Import complete: <strong>{result.data.imported}</strong> tax codes imported.
            </div>
            <div className="flex justify-end">
              <button onClick={onClose} className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700">Done</button>
            </div>
          </>
        ) : (
          <>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              CSV must have columns: <code className="bg-gray-100 dark:bg-gray-700 px-1 rounded text-xs">tax_code, return_form, activity_type, description</code>. Optional: <code className="bg-gray-100 dark:bg-gray-700 px-1 rounded text-xs">sort_order, notes</code>.
            </p>

            <div
              className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-6 text-center cursor-pointer hover:border-blue-400 dark:hover:border-blue-500 hover:bg-blue-50/30 dark:hover:bg-blue-900/10 transition-colors"
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
              <p className="text-sm text-gray-500 dark:text-gray-400 text-center">Analyzing file…</p>
            )}

            {preview && (
              <>
                <div className="flex items-center gap-4 text-sm">
                  <span className="text-green-700 dark:text-green-400 font-medium">{newCount} new</span>
                  <span className="text-yellow-700 dark:text-yellow-400 font-medium">{updateCount} updates</span>
                  {errorCount > 0 && <span className="text-red-600 dark:text-red-400 font-medium">{errorCount} errors</span>}
                </div>

                <div className="border border-gray-200 dark:border-gray-700 rounded overflow-auto max-h-64">
                  <table className="w-full text-xs">
                    <thead className="bg-gray-50 dark:bg-gray-800/60 sticky top-0">
                      <tr>
                        <th className="px-2 py-1.5 text-left font-semibold text-gray-500 dark:text-gray-400 w-20">Status</th>
                        <th className="px-2 py-1.5 text-left font-semibold text-gray-500 dark:text-gray-400">Tax Code</th>
                        <th className="px-2 py-1.5 text-left font-semibold text-gray-500 dark:text-gray-400">Form</th>
                        <th className="px-2 py-1.5 text-left font-semibold text-gray-500 dark:text-gray-400">Activity</th>
                        <th className="px-2 py-1.5 text-left font-semibold text-gray-500 dark:text-gray-400">Description</th>
                        <th className="px-2 py-1.5 text-left font-semibold text-gray-500 dark:text-gray-400">Error</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                      {preview.slice(0, 100).map((row, i) => (
                        <tr key={i} className={PREVIEW_STATUS_CLASSES[row.status]}>
                          <td className="px-2 py-1 font-medium text-gray-600 dark:text-gray-400">{PREVIEW_STATUS_LABELS[row.status]}</td>
                          <td className="px-2 py-1 font-mono">{row.tax_code}</td>
                          <td className="px-2 py-1">{row.return_form}</td>
                          <td className="px-2 py-1">{row.activity_type}</td>
                          <td className="px-2 py-1 max-w-48 truncate">{row.description}</td>
                          <td className="px-2 py-1 text-red-600 dark:text-red-400">{row.error ?? ''}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}

            {importMutation.data?.error && (
              <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 text-red-700 dark:text-red-400 px-3 py-2 rounded text-sm">
                {importMutation.data.error.message}
              </div>
            )}

            <div className="flex justify-end gap-2">
              <button onClick={onClose} className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-700/50 dark:text-gray-300">Cancel</button>
              <button
                onClick={() => importMutation.mutate(csvText)}
                disabled={!preview || importableCount === 0 || importMutation.isPending}
                className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-40"
              >
                {importMutation.isPending ? 'Importing…' : `Import ${importableCount} Code${importableCount !== 1 ? 's' : ''}`}
              </button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}

// ---- Main Page ----

export function TaxCodesPage() {
  const { user } = useAuthStore();
  const qc = useQueryClient();

  const [filters, setFilters] = useState<ListTaxCodesParams>({
    returnForm: '',
    activityType: '',
    search: '',
    includeInactive: false,
  });
  const [m1Only, setM1Only] = useState(false);
  const [page, setPage] = useState(0);
  const [editId, setEditId] = useState<number | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [panelError, setPanelError] = useState<string | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const activeFilters: ListTaxCodesParams = {
    returnForm: filters.returnForm || undefined,
    activityType: filters.activityType || undefined,
    search: filters.search || undefined,
    includeInactive: filters.includeInactive || undefined,
  };

  const { data: listData, isLoading } = useQuery({
    queryKey: ['tax-codes', activeFilters],
    queryFn: async () => {
      const res = await listTaxCodes(activeFilters);
      if (res.error) throw new Error(res.error.message);
      return res.data ?? [];
    },
  });

  const { data: editData } = useQuery({
    queryKey: ['tax-code', editId],
    queryFn: async () => {
      if (!editId) return null;
      const res = await getTaxCode(editId);
      if (res.error) throw new Error(res.error.message);
      return res.data;
    },
    enabled: editId !== null,
  });

  const allCodes = listData ?? [];
  const filteredCodes = m1Only ? allCodes.filter((c) => c.is_m1_adjustment) : allCodes;

  const PAGE_SIZE = 50;
  const totalPages = Math.ceil(filteredCodes.length / PAGE_SIZE);
  const codes = filteredCodes.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  // Reset to first page when filters change
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { setPage(0); }, [filters, m1Only]);

  // Scroll the edit/create panel into view when it opens
  useEffect(() => {
    if ((editId || showCreate) && panelRef.current) {
      panelRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [editId, showCreate]);

  const totalCodes = allCodes.length;
  const activeCodes = allCodes.filter((c) => c.is_active).length;
  const systemCodes = allCodes.filter((c) => c.is_system).length;
  const m1Codes = allCodes.filter((c) => c.is_m1_adjustment).length;

  const createMutation = useMutation({
    mutationFn: (data: TaxCodeInput) => createTaxCode(data),
    onSuccess: (res) => {
      if (res.error) { setPanelError(res.error.message); return; }
      qc.invalidateQueries({ queryKey: ['tax-codes'] });
      setShowCreate(false);
      setPanelError(null);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<TaxCodeInput> }) => updateTaxCode(id, data),
    onSuccess: (res) => {
      if (res.error) { setPanelError(res.error.message); return; }
      qc.invalidateQueries({ queryKey: ['tax-codes'] });
      qc.invalidateQueries({ queryKey: ['tax-code', editId] });
      setPanelError(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteTaxCode(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tax-codes'] });
      setEditId(null);
      setPanelError(null);
    },
  });

  const handleDelete = (code: TaxCode) => {
    if (code.is_system) return;
    if (!confirm(`Delete tax code "${code.tax_code}"? This will unmap all accounts using this code. Continue?`)) return;
    deleteMutation.mutate(code.id);
  };

  const refreshEdit = () => {
    if (editId) qc.invalidateQueries({ queryKey: ['tax-code', editId] });
  };

  if (user?.role !== 'admin') {
    return (
      <div className="flex items-center justify-center h-full text-gray-400 dark:text-gray-500">
        <div className="text-center">
          <p className="text-lg font-medium text-gray-700 dark:text-gray-300">Admin access required</p>
          <p className="text-sm mt-1">You must be an administrator to manage tax codes.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Tax Code Management</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">System-wide tax code library and software mappings</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowImport(true)}
            className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-700/50 dark:text-gray-300"
          >
            Import CSV
          </button>
          <a
            href={exportTaxCodesUrl(activeFilters)}
            target="_blank"
            rel="noreferrer"
            className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-700/50 dark:text-gray-300 inline-block"
          >
            Export Excel
          </a>
          <button
            onClick={() => { setShowCreate(true); setEditId(null); setPanelError(null); }}
            className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            + Add Tax Code
          </button>
        </div>
      </div>

      {/* Filter bar */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <select
          value={filters.returnForm ?? ''}
          onChange={(e) => setFilters((f) => ({ ...f, returnForm: e.target.value }))}
          className="border border-gray-300 dark:border-gray-600 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
        >
          <option value="">All Forms</option>
          {RETURN_FORMS.map((f) => <option key={f} value={f}>{RETURN_FORM_LABELS[f]}</option>)}
        </select>
        <select
          value={filters.activityType ?? ''}
          onChange={(e) => setFilters((f) => ({ ...f, activityType: e.target.value }))}
          className="border border-gray-300 dark:border-gray-600 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
        >
          <option value="">All Activities</option>
          {ACTIVITY_TYPES.map((a) => <option key={a} value={a}>{ACTIVITY_TYPE_LABELS[a]}</option>)}
        </select>
        <input
          value={filters.search ?? ''}
          onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
          placeholder="Search code or description…"
          className="border border-gray-300 dark:border-gray-600 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white min-w-52"
        />
        <label className="flex items-center gap-1.5 text-sm text-gray-600 dark:text-gray-400 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={filters.includeInactive ?? false}
            onChange={(e) => setFilters((f) => ({ ...f, includeInactive: e.target.checked }))}
            className="rounded border-gray-300 dark:border-gray-600 text-blue-600"
          />
          Include inactive
        </label>
        <label className="flex items-center gap-1.5 text-sm text-gray-600 dark:text-gray-400 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={m1Only}
            onChange={(e) => setM1Only(e.target.checked)}
            className="rounded border-gray-300 dark:border-gray-600 text-blue-600"
          />
          M-1 adjustments only
        </label>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-3 mb-4">
        {[
          { label: 'Total Codes', value: totalCodes },
          { label: 'Active', value: activeCodes },
          { label: 'System', value: systemCodes },
          { label: 'M-1 Adjustments', value: m1Codes },
        ].map((s) => (
          <div key={s.label} className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 px-4 py-3">
            <p className="text-xs text-gray-500 dark:text-gray-400">{s.label}</p>
            <p className="text-2xl font-semibold text-gray-900 dark:text-white">{s.value}</p>
          </div>
        ))}
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12 text-gray-400 dark:text-gray-500">Loading…</div>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/60">
                  <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">Return Form</th>
                  <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">Activity</th>
                  <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">Tax Code</th>
                  <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">Description</th>
                  <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider w-16">Sort</th>
                  <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider w-16">M-1</th>
                  <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider w-16">System</th>
                  <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider w-16">Active</th>
                  <th className="px-3 py-2.5 text-right text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider w-24">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {codes.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-3 py-8 text-center text-gray-400 dark:text-gray-500">
                      No tax codes found. Add one or import from CSV.
                    </td>
                  </tr>
                ) : (
                  codes.map((code) => (
                    <tr
                      key={code.id}
                      className={`hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors cursor-pointer ${editId === code.id ? 'bg-blue-50 dark:bg-blue-900/20' : ''}`}
                      onClick={() => { setEditId(code.id); setShowCreate(false); setPanelError(null); }}
                    >
                      <td className="px-3 py-2.5">
                        <Badge label={RETURN_FORM_LABELS[code.return_form] ?? code.return_form} colorClass={BADGE_FORM[code.return_form] ?? 'bg-gray-100 text-gray-600'} />
                      </td>
                      <td className="px-3 py-2.5">
                        <Badge label={ACTIVITY_TYPE_LABELS[code.activity_type] ?? code.activity_type} colorClass={BADGE_ACTIVITY[code.activity_type] ?? 'bg-gray-100 text-gray-600'} />
                      </td>
                      <td className="px-3 py-2.5">
                        <span className="font-mono font-bold text-gray-900 dark:text-white">{code.tax_code}</span>
                      </td>
                      <td className="px-3 py-2.5 text-gray-700 dark:text-gray-300 max-w-xs truncate">{code.description}</td>
                      <td className="px-3 py-2.5 text-gray-500 dark:text-gray-400">{code.sort_order}</td>
                      <td className="px-3 py-2.5"><YesNoBadge value={code.is_m1_adjustment} /></td>
                      <td className="px-3 py-2.5"><YesNoBadge value={code.is_system} /></td>
                      <td className="px-3 py-2.5"><YesNoBadge value={code.is_active} /></td>
                      <td className="px-3 py-2.5">
                        <div className="flex items-center justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={() => { setEditId(code.id); setShowCreate(false); setPanelError(null); }}
                            className="text-xs text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
                          >
                            Edit
                          </button>
                          {!code.is_system && (
                            <button
                              onClick={() => handleDelete(code)}
                              className="text-xs text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                            >
                              Delete
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-3 text-sm text-gray-600 dark:text-gray-400">
          <span>{filteredCodes.length} codes &mdash; page {page + 1} of {totalPages}</span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
              className="px-3 py-1 border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-700/50 dark:text-gray-300 disabled:opacity-40"
            >
              &larr; Prev
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
              className="px-3 py-1 border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-700/50 dark:text-gray-300 disabled:opacity-40"
            >
              Next &rarr;
            </button>
          </div>
        </div>
      )}

      {/* Edit / Create panel */}
      <div ref={panelRef}>
        {editId && editData && (
          <EditPanel
            initial={editData}
            onSave={(data) => updateMutation.mutate({ id: editId, data })}
            onCancel={() => setEditId(null)}
            onDelete={() => handleDelete(editData)}
            saving={updateMutation.isPending}
            error={panelError}
            mapRefresh={refreshEdit}
          />
        )}

        {showCreate && (
          <EditPanel
            onSave={(data) => createMutation.mutate(data)}
            onCancel={() => setShowCreate(false)}
            saving={createMutation.isPending}
            error={panelError}
            mapRefresh={() => {}}
          />
        )}
      </div>

      {/* Import modal */}
      {showImport && (
        <ImportModal
          onClose={() => setShowImport(false)}
          onSuccess={() => {
            qc.invalidateQueries({ queryKey: ['tax-codes'] });
            setShowImport(false);
          }}
        />
      )}
    </div>
  );
}
