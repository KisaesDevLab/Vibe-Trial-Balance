// Copyright 2025-2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Use is limited to qualifying small businesses. See LICENSE for terms.

/**
 * QuickBooks Online connector administration: the Intuit app credentials
 * (admin) and the per-client company connections.
 *
 * Everything is entered here — no .env editing. The Intuit callback lands
 * on this page with `?pending=<id>` and the binding is confirmed in a modal
 * before anything is written to the client.
 */

import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getQboSettings,
  saveQboSettings,
  testQboCredentials,
  listQboConnections,
  startQboConnect,
  getQboPending,
  bindQboPending,
  discardQboPending,
  testQboConnection,
  deleteQboConnection,
  QBO_SECRET_KEEP,
  QBO_SETUP_GUIDE_URL,
  type QboEnvironment,
  type QboConnectionRow,
  type QboPending,
  type QboTestResult,
} from '../api/qbo';
import { openPdfPreview } from '../api/pdfReports';
import { useAuthStore, pushToast } from '../store/uiStore';
import { confirmAction } from '../components/ConfirmDialog';
import { BASE_URL } from '../lib/baseConfig';

const STATUS_STYLE: Record<string, string> = {
  active: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400',
  needs_reauth: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400',
  error: 'bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-400',
  not_connected: 'bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-300',
};

const STATUS_LABEL: Record<string, string> = {
  active: 'Connected',
  needs_reauth: 'Needs re-authorization',
  error: 'Error',
  not_connected: 'Not connected',
};

const CALLBACK_ERRORS: Record<string, string> = {
  access_denied: 'QuickBooks authorization was cancelled — no company was connected.',
  state_invalid: 'That authorization link has expired or was already used. Start the connection again.',
  exchange_failed: 'Intuit rejected the authorization code. Check the Client ID, Client Secret and Redirect URI, then try again.',
  company_info_failed: 'Connected to Intuit, but the company details could not be read. Try again.',
  not_configured: 'QuickBooks credentials are not configured.',
};

const inputCls =
  'w-full border border-gray-300 dark:border-gray-600 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white';

function AdminBadge() {
  return (
    <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300 uppercase tracking-wide">
      admin
    </span>
  );
}

function fmtDate(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString();
}

/** Days until an ISO timestamp, negative when past. */
function daysUntil(iso: string | null): number | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return null;
  return Math.floor((t - Date.now()) / 86_400_000);
}

export function QuickBooksPage() {
  const { user, token } = useAuthStore();
  const qc = useQueryClient();
  const isAdmin = user?.role === 'admin';
  const [searchParams, setSearchParams] = useSearchParams();

  const settingsQuery = useQuery({
    queryKey: ['qbo-settings'],
    queryFn: async () => {
      const res = await getQboSettings();
      if (res.error) throw new Error(res.error.message);
      return res.data!;
    },
  });

  const connectionsQuery = useQuery({
    queryKey: ['qbo-connections'],
    queryFn: async () => {
      const res = await listQboConnections();
      if (res.error) throw new Error(res.error.message);
      return { rows: res.data ?? [], meta: res.meta ?? { configured: false, environment: 'sandbox' as QboEnvironment } };
    },
  });

  // ── Credentials form ─────────────────────────────────────────────────────
  const [environment, setEnvironment] = useState<QboEnvironment>('sandbox');
  const [clientId, setClientId] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  const [secretEdited, setSecretEdited] = useState(false);
  const [redirectOverride, setRedirectOverride] = useState('');
  const [testResult, setTestResult] = useState<QboTestResult | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const s = settingsQuery.data;
    if (!s) return;
    setEnvironment(s.environment);
    setClientId(s.clientId);
    setClientSecret('');
    setSecretEdited(false);
    setRedirectOverride(s.redirectUriOverride);
  }, [settingsQuery.data]);

  const patch = () => ({
    environment,
    clientId: clientId.trim(),
    clientSecret: secretEdited ? clientSecret : QBO_SECRET_KEEP,
    redirectUri: redirectOverride.trim(),
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const res = await saveQboSettings(patch());
      if (res.error) throw new Error(res.error.message);
      return res.data!;
    },
    onSuccess: () => {
      pushToast('QuickBooks settings saved', 'success');
      setTestResult(null);
      qc.invalidateQueries({ queryKey: ['qbo-settings'] });
      qc.invalidateQueries({ queryKey: ['qbo-connections'] });
    },
    onError: (e: Error) => pushToast(e.message, 'error'),
  });

  const testMutation = useMutation({
    mutationFn: async () => {
      const res = await testQboCredentials(patch());
      if (res.error) throw new Error(res.error.message);
      return res.data!;
    },
    onSuccess: (r) => setTestResult(r),
    onError: (e: Error) => setTestResult({ ok: false, message: e.message }),
  });

  const openGuide = async () => {
    if (!token) return;
    try {
      await openPdfPreview(QBO_SETUP_GUIDE_URL, token);
    } catch (e) {
      pushToast(`Could not open the setup guide: ${(e as Error).message}`, 'error');
    }
  };

  const copyRedirect = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      pushToast('Copy failed — select the text and copy it manually', 'error');
    }
  };

  // ── Connections ──────────────────────────────────────────────────────────
  const invalidateConnections = () => qc.invalidateQueries({ queryKey: ['qbo-connections'] });

  const connectMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await startQboConnect(id);
      if (res.error) throw new Error(res.error.message);
      return res.data!;
    },
    onSuccess: ({ authorizeUrl }) => window.location.assign(authorizeUrl),
    onError: (e: Error) => pushToast(e.message, 'error'),
  });

  const testConnMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await testQboConnection(id);
      if (res.error) throw new Error(res.error.message);
      return res.data!;
    },
    onSuccess: (r) => {
      pushToast(r.message, r.ok ? 'success' : 'error');
      invalidateConnections();
    },
    onError: (e: Error) => pushToast(e.message, 'error'),
  });

  const disconnectMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await deleteQboConnection(id);
      if (res.error) throw new Error(res.error.message);
      return res.data!;
    },
    onSuccess: (r) => {
      pushToast(r.revoked ? 'Disconnected and access revoked at Intuit' : 'Disconnected (Intuit revoke did not confirm — remove the app from QuickBooks if needed)', 'success');
      invalidateConnections();
    },
    onError: (e: Error) => pushToast(e.message, 'error'),
  });

  // ── Callback handoff (?pending= / ?error=) ───────────────────────────────
  const [pending, setPending] = useState<QboPending | null>(null);
  const [pendingBusy, setPendingBusy] = useState(false);

  useEffect(() => {
    const pendingParam = searchParams.get('pending');
    const errorParam = searchParams.get('error');
    if (!pendingParam && !errorParam) return;

    const next = new URLSearchParams(searchParams);
    next.delete('pending');
    next.delete('error');
    setSearchParams(next, { replace: true });

    if (errorParam) {
      pushToast(CALLBACK_ERRORS[errorParam] ?? `QuickBooks connection failed (${errorParam})`, 'error');
      return;
    }
    const id = Number(pendingParam);
    if (!Number.isInteger(id) || id <= 0) return;
    getQboPending(id).then((res) => {
      if (res.error || !res.data) {
        pushToast(res.error?.message ?? 'That QuickBooks authorization is no longer available', 'error');
        return;
      }
      setPending(res.data);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const bind = async () => {
    if (!pending) return;
    setPendingBusy(true);
    try {
      const res = await bindQboPending(pending.id);
      if (res.error) throw new Error(res.error.message);
      pushToast(
        res.data!.realmChanged
          ? `Connected ${pending.companyName ?? 'company'} to ${pending.clientName}. This is a different company than before — QuickBooks account links on the chart of accounts were cleared and will be rebuilt on the next import.`
          : `Connected ${pending.companyName ?? 'company'} to ${pending.clientName}`,
        'success',
      );
      setPending(null);
      invalidateConnections();
    } catch (e) {
      pushToast((e as Error).message, 'error');
    } finally {
      setPendingBusy(false);
    }
  };

  const discard = async () => {
    if (!pending) return;
    setPendingBusy(true);
    try {
      const res = await discardQboPending(pending.id);
      if (res.error) throw new Error(res.error.message);
      pushToast('Authorization discarded', 'success');
      setPending(null);
    } catch (e) {
      pushToast((e as Error).message, 'error');
    } finally {
      setPendingBusy(false);
    }
  };

  // ── Render ───────────────────────────────────────────────────────────────
  const s = settingsQuery.data;
  const rows: QboConnectionRow[] = connectionsQuery.data?.rows ?? [];
  const configured = connectionsQuery.data?.meta.configured ?? s?.configured ?? false;
  const effectiveRedirect = s
    ? (redirectOverride.trim() ? redirectOverride.trim() : s.defaultRedirectUri)
    : '';
  const browserBase = `${window.location.origin}${BASE_URL}`.replace(/\/+$/, '');
  const originMismatch = (() => {
    if (!s) return false;
    try {
      const u = new URL(effectiveRedirect);
      const b = new URL(browserBase);
      return u.origin !== b.origin;
    } catch {
      return false;
    }
  })();

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">QuickBooks Online</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            Pull a client's trial balance straight from QuickBooks. Read-only: nothing is ever written back.
          </p>
        </div>
        <button
          onClick={openGuide}
          className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-700/50 dark:text-gray-300 whitespace-nowrap"
          title="Step-by-step: create an Intuit developer app and configure this connector"
        >
          Setup guide (PDF)
        </button>
      </div>

      {/* ── Intuit app credentials ──────────────────────────────────────── */}
      <section className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg">
        <div className="px-5 py-3 border-b border-gray-100 dark:border-gray-700 flex items-center">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Intuit app credentials</h3>
          <AdminBadge />
        </div>
        <div className="p-5 space-y-4">
          {settingsQuery.isLoading ? (
            <p className="text-sm text-gray-400">Loading…</p>
          ) : settingsQuery.error ? (
            <p className="text-sm text-red-600 dark:text-red-400">{(settingsQuery.error as Error).message}</p>
          ) : !s ? null : !isAdmin ? (
            <div className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
              <p>
                {s.configured
                  ? <>Configured for the <span className="font-medium">{s.environment}</span> environment.</>
                  : 'Not configured yet.'}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-500">Only an administrator can change the Intuit app credentials.</p>
            </div>
          ) : (
            <>
              {s.envOverride && (
                <div className="text-xs px-3 py-2 rounded bg-blue-50 dark:bg-blue-900/20 text-blue-800 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                  These values are currently coming from the server's environment (<code>QBO_CLIENT_ID</code> / <code>QBO_CLIENT_SECRET</code>).
                  Saving here stores them in the app and takes precedence.
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Environment</label>
                <div className="flex gap-4">
                  {(['sandbox', 'production'] as QboEnvironment[]).map((env) => (
                    <label key={env} className="inline-flex items-center gap-1.5 text-sm text-gray-700 dark:text-gray-300 cursor-pointer">
                      <input type="radio" name="qbo-env" checked={environment === env} onChange={() => setEnvironment(env)} />
                      {env === 'sandbox' ? 'Sandbox (development keys)' : 'Production'}
                    </label>
                  ))}
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Sandbox and production keys are separate in the Intuit developer portal. Switching environments requires every client to reconnect.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Client ID</label>
                  <input className={inputCls} value={clientId} onChange={(e) => setClientId(e.target.value)} autoComplete="off" spellCheck={false} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Client Secret</label>
                  <input
                    type="password"
                    className={inputCls}
                    value={clientSecret}
                    placeholder={s.hasClientSecret ? s.clientSecretMasked || '••••••••' : 'Paste the secret from Keys & credentials'}
                    onChange={(e) => { setClientSecret(e.target.value); setSecretEdited(true); }}
                    autoComplete="new-password"
                  />
                  {s.hasClientSecret && !secretEdited && (
                    <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1">A secret is stored. Leave blank to keep it.</p>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Redirect URI</label>
                <div className="flex items-center gap-2">
                  <code className="flex-1 text-xs px-2 py-1.5 rounded bg-gray-100 dark:bg-gray-900 text-gray-800 dark:text-gray-200 break-all select-all">
                    {effectiveRedirect}
                  </code>
                  <button
                    type="button"
                    onClick={() => copyRedirect(effectiveRedirect)}
                    className="px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-700/50 dark:text-gray-300 whitespace-nowrap"
                  >
                    {copied ? 'Copied' : 'Copy'}
                  </button>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Add this exact value under <span className="font-medium">Keys &amp; credentials → Redirect URIs</span> in the Intuit app. Intuit rejects anything that differs by a character.
                </p>
                {originMismatch && (
                  <p className="text-xs text-amber-700 dark:text-amber-400 mt-1">
                    You are browsing this app at <code>{browserBase}</code>, but the redirect URI points at a different origin. If Intuit should send users back to the address you are using now, set the override below or the server's <code>APP_BASE_URL</code>.
                  </p>
                )}
                <input
                  className={`${inputCls} mt-2`}
                  value={redirectOverride}
                  onChange={(e) => setRedirectOverride(e.target.value)}
                  placeholder={`Override (optional) — default is ${s.defaultRedirectUri}`}
                  autoComplete="off"
                  spellCheck={false}
                />
              </div>

              {testResult && (
                <div className={`text-sm px-3 py-2 rounded ${testResult.ok
                  ? 'bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-300 border border-green-200 dark:border-green-800'
                  : 'bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-300 border border-red-200 dark:border-red-800'}`}>
                  {testResult.message}
                </div>
              )}

              <div className="flex items-center gap-2">
                <button
                  onClick={() => saveMutation.mutate()}
                  disabled={saveMutation.isPending || !clientId.trim()}
                  className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                >
                  {saveMutation.isPending ? 'Saving…' : 'Save'}
                </button>
                <button
                  onClick={() => testMutation.mutate()}
                  disabled={testMutation.isPending || !clientId.trim()}
                  className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-700/50 dark:text-gray-300 disabled:opacity-50"
                >
                  {testMutation.isPending ? 'Testing…' : 'Test credentials'}
                </button>
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  Test checks the Client ID and Secret against Intuit without connecting a company.
                </span>
              </div>
            </>
          )}
        </div>
      </section>

      {/* ── Client connections ──────────────────────────────────────────── */}
      <section className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100 dark:border-gray-700">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Client connections</h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            One QuickBooks company per client. Connecting opens Intuit's sign-in; a QuickBooks user with admin access to the company must approve it.
          </p>
        </div>
        {!configured && !connectionsQuery.isLoading && (
          <div className="mx-5 mt-4 text-xs px-3 py-2 rounded bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
            Enter and save the Intuit app credentials above before connecting a client.
          </div>
        )}
        <table className="w-full text-sm mt-2">
          <thead>
            <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/60">
              <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase">Client</th>
              <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase">QuickBooks company</th>
              <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase">Status</th>
              <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase">Access expires</th>
              <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase">Last import</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
            {connectionsQuery.isLoading ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">Loading…</td></tr>
            ) : connectionsQuery.error ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-red-600 dark:text-red-400">{(connectionsQuery.error as Error).message}</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400 dark:text-gray-500">No active clients.</td></tr>
            ) : rows.map((r) => {
              const days = daysUntil(r.refreshTokenExpiresAt);
              const expiringSoon = r.status === 'active' && days !== null && days <= 14;
              const busy = connectMutation.isPending || testConnMutation.isPending || disconnectMutation.isPending;
              return (
                <tr key={r.clientId} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                  <td className="px-4 py-2.5 font-medium text-gray-900 dark:text-white">{r.clientName}</td>
                  <td className="px-4 py-2.5 text-gray-700 dark:text-gray-300">
                    {r.companyName ?? <span className="text-gray-300 dark:text-gray-600">—</span>}
                    {r.environment && r.environment !== connectionsQuery.data?.meta.environment && (
                      <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400">{r.environment}</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5">
                    <span
                      className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${STATUS_STYLE[r.status] ?? STATUS_STYLE.not_connected}`}
                      title={r.statusDetail ?? undefined}
                    >
                      {STATUS_LABEL[r.status] ?? r.status}
                    </span>
                  </td>
                  <td className={`px-4 py-2.5 text-xs ${expiringSoon ? 'text-amber-700 dark:text-amber-400 font-medium' : 'text-gray-600 dark:text-gray-400'}`}>
                    {r.connectionId ? (
                      <>
                        {fmtDate(r.refreshTokenExpiresAt)}
                        {days !== null && r.status === 'active' && (
                          <span className="ml-1 text-gray-400">({days < 0 ? 'expired' : `${days}d`})</span>
                        )}
                      </>
                    ) : '—'}
                  </td>
                  <td className="px-4 py-2.5 text-xs text-gray-600 dark:text-gray-400">{fmtDate(r.lastImportAt)}</td>
                  <td className="px-4 py-2.5 text-right whitespace-nowrap">
                    {isAdmin && (
                      <>
                        <button
                          onClick={() => connectMutation.mutate(r.clientId)}
                          disabled={!configured || busy}
                          className="text-xs text-blue-600 hover:text-blue-800 dark:text-blue-400 disabled:opacity-40 mr-3"
                          title={!configured ? 'Save the Intuit credentials first' : undefined}
                        >
                          {r.connectionId ? 'Reconnect' : 'Connect'}
                        </button>
                        {r.connectionId && (
                          <>
                            <button
                              onClick={() => testConnMutation.mutate(r.connectionId!)}
                              disabled={busy}
                              className="text-xs text-blue-600 hover:text-blue-800 dark:text-blue-400 disabled:opacity-40 mr-3"
                            >
                              Test
                            </button>
                            <button
                              onClick={async () => {
                                if (await confirmAction({
                                  message: `Disconnect "${r.companyName ?? 'this company'}" from ${r.clientName}? Imported balances stay; the QuickBooks account links on the chart of accounts are kept for a future reconnect.`,
                                  tone: 'danger',
                                  confirmLabel: 'Disconnect',
                                })) {
                                  disconnectMutation.mutate(r.connectionId!);
                                }
                              }}
                              disabled={busy}
                              className="text-xs text-red-500 hover:text-red-700 dark:text-red-400 disabled:opacity-40"
                            >
                              Disconnect
                            </button>
                          </>
                        )}
                      </>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <div className="px-5 py-3 text-xs text-gray-500 dark:text-gray-400 border-t border-gray-100 dark:border-gray-700">
          Import balances from the <Link to="/trial-balance" className="text-blue-600 dark:text-blue-400 hover:underline">Trial Balance</Link> page — "Import from QuickBooks" appears there for connected clients.
        </div>
      </section>

      {pending && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md p-5 space-y-4">
            <h3 className="text-base font-semibold text-gray-900 dark:text-white">Confirm QuickBooks connection</h3>
            <p className="text-sm text-gray-700 dark:text-gray-300">
              You connected <span className="font-medium">{pending.companyName ?? `company ${pending.realmId}`}</span>
              {' '}({pending.environment}). Bind it to client <span className="font-medium">{pending.clientName}</span>?
            </p>
            {pending.replacesCompany && (
              <div className="text-xs px-3 py-2 rounded bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                {pending.clientName} is currently connected to <span className="font-medium">{pending.replacesCompany}</span>. Binding replaces that connection.
                {pending.replacesCompany !== pending.companyName && ' Because this is a different company, the QuickBooks account links on the chart of accounts will be cleared.'}
              </div>
            )}
            {pending.boundElsewhereTo && (
              <div className="text-xs px-3 py-2 rounded bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-300 border border-red-200 dark:border-red-800">
                This company is already connected to <span className="font-medium">{pending.boundElsewhereTo}</span>. Disconnect it there first — a company can only be bound to one client.
              </div>
            )}
            <div className="flex justify-end gap-2">
              <button
                onClick={discard}
                disabled={pendingBusy}
                className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-700/50 dark:text-gray-300 disabled:opacity-50"
              >
                Discard
              </button>
              <button
                onClick={bind}
                disabled={pendingBusy || !!pending.boundElsewhereTo}
                className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
              >
                {pendingBusy ? 'Working…' : 'Bind'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
