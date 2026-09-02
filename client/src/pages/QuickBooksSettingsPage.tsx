// Copyright 2025-2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Use is limited to qualifying small businesses. See LICENSE for terms.

/**
 * Intuit app credentials for the QuickBooks Online connector — admin only,
 * under the Admin sidebar group. Client ID, Client Secret, environment and
 * redirect URI are Settings rows (the secret encrypted); nothing is read
 * from .env once these are saved. Per-client connections live on
 * Setup → QuickBooks.
 */

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getQboSettings,
  saveQboSettings,
  testQboCredentials,
  QBO_SECRET_KEEP,
  QBO_SETUP_GUIDE_URL,
  type QboEnvironment,
  type QboTestResult,
} from '../api/qbo';
import { openPdfPreview } from '../api/pdfReports';
import { useAuthStore, pushToast } from '../store/uiStore';
import { BASE_URL } from '../lib/baseConfig';

const inputCls =
  'w-full border border-gray-300 dark:border-gray-600 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white';

export function QuickBooksSettingsPage() {
  const { user, token } = useAuthStore();
  const qc = useQueryClient();
  const isAdmin = user?.role === 'admin';

  const settingsQuery = useQuery({
    queryKey: ['qbo-settings'],
    queryFn: async () => {
      const res = await getQboSettings();
      if (res.error) throw new Error(res.error.message);
      return res.data!;
    },
    enabled: isAdmin,
  });

  // ── Credentials form ─────────────────────────────────────────────────────
  const [environment, setEnvironment] = useState<QboEnvironment>('sandbox');
  const [clientId, setClientId] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  const [secretEdited, setSecretEdited] = useState(false);
  const [redirectOverride, setRedirectOverride] = useState('');
  const [testResult, setTestResult] = useState<QboTestResult | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

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

  const copyRedirect = async (value: string, key = 'redirect') => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(key);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      pushToast('Copy failed — select the text and copy it manually', 'error');
    }
  };


  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center h-full text-gray-400 dark:text-gray-500">
        <div className="text-center">
          <p className="text-lg font-medium">Access Denied</p>
          <p className="text-sm mt-1">QuickBooks API settings require admin access.</p>
        </div>
      </div>
    );
  }

  // ── Render ───────────────────────────────────────────────────────────────
  const s = settingsQuery.data;
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
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">QuickBooks API</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            The Intuit developer app this server uses to read clients' QuickBooks Online data. Connect individual clients under{' '}
            <Link to="/quickbooks" className="text-blue-600 dark:text-blue-400 hover:underline">Setup → QuickBooks</Link>.
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

      <section className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg">
        <div className="px-5 py-3 border-b border-gray-100 dark:border-gray-700">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Intuit app credentials</h3>
        </div>
        <div className="p-5 space-y-4">
          {settingsQuery.isLoading ? (
            <p className="text-sm text-gray-400">Loading…</p>
          ) : settingsQuery.error ? (
            <p className="text-sm text-red-600 dark:text-red-400">{(settingsQuery.error as Error).message}</p>
          ) : !s ? null : (
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
            {copied === 'redirect' ? 'Copied' : 'Copy'}
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

      {s && (
        <section className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg">
          <div className="px-5 py-3 border-b border-gray-100 dark:border-gray-700">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Intuit production checklist values</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              Intuit's "App details" and "Compliance" tasks ask for these before it unlocks production keys. They are derived from the saved redirect URI, so save first if you changed it. The privacy policy and licence pages are served by this app and need no login.
            </p>
          </div>
          <div className="p-5 space-y-3">
            {([
              ['hostDomain', 'Host domain', s.intuitUrls.hostDomain, 'No https:// — Intuit wants the bare domain.'],
              ['launchUrl', 'Launch URL', s.intuitUrls.launchUrl, 'Where a user lands after authenticating (sign-in first is fine).'],
              ['disconnectUrl', 'Disconnect URL', s.intuitUrls.disconnectUrl, 'Where QuickBooks sends a user who disconnects from its My Apps page; the client then shows Needs re-authorization.'],
              ['connectUrl', 'Connect / Reconnect URL', s.intuitUrls.connectUrl, 'The connections page, where Connect and Reconnect live.'],
              ['privacyPolicyUrl', 'Privacy policy URL', s.intuitUrls.privacyPolicyUrl, 'Public page served by this app.'],
              ['eulaUrl', 'End-user license agreement URL', s.intuitUrls.eulaUrl, 'Public page served by this app.'],
            ] as Array<[string, string, string, string]>).map(([key, label, value, hint]) => (
              <div key={key}>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">{label}</label>
                <div className="flex items-center gap-2">
                  <code className="flex-1 text-xs px-2 py-1.5 rounded bg-gray-100 dark:bg-gray-900 text-gray-800 dark:text-gray-200 break-all select-all">{value}</code>
                  {key !== 'hostDomain' && (
                    <a
                      href={value}
                      target="_blank"
                      rel="noreferrer"
                      className="px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-700/50 dark:text-gray-300 whitespace-nowrap"
                    >
                      Open
                    </a>
                  )}
                  <button
                    type="button"
                    onClick={() => copyRedirect(value, key)}
                    className="px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-700/50 dark:text-gray-300 whitespace-nowrap"
                  >
                    {copied === key ? 'Copied' : 'Copy'}
                  </button>
                </div>
                <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">{hint}</p>
              </div>
            ))}
            <div className="text-xs text-gray-600 dark:text-gray-400 border-t border-gray-100 dark:border-gray-700 pt-3 space-y-1">
              <p>
                <span className="font-medium">Where your app is hosted:</span> Intuit asks for the country and the public IP address(es) this server calls Intuit from. That is the outbound address of the server or its internet connection — your hosting provider or router shows it, or run <code>curl https://api.ipify.org</code> on the server. Hosting the server on a residential connection whose IP changes means updating this entry when it does.
              </p>
              <p>
                <span className="font-medium">Operator name on the public pages:</span> the privacy policy and licence name the firm from <Link to="/settings" className="text-blue-600 dark:text-blue-400 hover:underline">Settings → Firm identity</Link>. Fill that in before submitting the URLs to Intuit.
              </p>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
