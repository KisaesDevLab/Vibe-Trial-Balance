// Copyright 2025-2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Use is limited to qualifying small businesses. See LICENSE for terms.

/** Step-up for a destructive account-security action: re-enter the password. */

import { useState } from 'react';
import { Modal } from '../Modal';
import { PasswordInput } from '../PasswordInput';
import type { ApiResult } from '../../api/client';
import { messageForAuthError } from '../../utils/authErrors';

interface Props {
  title: string;
  message: string;
  confirmLabel: string;
  tone?: 'danger' | 'primary';
  onConfirm: (password: string) => Promise<ApiResult<unknown>>;
  onClose: () => void;
}

export function PasswordConfirmDialog({ title, message, confirmLabel, tone = 'danger', onConfirm, onClose }: Props) {
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setBusy(true);
    setError(null);
    const res = await onConfirm(password);
    setBusy(false);
    if (res.error) {
      setError(messageForAuthError(res.error.code, res.error.message));
      return;
    }
    onClose();
  };

  return (
    <Modal title={title} onClose={onClose}>
      <form onSubmit={(e) => { e.preventDefault(); void submit(); }} className="space-y-3">
        <p className="text-sm text-gray-600 dark:text-gray-400">{message}</p>
        {error && <div role="alert" className="px-3 py-2 rounded text-xs bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400">{error}</div>}
        <div>
          <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Current password</label>
          <PasswordInput value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" autoFocus required />
        </div>
        <div className="flex gap-2 justify-end">
          <button type="button" onClick={onClose} className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-50 dark:hover:bg-gray-700">Cancel</button>
          <button
            type="submit"
            disabled={busy || !password}
            className={`px-3 py-1.5 text-sm text-white rounded disabled:opacity-50 ${tone === 'danger' ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700'}`}
          >
            {busy ? 'Working…' : confirmLabel}
          </button>
        </div>
      </form>
    </Modal>
  );
}
