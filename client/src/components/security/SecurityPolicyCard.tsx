// Copyright 2025-2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Use is limited to qualifying small businesses. See LICENSE for terms.

/**
 * Settings → Sign-in security (admin): the public app URL passkeys bind to,
 * and the firm-wide "require 2FA" switch.
 */

import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getSecurityPolicy, saveSecurityPolicy, type SecurityPolicy } from '../../api/settings';
import { SECURITY_QUERY_KEY } from '../../api/security';
import { resetFeaturesCache } from '../../hooks/useFeatures';
import { confirmAction } from '../ConfirmDialog';
import { pushToast } from '../../store/uiStore';

const inputCls =
  'w-full border border-gray-300 dark:border-gray-600 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white';

const SOURCE_LABEL: Record<SecurityPolicy['publicUrlSource'], string> = {
  setting: 'set here',
  env: 'from the APP_BASE_URL environment variable',
  origin: 'from the ALLOWED_ORIGIN environment variable',
  default: 'the development default',
};

export function SecurityPolicyCard() {
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: ['security-policy'],
    queryFn: async () => {
      const res = await getSecurityPolicy();
      if (res.error) throw new Error(res.error.message);
      return res.data;
    },
  });

  const [publicUrl, setPublicUrl] = useState('');
  const [requireTwoFactor, setRequireTwoFactor] = useState(false);
  useEffect(() => {
    if (query.data) {
      setPublicUrl(query.data.publicUrl);
      setRequireTwoFactor(query.data.requireTwoFactor);
    }
  }, [query.data]);

  const dirty = !!query.data && (publicUrl.trim() !== query.data.publicUrl || requireTwoFactor !== query.data.requireTwoFactor);

  const save = useMutation({
    mutationFn: async () => {
      const res = await saveSecurityPolicy({ publicUrl: publicUrl.trim(), requireTwoFactor });
      if (res.error) throw new Error(res.error.message);
      return res.data;
    },
    onSuccess: () => {
      pushToast('Sign-in security saved.', 'success');
      void qc.invalidateQueries({ queryKey: ['security-policy'] });
      void qc.invalidateQueries({ queryKey: SECURITY_QUERY_KEY });
      resetFeaturesCache();
    },
    onError: (e) => pushToast(e instanceof Error ? e.message : 'Save failed', 'error'),
  });

  const onSave = async () => {
    if (requireTwoFactor && !query.data?.requireTwoFactor) {
      const n = query.data?.usersWithoutTwoFactor ?? 0;
      const ok = await confirmAction({
        title: 'Require two-factor authentication',
        message: `${n === 0 ? 'Every user' : n === 1 ? '1 user' : `${n} users`} without an authenticator app or passkey will be blocked at their next sign-in until they set one up. Continue?`,
        confirmLabel: 'Require 2FA',
        tone: 'primary',
      });
      if (!ok) return;
    }
    save.mutate();
  };

  const d = query.data;
  const effectiveIsHttps = d?.effectivePublicUrl.toLowerCase().startsWith('https:');

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 px-5 py-4">
      <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-1">Sign-in security</h3>
      <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">Firm-wide rules for how everyone signs in.</p>

      {query.error && <p className="text-xs text-red-600 dark:text-red-400">{(query.error as Error).message}</p>}

      <div className="space-y-4 max-w-md">
        <div>
          <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Public app URL</label>
          <input
            value={publicUrl}
            onChange={(e) => setPublicUrl(e.target.value)}
            placeholder="https://tb.yourfirm.com"
            className={inputCls}
            inputMode="url"
          />
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            Passkeys are bound to this address, and password-reset and invite links use it. Must be https.
            {d && (
              <span className="block mt-0.5">
                Currently effective: <code className="text-gray-700 dark:text-gray-300">{d.effectivePublicUrl}</code> ({SOURCE_LABEL[d.publicUrlSource]}).
              </span>
            )}
          </p>
          {d && !d.passkeysAvailable && (
            <p className="mt-1 text-xs text-amber-700 dark:text-amber-400">{d.passkeyBlockReason}</p>
          )}
          {d && d.passkeysAvailable && !effectiveIsHttps && (
            <p className="mt-1 text-xs text-amber-700 dark:text-amber-400">Passkeys work on localhost for development only; set an https address before real use.</p>
          )}
        </div>

        <label className="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-300 cursor-pointer">
          <input type="checkbox" checked={requireTwoFactor} onChange={(e) => setRequireTwoFactor(e.target.checked)} className="mt-0.5 rounded border-gray-300 text-blue-600" />
          <span>
            Require two-factor authentication for everyone
            <span className="block text-xs text-gray-500 dark:text-gray-400">
              Users without an authenticator app or passkey will be asked to set one up at their next sign-in.
              {d && d.usersWithoutTwoFactor > 0 && ` ${d.usersWithoutTwoFactor} active user${d.usersWithoutTwoFactor === 1 ? ' has' : 's have'} none yet.`}
            </span>
          </span>
        </label>

        <button
          type="button"
          onClick={() => void onSave()}
          disabled={!dirty || save.isPending}
          className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
        >
          {save.isPending ? 'Saving…' : 'Save'}
        </button>
      </div>
    </div>
  );
}
