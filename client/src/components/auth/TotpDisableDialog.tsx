// Copyright 2025-2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Use is limited to qualifying small businesses. See LICENSE for terms.

/** Turn off the authenticator app: password + a current code, explicit button (no auto-submit). */

import { useState } from 'react';
import { Modal } from '../Modal';
import { PasswordInput } from '../PasswordInput';
import { OneTimeCodeInput } from './OneTimeCodeInput';
import { disableTotp } from '../../api/security';
import { messageForAuthError } from '../../utils/authErrors';

export function TotpDisableDialog({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setBusy(true);
    setError(null);
    const res = await disableTotp(password, code);
    setBusy(false);
    if (res.error) {
      setError(messageForAuthError(res.error.code, res.error.message));
      if (res.error.code === 'INVALID_CODE') setCode('');
      return;
    }
    onDone();
    onClose();
  };

  return (
    <Modal title="Turn off authenticator app" onClose={onClose}>
      <form onSubmit={(e) => { e.preventDefault(); void submit(); }} className="space-y-3">
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Signing in will no longer ask for a code, and every remembered browser is forgotten. Confirm with your password and a current code.
        </p>
        {error && <div role="alert" className="px-3 py-2 rounded text-xs bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400">{error}</div>}
        <div>
          <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Current password</label>
          <PasswordInput value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" autoFocus required />
        </div>
        <OneTimeCodeInput value={code} onChange={setCode} label="Code from the app" />
        <div className="flex gap-2 justify-end">
          <button type="button" onClick={onClose} className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-50 dark:hover:bg-gray-700">Cancel</button>
          <button type="submit" disabled={busy || !password || code.length !== 6} className="px-3 py-1.5 text-sm bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50">
            {busy ? 'Turning off…' : 'Turn off'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
