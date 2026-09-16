// Copyright 2025-2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Use is limited to qualifying small businesses. See LICENSE for terms.

/** Self-service password change, extracted verbatim from the old Settings Account card. */

import { useState } from 'react';
import { changePassword } from '../../api/auth';
import { PasswordInput } from '../PasswordInput';

export function ChangePasswordForm() {
  const [pwCurrent, setPwCurrent] = useState('');
  const [pwNew, setPwNew] = useState('');
  const [pwConfirm, setPwConfirm] = useState('');
  const [pwSaving, setPwSaving] = useState(false);
  const [pwError, setPwError] = useState<string | null>(null);
  const [pwSaved, setPwSaved] = useState(false);

  const handleChangePassword = async () => {
    setPwError(null);
    if (pwNew !== pwConfirm) {
      setPwError('The two new-password fields do not match.');
      return;
    }
    if (pwNew === pwCurrent) {
      setPwError('New password must differ from the current one.');
      return;
    }
    setPwSaving(true);
    const res = await changePassword(pwCurrent, pwNew);
    setPwSaving(false);
    if (res.error) {
      setPwError(res.error.message);
      return;
    }
    setPwCurrent('');
    setPwNew('');
    setPwConfirm('');
    setPwSaved(true);
    setTimeout(() => setPwSaved(false), 3000);
  };

  return (
    <div>
      <h4 className="text-sm font-medium text-gray-800 dark:text-gray-200 mb-1">Password</h4>
      <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
        At least 8 characters with an uppercase letter, a lowercase letter, and a number.
      </p>
      <form
        onSubmit={(e) => { e.preventDefault(); void handleChangePassword(); }}
        className="space-y-3 max-w-sm"
      >
        <div>
          <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Current password</label>
          <PasswordInput
            value={pwCurrent}
            onChange={(e) => setPwCurrent(e.target.value)}
            autoComplete="current-password"
            required
          />
        </div>
        <div>
          <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">New password</label>
          <PasswordInput
            value={pwNew}
            onChange={(e) => setPwNew(e.target.value)}
            minLength={8}
            autoComplete="new-password"
            required
          />
        </div>
        <div>
          <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Confirm new password</label>
          <PasswordInput
            value={pwConfirm}
            onChange={(e) => setPwConfirm(e.target.value)}
            minLength={8}
            autoComplete="new-password"
            required
          />
        </div>
        <button
          type="submit"
          disabled={pwSaving || !pwCurrent || !pwNew || !pwConfirm}
          className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
        >
          {pwSaving ? 'Changing…' : 'Change Password'}
        </button>
      </form>
      {pwError && (
        <div className="mt-3 px-3 py-2 rounded text-xs bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400">{pwError}</div>
      )}
      {pwSaved && (
        <div className="mt-3 px-3 py-2 rounded text-xs bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400">Password changed.</div>
      )}
    </div>
  );
}
