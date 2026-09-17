// Copyright 2025-2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Use is limited to qualifying small businesses. See LICENSE for terms.

/**
 * Settings → Authentication (admin only): single sign-on mode, identity
 * provider connection, role mapping and the break-glass status. The form is
 * the shared @kisaesdevlab/vibe-auth component; this page supplies the session
 * (the package speaks to GET/PUT /auth/settings with same-origin cookies, and
 * Trial Balance sessions are bearer tokens) and the Tailwind classes.
 */

import { useMemo } from 'react';
import { AuthSettingsPage } from '@kisaesdevlab/vibe-auth/react';
import { useAuthStore } from '../store/uiStore';
import { ROUTER_BASENAME } from '../lib/baseConfig';

const inputCls =
  'w-full border border-gray-300 dark:border-gray-600 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white';
const btnCls =
  'border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 px-3 py-1.5 rounded text-sm hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed';

export function AuthenticationSettingsPage() {
  const { user, token } = useAuthStore();
  const isAdmin = user?.role === 'admin';

  // The package's fetch calls carry no Authorization header of their own.
  const authedFetch = useMemo<typeof fetch>(
    () => (input, init) =>
      fetch(input, {
        ...init,
        headers: {
          ...((init?.headers as Record<string, string> | undefined) ?? {}),
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      }),
    [token],
  );

  if (!isAdmin) {
    return <p className="text-sm text-gray-500 dark:text-gray-400">Admin access required.</p>;
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Authentication</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Single sign-on through the firm's identity provider. Passwords keep working until the mode is set to SSO only;
          the break-glass account is provisioned from the server with <code className="text-xs">npx vibe-auth breakglass ensure</code>.
        </p>
      </div>
      <AuthSettingsPage
        basePath={ROUTER_BASENAME}
        productName="Trial Balance"
        fetch={authedFetch}
        classNames={{
          root: 'grid gap-6 max-w-3xl text-gray-900 dark:text-gray-100',
          section: 'grid gap-3 p-4 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800',
          label: 'grid gap-1 text-sm text-gray-700 dark:text-gray-300',
          input: inputCls,
          button: btnCls,
          buttonPrimary: 'bg-blue-600 text-white px-3 py-1.5 rounded text-sm hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed',
          buttonDanger: 'bg-red-600 text-white px-3 py-1.5 rounded text-sm hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed',
          table: 'w-full text-sm',
          note: 'text-xs text-gray-500 dark:text-gray-400',
          error: 'text-sm text-red-600 dark:text-red-400',
        }}
      />
    </div>
  );
}
