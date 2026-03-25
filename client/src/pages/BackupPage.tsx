import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../store/uiStore';
import { listClients, type Client } from '../api/clients';
import { listPeriods, type Period } from '../api/periods';
import {
  getBackupHistory,
  getRestoreHistory,
  createFullBackup,
  createSettingsBackup,
  createClientBackup,
  createPeriodBackup,
  deleteBackup,
  downloadBackup,
  uploadBackupFile,
  executeRestore,
  type BackupRecord,
  type RestoreRecord,
  type UploadPreview,
} from '../api/backup';

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function fmtBytes(bytes: number | null): string {
  if (bytes === null) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleString();
}

function badgeClass(status: string): string {
  if (status === 'completed') return 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400';
  if (status === 'failed') return 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-400';
  if (status === 'in_progress') return 'bg-yellow-100 dark:bg-yellow-900/40 text-yellow-700 dark:text-yellow-400';
  return 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300';
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────────────

function Spinner() {
  return (
    <svg className="animate-spin h-4 w-4 text-blue-600 dark:text-blue-400 inline-block" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-sm">
      <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-700">
        <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-200">{title}</h2>
      </div>
      <div className="px-5 py-4">{children}</div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Section 1: Create Backup
// ─────────────────────────────────────────────────────────────────────────────

function CreateBackupSection({ clients, onCreated }: {
  clients: Client[];
  onCreated: () => void;
}) {
  const qc = useQueryClient();
  const [clientId, setClientId] = useState<number | ''>('');
  const [periodId, setPeriodId] = useState<number | ''>('');
  const [lastResult, setLastResult] = useState<BackupRecord | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);

  const periodsQ = useQuery({
    queryKey: ['periods', clientId],
    queryFn: async () => {
      if (!clientId) return [];
      const res = await listPeriods(clientId as number);
      return res.data ?? [];
    },
    enabled: !!clientId,
  });
  const filteredPeriods: Period[] = periodsQ.data ?? [];

  const mutation = useMutation({
    mutationFn: async (type: 'full' | 'settings' | 'client' | 'period') => {
      setError(null);
      setLastResult(null);
      if (type === 'full') return createFullBackup();
      if (type === 'settings') return createSettingsBackup();
      if (type === 'client') {
        if (!clientId) throw new Error('Select a client first');
        return createClientBackup(clientId as number);
      }
      if (type === 'period') {
        if (!periodId) throw new Error('Select a period first');
        return createPeriodBackup(periodId as number);
      }
      throw new Error('Unknown type');
    },
    onSuccess: async (result) => {
      if (result.error) {
        setError(result.error.message);
      } else {
        setLastResult(result.data);
        qc.invalidateQueries({ queryKey: ['backup-history'] });
        onCreated();
      }
    },
    onError: (err: unknown) => {
      setError(err instanceof Error ? err.message : 'Unknown error');
    },
  });

  const handleDownloadLast = async () => {
    if (!lastResult) return;
    setDownloading(true);
    try {
      await downloadBackup(lastResult.id, lastResult.filename);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Download failed');
    } finally {
      setDownloading(false);
    }
  };

  return (
    <SectionCard title="Create Backup">
      <div className="space-y-4">
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => mutation.mutate('full')}
            disabled={mutation.isPending}
            className="px-3 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
          >
            {mutation.isPending && mutation.variables === 'full' && <Spinner />}
            Backup Everything (Full)
          </button>
          <button
            onClick={() => mutation.mutate('settings')}
            disabled={mutation.isPending}
            className="px-3 py-2 text-sm bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-2"
          >
            {mutation.isPending && mutation.variables === 'settings' && <Spinner />}
            Backup Settings
          </button>
        </div>

        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Client</label>
            <select
              value={clientId}
              onChange={(e) => { setClientId(e.target.value ? parseInt(e.target.value, 10) : ''); setPeriodId(''); }}
              className="border border-gray-300 dark:border-gray-600 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
            >
              <option value="">— select client —</option>
              {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <button
            onClick={() => mutation.mutate('client')}
            disabled={mutation.isPending || !clientId}
            className="px-3 py-2 text-sm bg-emerald-600 text-white rounded hover:bg-emerald-700 disabled:opacity-50 flex items-center gap-2"
          >
            {mutation.isPending && mutation.variables === 'client' && <Spinner />}
            Backup Client
          </button>
        </div>

        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Period</label>
            <select
              value={periodId}
              onChange={(e) => setPeriodId(e.target.value ? parseInt(e.target.value, 10) : '')}
              className="border border-gray-300 dark:border-gray-600 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
              disabled={!clientId}
            >
              <option value="">— select period —</option>
              {filteredPeriods.map((p) => <option key={p.id} value={p.id}>{p.period_name}</option>)}
            </select>
          </div>
          <button
            onClick={() => mutation.mutate('period')}
            disabled={mutation.isPending || !periodId}
            className="px-3 py-2 text-sm bg-amber-600 text-white rounded hover:bg-amber-700 disabled:opacity-50 flex items-center gap-2"
          >
            {mutation.isPending && mutation.variables === 'period' && <Spinner />}
            Backup Period
          </button>
        </div>

        {error && (
          <div className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 rounded px-3 py-2">{error}</div>
        )}

        {lastResult && (
          <div className="text-sm bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-700 rounded px-3 py-2 flex items-center gap-3">
            <span className="text-green-700 dark:text-green-400 font-medium">Backup created:</span>
            <span className="text-gray-700 dark:text-gray-300 font-mono text-xs">{lastResult.filename}</span>
            <span className="text-gray-500 dark:text-gray-400 text-xs font-mono">{fmtBytes(lastResult.file_size)}</span>
            <button
              onClick={handleDownloadLast}
              disabled={downloading}
              className="ml-auto text-xs text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 underline disabled:opacity-50"
            >
              {downloading ? 'Downloading…' : 'Download'}
            </button>
          </div>
        )}
      </div>
    </SectionCard>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Section 2: Backup History
// ─────────────────────────────────────────────────────────────────────────────

function BackupHistorySection({ records }: { records: BackupRecord[] }) {
  const qc = useQueryClient();
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [downloadingId, setDownloadingId] = useState<number | null>(null);

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteBackup(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['backup-history'] });
      setDeletingId(null);
    },
  });

  const handleDownload = async (record: BackupRecord) => {
    setDownloadingId(record.id);
    try {
      await downloadBackup(record.id, record.filename);
    } finally {
      setDownloadingId(null);
    }
  };

  const handleDelete = (id: number) => {
    if (!window.confirm('Delete this backup? This cannot be undone.')) return;
    setDeletingId(id);
    deleteMutation.mutate(id);
  };

  if (records.length === 0) {
    return (
      <SectionCard title="Backup History">
        <p className="text-sm text-gray-500 italic">No backups yet.</p>
      </SectionCard>
    );
  }

  return (
    <SectionCard title="Backup History">
      <div className="overflow-x-auto">
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr className="border-b border-gray-200 dark:border-gray-700">
              <th className="text-left py-2 px-2 text-gray-500 dark:text-gray-400 font-medium">Date</th>
              <th className="text-left py-2 px-2 text-gray-500 dark:text-gray-400 font-medium">Type</th>
              <th className="text-left py-2 px-2 text-gray-500 dark:text-gray-400 font-medium">Client / Period</th>
              <th className="text-left py-2 px-2 text-gray-500 dark:text-gray-400 font-medium">Size</th>
              <th className="text-left py-2 px-2 text-gray-500 dark:text-gray-400 font-medium">Trigger</th>
              <th className="text-left py-2 px-2 text-gray-500 dark:text-gray-400 font-medium">Status</th>
              <th className="text-right py-2 px-2 text-gray-500 dark:text-gray-400 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {records.map((r) => (
              <tr key={r.id} className="border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50">
                <td className="py-2 px-2 text-gray-700 dark:text-gray-300 whitespace-nowrap">{fmtDate(r.created_at)}</td>
                <td className="py-2 px-2">
                  <span className="capitalize font-medium text-gray-700 dark:text-gray-300">{r.backup_type}</span>
                </td>
                <td className="py-2 px-2 text-gray-600 dark:text-gray-400">
                  {r.client_name ?? '—'}
                  {r.period_name && <span className="text-gray-400 dark:text-gray-500"> / {r.period_name}</span>}
                </td>
                <td className="py-2 px-2 text-sm font-mono text-gray-600 dark:text-gray-400 whitespace-nowrap tabular-nums">{fmtBytes(r.file_size)}</td>
                <td className="py-2 px-2 text-gray-500 dark:text-gray-400 capitalize">{r.trigger_type.replace('_', ' ')}</td>
                <td className="py-2 px-2">
                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${badgeClass(r.status)}`}>
                    {r.status}
                  </span>
                </td>
                <td className="py-2 px-2 text-right whitespace-nowrap">
                  <button
                    onClick={() => handleDownload(r)}
                    disabled={downloadingId === r.id}
                    className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 underline mr-3 disabled:opacity-50"
                  >
                    {downloadingId === r.id ? 'Downloading…' : 'Download'}
                  </button>
                  <button
                    onClick={() => handleDelete(r.id)}
                    disabled={deletingId === r.id}
                    className="text-red-500 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 underline disabled:opacity-50"
                  >
                    {deletingId === r.id ? 'Deleting…' : 'Delete'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </SectionCard>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Section 3: Restore
// ─────────────────────────────────────────────────────────────────────────────

function RestoreSection({ clients }: { clients: Client[] }) {
  const qc = useQueryClient();
  const [dragging, setDragging] = useState(false);
  const [preview, setPreview] = useState<UploadPreview | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [mode, setMode] = useState<string>('as_new');
  const [targetClientId, setTargetClientId] = useState<number | ''>('');
  const [result, setResult] = useState<{ success: boolean; newClientId?: number | null } | null>(null);
  const [restoreError, setRestoreError] = useState<string | null>(null);

  const restoreMutation = useMutation({
    mutationFn: () => {
      const payload: { tempFile?: string; mode: string; targetClientId?: number } = {
        tempFile: preview?.tempFile,
        mode,
      };
      if (targetClientId) payload.targetClientId = targetClientId as number;
      return executeRestore(payload);
    },
    onSuccess: (res) => {
      if (res.error) {
        setRestoreError(res.error.message);
      } else {
        setResult({ success: true, newClientId: res.data?.newClientId ?? null });
        qc.invalidateQueries({ queryKey: ['restore-history'] });
        qc.invalidateQueries({ queryKey: ['clients'] });
      }
    },
    onError: (err: unknown) => {
      setRestoreError(err instanceof Error ? err.message : 'Unknown error');
    },
  });

  const handleFile = async (file: File) => {
    setUploadError(null);
    setPreview(null);
    setResult(null);
    setRestoreError(null);
    setUploading(true);
    try {
      const res = await uploadBackupFile(file);
      if (res.error) {
        setUploadError(res.error.message);
      } else if (res.data) {
        setPreview(res.data);
        // Set default mode based on backup type
        const bt = res.data.manifest.backupType;
        if (bt === 'settings') setMode('settings');
        else setMode('as_new');
      }
    } finally {
      setUploading(false);
    }
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, []);

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  };

  const isClientOrPeriod = preview && (preview.manifest.backupType === 'client' || preview.manifest.backupType === 'period');
  const isSettings = preview && preview.manifest.backupType === 'settings';

  return (
    <SectionCard title="Restore from Backup">
      <div className="space-y-4">
        {/* Drag-drop zone */}
        <div
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
            dragging ? 'border-blue-400 bg-blue-50 dark:bg-blue-900/20' : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500'
          }`}
        >
          {uploading ? (
            <div className="flex items-center justify-center gap-2 text-sm text-gray-600 dark:text-gray-400">
              <Spinner /> Uploading and parsing backup file…
            </div>
          ) : (
            <>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                Drag and drop a <span className="font-mono">.tbak</span> file here, or
              </p>
              <label className="cursor-pointer text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 underline">
                browse to select file
                <input type="file" accept=".tbak,.zip" onChange={handleFileInput} className="hidden" />
              </label>
            </>
          )}
        </div>

        {uploadError && (
          <div className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 rounded px-3 py-2">{uploadError}</div>
        )}

        {/* Manifest Preview */}
        {preview && (
          <div className="bg-gray-50 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700 rounded-lg p-4 space-y-3">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Backup Preview</h3>
            <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-xs">
              <div className="text-gray-500 dark:text-gray-400">Type</div>
              <div className="text-gray-800 dark:text-gray-200 capitalize font-medium">{preview.manifest.backupType}</div>
              <div className="text-gray-500 dark:text-gray-400">Created</div>
              <div className="text-gray-800 dark:text-gray-200">{fmtDate(preview.manifest.createdAt)}</div>
              <div className="text-gray-500 dark:text-gray-400">Created By</div>
              <div className="text-gray-800 dark:text-gray-200">{preview.manifest.createdBy}</div>
              {preview.manifest.clientName && (
                <>
                  <div className="text-gray-500 dark:text-gray-400">Client</div>
                  <div className="text-gray-800 dark:text-gray-200">{preview.manifest.clientName}</div>
                </>
              )}
              {preview.manifest.periodName && (
                <>
                  <div className="text-gray-500 dark:text-gray-400">Period</div>
                  <div className="text-gray-800 dark:text-gray-200">{preview.manifest.periodName}</div>
                </>
              )}
            </div>
            <div>
              <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Record Counts</div>
              <div className="flex flex-wrap gap-2">
                {Object.entries(preview.manifest.recordCounts).map(([table, count]) => (
                  <span key={table} className="text-[11px] bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded px-2 py-0.5 text-gray-700 dark:text-gray-300">
                    <span className="font-mono">{table}</span>: {count}
                  </span>
                ))}
              </div>
            </div>

            {/* Mode selector */}
            {isClientOrPeriod && (
              <div className="space-y-2">
                <div className="text-xs font-medium text-gray-700 dark:text-gray-300">Restore Mode</div>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 text-sm cursor-pointer dark:text-gray-300">
                    <input type="radio" name="restore-mode" value="as_new" checked={mode === 'as_new'} onChange={() => setMode('as_new')} />
                    Restore as New Client
                  </label>
                  <label className="flex items-center gap-2 text-sm cursor-pointer dark:text-gray-300">
                    <input type="radio" name="restore-mode" value="replace" checked={mode === 'replace'} onChange={() => setMode('replace')} />
                    Replace Existing Client
                  </label>
                </div>
                {mode === 'replace' && (
                  <div>
                    <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Target Client</label>
                    <select
                      value={targetClientId}
                      onChange={(e) => setTargetClientId(e.target.value ? parseInt(e.target.value, 10) : '')}
                      className="border border-gray-300 dark:border-gray-600 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                    >
                      <option value="">— select client to replace —</option>
                      {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                    <p className="text-[11px] text-amber-600 dark:text-amber-400 mt-1">
                      Warning: A pre-restore backup of the target client will be created first.
                    </p>
                  </div>
                )}
              </div>
            )}

            {isSettings && (
              <div className="text-xs text-gray-600 dark:text-gray-400 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded px-3 py-2">
                Settings restore: tax codes will be upserted, app settings replaced, and new users added (existing users unchanged).
              </div>
            )}

            {restoreError && (
              <div className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 rounded px-3 py-2">{restoreError}</div>
            )}

            {result?.success ? (
              <div className="text-sm bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-700 rounded px-3 py-2 text-green-700 dark:text-green-400">
                Restore completed successfully.
                {result.newClientId && (
                  <span className="ml-1 text-gray-600 dark:text-gray-400">(New client ID: {result.newClientId})</span>
                )}
              </div>
            ) : (
              <button
                onClick={() => restoreMutation.mutate()}
                disabled={restoreMutation.isPending || (mode === 'replace' && !targetClientId)}
                className="px-4 py-2 text-sm bg-orange-600 text-white rounded hover:bg-orange-700 disabled:opacity-50 flex items-center gap-2"
              >
                {restoreMutation.isPending && <Spinner />}
                Execute Restore
              </button>
            )}
          </div>
        )}
      </div>
    </SectionCard>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Section 4: Restore History
// ─────────────────────────────────────────────────────────────────────────────

function RestoreHistorySection({ records }: { records: RestoreRecord[] }) {
  if (records.length === 0) {
    return (
      <SectionCard title="Restore History">
        <p className="text-sm text-gray-500 italic">No restore operations yet.</p>
      </SectionCard>
    );
  }

  return (
    <SectionCard title="Restore History">
      <div className="overflow-x-auto">
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr className="border-b border-gray-200 dark:border-gray-700">
              <th className="text-left py-2 px-2 text-gray-500 dark:text-gray-400 font-medium">Date</th>
              <th className="text-left py-2 px-2 text-gray-500 dark:text-gray-400 font-medium">Mode</th>
              <th className="text-left py-2 px-2 text-gray-500 dark:text-gray-400 font-medium">Target Client</th>
              <th className="text-left py-2 px-2 text-gray-500 dark:text-gray-400 font-medium">New Client ID</th>
              <th className="text-left py-2 px-2 text-gray-500 dark:text-gray-400 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {records.map((r) => (
              <tr key={r.id} className="border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50">
                <td className="py-2 px-2 text-gray-700 dark:text-gray-300 whitespace-nowrap">{fmtDate(r.restored_at)}</td>
                <td className="py-2 px-2 capitalize text-gray-700 dark:text-gray-300">{r.restore_mode.replace('_', ' ')}</td>
                <td className="py-2 px-2 text-gray-600 dark:text-gray-400">{r.target_client_name ?? (r.target_client_id ? `#${r.target_client_id}` : '—')}</td>
                <td className="py-2 px-2 text-gray-600 dark:text-gray-400">{r.new_client_id ?? '—'}</td>
                <td className="py-2 px-2">
                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${badgeClass(r.status)}`}>
                    {r.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </SectionCard>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Page
// ─────────────────────────────────────────────────────────────────────────────

export function BackupPage() {
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'admin';

  const clientsQuery = useQuery({
    queryKey: ['clients'],
    queryFn: async () => {
      const res = await listClients();
      return res.data ?? [];
    },
    enabled: isAdmin,
  });

  const backupHistoryQuery = useQuery({
    queryKey: ['backup-history'],
    queryFn: async () => {
      const res = await getBackupHistory();
      return res.data ?? [];
    },
    enabled: isAdmin,
  });

  const restoreHistoryQuery = useQuery({
    queryKey: ['restore-history'],
    queryFn: async () => {
      const res = await getRestoreHistory();
      return res.data ?? [];
    },
    enabled: isAdmin,
  });

  if (!isAdmin) {
    return (
      <div className="p-6">
        <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 rounded-lg p-6 text-center">
          <p className="text-red-700 dark:text-red-400 font-medium">Admin access required</p>
          <p className="text-sm text-red-500 dark:text-red-400 mt-1">Only administrators can access the Backup &amp; Restore system.</p>
        </div>
      </div>
    );
  }

  const clients = clientsQuery.data ?? [];
  const backupRecords = backupHistoryQuery.data ?? [];
  const restoreRecords = restoreHistoryQuery.data ?? [];

  return (
    <div className="p-6 space-y-6 max-w-5xl">
      <div>
        <h1 className="text-xl font-semibold text-gray-900 dark:text-white">Backup &amp; Restore</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Create and manage backups. Nightly full backups run automatically at 2:00 AM.
        </p>
      </div>

      <CreateBackupSection
        clients={clients}
        onCreated={() => backupHistoryQuery.refetch()}
      />

      <BackupHistorySection records={backupRecords} />

      <RestoreSection clients={clients} />

      <RestoreHistorySection records={restoreRecords} />
    </div>
  );
}
