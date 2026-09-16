// Copyright 2025-2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Use is limited to qualifying small businesses. See LICENSE for terms.

import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { PasswordConfirmDialog } from '../auth/PasswordConfirmDialog';
import { SECURITY_QUERY_KEY, revokeAllTrustedBrowsers, revokeTrustedBrowser, type TrustedBrowserInfo, type TwoFactorStatus } from '../../api/security';
import { describeUserAgent } from '../../utils/userAgentLabel';
import { pushToast } from '../../store/uiStore';

const fmt = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString() : 'never');

export function TrustedBrowsersSection({ status }: { status: TwoFactorStatus }) {
  const qc = useQueryClient();
  const [revoking, setRevoking] = useState<TrustedBrowserInfo | 'all' | null>(null);
  const refresh = () => qc.invalidateQueries({ queryKey: SECURITY_QUERY_KEY });
  const rows = status.trustedBrowsers;

  return (
    <div>
      <h4 className="text-sm font-medium text-gray-800 dark:text-gray-200 mb-1">Trusted browsers</h4>
      <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
        Browsers where you ticked "Remember this browser for 30 days" skip the code prompt.
      </p>
      {rows.length === 0 ? (
        <p className="text-xs text-gray-400 dark:text-gray-500">No trusted browsers. Tick "Remember this browser" when entering a code to add one.</p>
      ) : (
        <>
          <ul className="divide-y divide-gray-100 dark:divide-gray-700 mb-3 max-w-md">
            {rows.map((b) => (
              <li key={b.id} className="flex items-center justify-between gap-3 py-2">
                <div className="min-w-0">
                  <p className="text-sm text-gray-800 dark:text-gray-200" title={b.userAgent ?? undefined}>
                    {describeUserAgent(b.userAgent)}
                    {b.current && <span className="ml-2 inline-flex px-1.5 py-0.5 rounded text-[10px] font-medium bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">This browser</span>}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Trusted {fmt(b.createdAt)} · Last used {fmt(b.lastUsedAt)} · Expires {fmt(b.expiresAt)}</p>
                </div>
                <button type="button" onClick={() => setRevoking(b)} className="text-xs text-red-500 hover:text-red-700 dark:text-red-400 whitespace-nowrap">Revoke</button>
              </li>
            ))}
          </ul>
          <button type="button" onClick={() => setRevoking('all')} className="px-3 py-1.5 text-sm border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 rounded hover:bg-red-50 dark:hover:bg-red-900/20">
            Revoke all
          </button>
        </>
      )}

      {revoking && (
        <PasswordConfirmDialog
          title={revoking === 'all' ? 'Revoke all trusted browsers' : 'Revoke trusted browser'}
          message={revoking === 'all'
            ? 'Every remembered browser will ask for a code at the next sign-in.'
            : `${describeUserAgent(revoking.userAgent)} will ask for a code at the next sign-in.`}
          confirmLabel="Revoke"
          onConfirm={(pw) => (revoking === 'all' ? revokeAllTrustedBrowsers(pw) : revokeTrustedBrowser(revoking.id, pw)).then((r) => {
            if (!r.error) { pushToast('Revoked.', 'success'); void refresh(); }
            return r;
          })}
          onClose={() => setRevoking(null)}
        />
      )}
    </div>
  );
}
