// Copyright 2025-2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Use is limited to qualifying small businesses. See LICENSE for terms.

/**
 * Document storage administration: provider, folder template, and the
 * client ↔ folder links.
 *
 * Everything an operator needs is here — no .env editing and no scripts.
 */

import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getStorageSettings,
  saveStorageSettings,
  testStorage,
  getFolderTemplate,
  saveFolderTemplate,
  listClientLinks,
  listUnboundFolders,
  createClientFolder,
  linkClientFolder,
  verifyClientFolder,
  unlinkClientFolder,
  SECRET_KEEP,
  type StorageProvider,
  type FolderSectionInput,
  type ClientLinkRow,
} from '../api/storage';
import { useAuthStore, pushToast } from '../store/uiStore';
import { confirmAction } from '../components/ConfirmDialog';

const STATUS_STYLE: Record<string, string> = {
  active: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400',
  missing: 'bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-400',
  conflict: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400',
  unlinked: 'bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-300',
};

const inputCls =
  'w-full border border-gray-300 dark:border-gray-600 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white';

export function StoragePage() {
  const { user } = useAuthStore();
  const qc = useQueryClient();

  const settingsQuery = useQuery({
    queryKey: ['storage-settings'],
    queryFn: async () => {
      const res = await getStorageSettings();
      if (res.error) throw new Error(res.error.message);
      return res.data!;
    },
  });

  const [provider, setProvider] = useState<StorageProvider>('local');
  const [prefix, setPrefix] = useState('');
  const [endpoint, setEndpoint] = useState('');
  const [region, setRegion] = useState('');
  const [bucket, setBucket] = useState('');
  const [keyId, setKeyId] = useState('');
  const [appKey, setAppKey] = useState('');
  const [keyIdEdited, setKeyIdEdited] = useState(false);
  const [appKeyEdited, setAppKeyEdited] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    const s = settingsQuery.data;
    if (!s) return;
    setProvider(s.provider);
    setPrefix(s.prefix);
    setEndpoint(s.b2.endpoint);
    setRegion(s.b2.region);
    setBucket(s.b2.bucket);
    setKeyIdEdited(false);
    setAppKeyEdited(false);
    setKeyId('');
    setAppKey('');
  }, [settingsQuery.data]);

  /** Unedited secrets go back as the sentinel so they're preserved. */
  const buildPatch = () => ({
    provider,
    prefix,
    b2Endpoint: endpoint,
    b2Region: region,
    b2Bucket: bucket,
    b2KeyId: keyIdEdited && keyId !== '' ? keyId : SECRET_KEEP,
    b2ApplicationKey: appKeyEdited && appKey !== '' ? appKey : SECRET_KEEP,
  });

  const saveMutation = useMutation({
    mutationFn: () => saveStorageSettings(buildPatch()),
    onSuccess: (res) => {
      if (res.error) { pushToast(res.error.message, 'error'); return; }
      pushToast('Storage settings saved.', 'success');
      if (res.data?.configError) pushToast(res.data.configError, 'error');
      qc.invalidateQueries({ queryKey: ['storage-settings'] });
    },
  });

  const runTest = async () => {
    setTesting(true);
    setTestResult(null);
    const res = await testStorage(buildPatch());
    setTesting(false);
    if (res.error) { setTestResult({ ok: false, text: res.error.message }); return; }
    setTestResult({
      ok: true,
      text: res.data!.provider === 'local'
        ? 'Local disk needs no connection test.'
        : `Connected in ${res.data!.latencyMs} ms.`,
    });
  };

  // ── Folder template ────────────────────────────────────────────────────────
  const templateQuery = useQuery({
    queryKey: ['storage-folder-template'],
    queryFn: async () => {
      const res = await getFolderTemplate();
      if (res.error) throw new Error(res.error.message);
      return res.data ?? [];
    },
  });
  const [sections, setSections] = useState<FolderSectionInput[]>([]);
  useEffect(() => {
    if (!templateQuery.data) return;
    setSections(templateQuery.data.map((s) => ({
      id: s.id, name: s.name, sortOrder: s.sort_order,
      isWorkpaperTarget: s.is_workpaper_target, isDefaultUpload: s.is_default_upload,
    })));
  }, [templateQuery.data]);

  const templateMutation = useMutation({
    mutationFn: () => saveFolderTemplate(sections.map((s, i) => ({ ...s, sortOrder: i * 10 }))),
    onSuccess: (res) => {
      if (res.error) { pushToast(res.error.message, 'error'); return; }
      pushToast('Folder template saved.', 'success');
      qc.invalidateQueries({ queryKey: ['storage-folder-template'] });
    },
  });

  // ── Links ──────────────────────────────────────────────────────────────────
  const linksQuery = useQuery({
    queryKey: ['storage-links'],
    queryFn: async () => {
      const res = await listClientLinks();
      if (res.error) throw new Error(res.error.message);
      return res.data ?? [];
    },
  });

  const [linkingClient, setLinkingClient] = useState<ClientLinkRow | null>(null);
  const invalidateLinks = () => qc.invalidateQueries({ queryKey: ['storage-links'] });

  const createMutation = useMutation({
    mutationFn: (clientId: number) => createClientFolder(clientId),
    onSuccess: (res) => {
      if (res.error) { pushToast(res.error.message, 'error'); return; }
      pushToast(`Folder created: ${res.data!.link.storage_path}`, 'success');
      invalidateLinks();
    },
  });

  const verifyMutation = useMutation({
    mutationFn: (clientId: number) => verifyClientFolder(clientId),
    onSuccess: (res) => {
      if (res.error) { pushToast(res.error.message, 'error'); return; }
      pushToast(res.data!.message, res.data!.status === 'active' ? 'success' : 'error');
      invalidateLinks();
    },
  });

  const unlinkMutation = useMutation({
    mutationFn: (clientId: number) => unlinkClientFolder(clientId),
    onSuccess: (res) => {
      if (res.error) { pushToast(res.error.message, 'error'); return; }
      pushToast('Unlinked. The folder and its files were left in place.', 'success');
      invalidateLinks();
    },
  });

  if (user?.role !== 'admin') {
    return (
      <div className="flex items-center justify-center h-full text-gray-400 dark:text-gray-500">
        <div className="text-center">
          <p className="text-lg font-medium">Access Denied</p>
          <p className="text-sm mt-1">Document storage settings require admin access.</p>
        </div>
      </div>
    );
  }

  const s = settingsQuery.data;
  const links = linksQuery.data ?? [];
  const unlinkedCount = links.filter((l) => !l.link_id).length;
  const problemCount = links.filter((l) => l.status && l.status !== 'active').length;

  return (
    <div className="p-6 max-w-5xl space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Document Storage</h2>
        <p className="text-sm text-gray-500 dark:text-gray-500 mt-0.5">
          Where uploaded documents, lead sheet attachments and saved workpaper packages are kept.
        </p>
      </div>

      {/* ── Provider ────────────────────────────────────────────────────── */}
      <section className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg">
        <div className="px-5 py-3 border-b border-gray-100 dark:border-gray-700">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Provider</h3>
        </div>
        <div className="px-5 py-4 space-y-4">
          {s?.envOverride && (
            <div className="text-xs bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 text-blue-800 dark:text-blue-300 px-3 py-2 rounded">
              These values currently come from environment variables. Saving here stores them in the
              database, which takes precedence from then on.
            </div>
          )}
          {s?.configError && (
            <div className="text-xs bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 text-red-700 dark:text-red-400 px-3 py-2 rounded">
              {s.configError}
            </div>
          )}

          <div className="flex gap-5">
            <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
              <input type="radio" checked={provider === 'local'} onChange={() => setProvider('local')} />
              Local disk
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
              <input type="radio" checked={provider === 'b2'} onChange={() => setProvider('b2')} />
              Backblaze B2 (or any S3-compatible store)
            </label>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
              Key prefix <span className="text-gray-400 dark:text-gray-500">(lets one bucket host several apps)</span>
            </label>
            <input value={prefix} onChange={(e) => setPrefix(e.target.value)} className={`${inputCls} max-w-xs`} placeholder="vibe-tb" />
          </div>

          {provider === 'b2' && (
            <div className="space-y-3 border-l-2 border-gray-200 dark:border-gray-600 pl-4">
              <div className="text-xs bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-400 px-3 py-2 rounded space-y-1">
                <p>
                  The endpoint must be the <strong>S3-compatible</strong> host, e.g.{' '}
                  <code className="font-mono">https://s3.us-west-004.backblazeb2.com</code> — not the native B2 API URL.
                </p>
                <p>
                  Set the bucket's lifecycle rule to <strong>“Keep only the last version”</strong>, or every
                  overwrite silently accumulates billable hidden versions.
                </p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="md:col-span-3">
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Endpoint</label>
                  <input value={endpoint} onChange={(e) => setEndpoint(e.target.value)} className={inputCls} placeholder="https://s3.us-west-004.backblazeb2.com" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Region</label>
                  <input value={region} onChange={(e) => setRegion(e.target.value)} className={inputCls} placeholder="us-west-004" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Bucket</label>
                  <input value={bucket} onChange={(e) => setBucket(e.target.value)} className={inputCls} />
                </div>
                <div />
                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Key ID</label>
                  <input
                    type="password"
                    value={keyId}
                    // Only typing counts as an edit. Flipping this on focus
                    // would send '' on save, which the server reads as an
                    // explicit clear — tabbing through the field while fixing
                    // the bucket name would wipe the credential.
                    onChange={(e) => { setKeyIdEdited(true); setKeyId(e.target.value); }}
                    placeholder={s?.b2.hasKeyId ? '•••••••• (saved — leave blank to keep)' : ''}
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Application Key</label>
                  <input
                    type="password"
                    value={appKey}
                    onChange={(e) => { setAppKeyEdited(true); setAppKey(e.target.value); }}
                    placeholder={s?.b2.hasApplicationKey ? '•••••••• (saved — leave blank to keep)' : ''}
                    className={inputCls}
                  />
                </div>
              </div>
            </div>
          )}

          {testResult && (
            <div className={`text-xs px-3 py-2 rounded border ${testResult.ok
              ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800 text-green-800 dark:text-green-400'
              : 'bg-red-50 dark:bg-red-900/30 border-red-200 dark:border-red-700 text-red-700 dark:text-red-400'}`}>
              {testResult.text}
            </div>
          )}

          <div className="flex items-center gap-2">
            <button
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending}
              className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
            >
              {saveMutation.isPending ? 'Saving…' : 'Save'}
            </button>
            <button
              onClick={() => void runTest()}
              disabled={testing}
              className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-700/50 dark:text-gray-300 disabled:opacity-50"
            >
              {testing ? 'Testing…' : 'Test connection'}
            </button>
            {s?.lastTestedAt && (
              <span className="text-xs text-gray-400 dark:text-gray-500">
                Last tested {new Date(s.lastTestedAt).toLocaleString()}
              </span>
            )}
          </div>
        </div>
      </section>

      {/* ── Folder template ─────────────────────────────────────────────── */}
      <section className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg">
        <div className="px-5 py-3 border-b border-gray-100 dark:border-gray-700">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Folder template</h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            Documents are filed as <span className="font-mono">Client / Section / FY&lt;year&gt; / file</span>.
            Renaming a section affects only future uploads.
          </p>
        </div>
        <div className="px-5 py-4 space-y-2">
          {sections.map((sec, i) => (
            <div key={sec.id ?? `new-${i}`} className="flex items-center gap-3 flex-wrap">
              <input
                value={sec.name}
                onChange={(e) => setSections((p) => p.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))}
                className={`${inputCls} max-w-xs`}
              />
              <label className="flex items-center gap-1.5 text-xs text-gray-700 dark:text-gray-300">
                <input
                  type="radio"
                  name="wp-target"
                  checked={sec.isWorkpaperTarget}
                  onChange={() => setSections((p) => p.map((x, j) => ({ ...x, isWorkpaperTarget: j === i })))}
                />
                Workpapers &amp; attachments
              </label>
              <label className="flex items-center gap-1.5 text-xs text-gray-700 dark:text-gray-300">
                <input
                  type="radio"
                  name="dflt-upload"
                  checked={sec.isDefaultUpload}
                  onChange={() => setSections((p) => p.map((x, j) => ({ ...x, isDefaultUpload: j === i })))}
                />
                Default for uploads
              </label>
              <button
                onClick={() => setSections((p) => p.filter((_, j) => j !== i))}
                disabled={sec.isWorkpaperTarget || sec.isDefaultUpload || sections.length <= 1}
                title={sec.isWorkpaperTarget || sec.isDefaultUpload ? 'Move the flag to another section first' : 'Remove'}
                className="text-xs text-red-500 hover:text-red-700 dark:text-red-400 disabled:opacity-30 disabled:cursor-not-allowed ml-auto"
              >
                Remove
              </button>
            </div>
          ))}
          <div className="flex gap-2 pt-2">
            <button
              onClick={() => setSections((p) => [...p, { name: 'New section', sortOrder: p.length * 10, isWorkpaperTarget: false, isDefaultUpload: false }])}
              className="text-xs text-blue-600 hover:text-blue-800 dark:text-blue-400"
            >
              + Add section
            </button>
            <button
              onClick={() => templateMutation.mutate()}
              disabled={templateMutation.isPending}
              className="ml-auto px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
            >
              {templateMutation.isPending ? 'Saving…' : 'Save template'}
            </button>
          </div>
        </div>
      </section>

      {/* ── Client folders ──────────────────────────────────────────────── */}
      <section className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100 dark:border-gray-700">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Client folders</h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            A client must be linked to a folder before documents can be uploaded for it.
            {unlinkedCount > 0 && <span className="text-amber-700 dark:text-amber-400 font-medium"> {unlinkedCount} unlinked.</span>}
            {problemCount > 0 && <span className="text-red-600 dark:text-red-400 font-medium"> {problemCount} need attention.</span>}
          </p>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/60">
              <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase">Client</th>
              <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase">Folder</th>
              <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase">Status</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
            {links.length === 0 ? (
              <tr><td colSpan={4} className="px-4 py-8 text-center text-gray-400 dark:text-gray-500">No active clients.</td></tr>
            ) : links.map((l) => {
              const status = !l.link_id ? 'unlinked' : (l.status ?? 'active');
              return (
                <tr key={l.client_id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                  <td className="px-4 py-2.5 font-medium text-gray-900 dark:text-white">{l.client_name}</td>
                  <td className="px-4 py-2.5 font-mono text-xs text-gray-600 dark:text-gray-400">
                    {l.storage_path ?? <span className="text-gray-300 dark:text-gray-600">—</span>}
                    {l.is_legacy_layout && (
                      <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300">legacy layout</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5">
                    <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${STATUS_STYLE[status]}`}>{status}</span>
                  </td>
                  <td className="px-4 py-2.5 text-right whitespace-nowrap">
                    {!l.link_id ? (
                      <>
                        <button onClick={() => createMutation.mutate(l.client_id)} className="text-xs text-blue-600 hover:text-blue-800 dark:text-blue-400 mr-3">Create folder</button>
                        <button onClick={() => setLinkingClient(l)} className="text-xs text-blue-600 hover:text-blue-800 dark:text-blue-400">Link existing…</button>
                      </>
                    ) : (
                      <>
                        <button onClick={() => verifyMutation.mutate(l.client_id)} className="text-xs text-blue-600 hover:text-blue-800 dark:text-blue-400 mr-3">Verify</button>
                        <button
                          onClick={async () => {
                            if (await confirmAction({ message: `Unlink "${l.client_name}"? The folder and its files stay in storage.`, tone: 'danger', confirmLabel: 'Unlink' })) {
                              unlinkMutation.mutate(l.client_id);
                            }
                          }}
                          className="text-xs text-red-500 hover:text-red-700 dark:text-red-400"
                        >
                          Unlink
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>

      {linkingClient && (
        <LinkFolderModal
          client={linkingClient}
          onClose={() => setLinkingClient(null)}
          onLinked={() => { setLinkingClient(null); invalidateLinks(); }}
        />
      )}
    </div>
  );
}

function LinkFolderModal({
  client,
  onClose,
  onLinked,
}: {
  client: ClientLinkRow;
  onClose: () => void;
  onLinked: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const foldersQuery = useQuery({
    queryKey: ['storage-unbound-folders'],
    queryFn: async () => {
      const res = await listUnboundFolders();
      if (res.error) throw new Error(res.error.message);
      return res.data ?? [];
    },
  });

  const link = async (path: string) => {
    setBusy(true);
    setError(null);
    const res = await linkClientFolder(client.client_id, path);
    setBusy(false);
    if (res.error) { setError(res.error.message); return; }
    pushToast(`Linked to ${path}`, 'success');
    onLinked();
  };

  const folders = foldersQuery.data ?? [];

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-2xl max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b dark:border-gray-700">
          <h2 className="text-base font-semibold dark:text-white">Link a folder — {client.client_name}</h2>
          <button onClick={onClose} aria-label="Close" className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 text-xl leading-none">&times;</button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {error && (
            <div className="mb-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 text-red-700 dark:text-red-400 px-3 py-2 rounded text-sm">
              {error}
            </div>
          )}
          {foldersQuery.isLoading ? (
            <p className="text-sm text-gray-400 dark:text-gray-500 py-8 text-center">Scanning storage…</p>
          ) : folders.length === 0 ? (
            <p className="text-sm text-gray-400 dark:text-gray-500 py-8 text-center">
              No folders found under the configured prefix. Use “Create folder” instead.
            </p>
          ) : (
            <ul className="divide-y divide-gray-100 dark:divide-gray-700">
              {folders.map((f) => {
                const taken = f.boundToClientId !== null && f.boundToClientId !== client.client_id;
                return (
                  <li key={f.path} className="py-2.5 flex items-center gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="text-sm text-gray-900 dark:text-white truncate">{f.name}</div>
                      <div className="text-xs font-mono text-gray-500 dark:text-gray-400 truncate">{f.path}</div>
                    </div>
                    {taken ? (
                      <span className="text-xs text-amber-700 dark:text-amber-400">already bound</span>
                    ) : (
                      <span className="text-xs text-gray-400 dark:text-gray-500">{f.hasSentinel ? 'has marker' : 'unclaimed'}</span>
                    )}
                    <button
                      onClick={() => void link(f.path)}
                      disabled={busy || taken}
                      className="px-2.5 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      Link
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
