// Copyright 2025-2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Use is limited to qualifying small businesses. See LICENSE for terms.

/**
 * Settings → Account & security (every user): password, authenticator app,
 * passkeys, remembered browsers. One query feeds the three security sections.
 */

import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '../../store/uiStore';
import { SECURITY_QUERY_KEY, getTwoFactorStatus } from '../../api/security';
import { ChangePasswordForm } from './ChangePasswordForm';
import { TwoFactorSection } from './TwoFactorSection';
import { PasskeysSection } from './PasskeysSection';
import { TrustedBrowsersSection } from './TrustedBrowsersSection';

export function AccountSecurityCard() {
  const user = useAuthStore((s) => s.user);
  const status = useQuery({
    queryKey: SECURITY_QUERY_KEY,
    queryFn: async () => {
      const res = await getTwoFactorStatus();
      if (res.error) throw new Error(res.error.message);
      return res.data;
    },
  });

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 px-5 py-4">
      <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-1">Account &amp; security</h3>
      <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
        Signed in as <span className="font-medium text-gray-700 dark:text-gray-300">{user?.displayName ?? user?.username}</span> ({user?.username}).
      </p>
      <div className="space-y-5 divide-y divide-gray-100 dark:divide-gray-700 [&>*+*]:pt-5">
        <ChangePasswordForm />
        {status.data ? (
          <>
            <TwoFactorSection status={status.data} />
            <PasskeysSection status={status.data} />
            <TrustedBrowsersSection status={status.data} />
          </>
        ) : status.error ? (
          <p className="text-xs text-red-600 dark:text-red-400">Could not load sign-in security: {(status.error as Error).message}</p>
        ) : (
          <p className="text-xs text-gray-400 dark:text-gray-500">Loading sign-in security…</p>
        )}
      </div>
    </div>
  );
}
