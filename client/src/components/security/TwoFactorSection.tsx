// Copyright 2025-2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Use is limited to qualifying small businesses. See LICENSE for terms.

import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Modal } from '../Modal';
import { TotpEnrolFlow } from '../auth/TotpEnrolFlow';
import { TotpDisableDialog } from '../auth/TotpDisableDialog';
import { SECURITY_QUERY_KEY, type TwoFactorStatus } from '../../api/security';
import { pushToast, useAuthStore } from '../../store/uiStore';

export function TwoFactorSection({ status }: { status: TwoFactorStatus }) {
  const qc = useQueryClient();
  const updateUser = useAuthStore((s) => s.updateUser);
  const [enrolling, setEnrolling] = useState(false);
  const [disabling, setDisabling] = useState(false);
  const refresh = () => qc.invalidateQueries({ queryKey: SECURITY_QUERY_KEY });

  const lastMethod = status.requireTwoFactor && status.passkeys.length === 0;

  return (
    <div>
      <div className="flex items-center gap-2 mb-1">
        <h4 className="text-sm font-medium text-gray-800 dark:text-gray-200">Two-factor authentication</h4>
        {status.totpEnabled ? (
          <span className="inline-flex px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400">
            On{status.totpEnabledAt ? ` since ${new Date(status.totpEnabledAt).toLocaleDateString()}` : ''}
          </span>
        ) : (
          <span className="inline-flex px-2 py-0.5 rounded text-xs font-medium bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-300">Off</span>
        )}
      </div>
      <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
        An authenticator app on your phone adds a 6-digit code to every password sign-in.
        {status.requireTwoFactor && <span className="block mt-1 text-blue-700 dark:text-blue-400">Your firm requires two-factor authentication; keep at least one method.</span>}
      </p>
      {status.totpEnabled ? (
        <button
          type="button"
          onClick={() => setDisabling(true)}
          disabled={lastMethod}
          title={lastMethod ? 'Add a passkey first — your firm requires a second factor.' : undefined}
          className="px-3 py-1.5 text-sm border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 rounded hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Turn off
        </button>
      ) : (
        <button type="button" onClick={() => setEnrolling(true)} className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700">
          Enable authenticator app
        </button>
      )}

      {enrolling && (
        <Modal title="Set up an authenticator app" onClose={() => setEnrolling(false)} size="lg">
          <TotpEnrolFlow
            onCancel={() => setEnrolling(false)}
            onDone={({ user }) => {
              setEnrolling(false);
              updateUser({ mustEnrolTwoFactor: false, twoFactor: user.twoFactor });
              pushToast('Authenticator app added.', 'success');
              void refresh();
            }}
          />
        </Modal>
      )}
      {disabling && (
        <TotpDisableDialog
          onClose={() => setDisabling(false)}
          onDone={() => { pushToast('Authenticator app turned off.', 'success'); void refresh(); }}
        />
      )}
    </div>
  );
}
