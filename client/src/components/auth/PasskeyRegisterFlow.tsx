// Copyright 2025-2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Use is limited to qualifying small businesses. See LICENSE for terms.

/**
 * Add a passkey: prove the password, name it, run the browser ceremony. Used
 * in a Modal on Settings and inline on the login page's forced-enrolment
 * screen (`presetPassword` skips the password field).
 *
 * The name is asked BEFORE the ceremony so the options → create() → verify
 * calls run back-to-back inside the challenge's 5-minute window.
 */

import { useState } from 'react';
import { startRegistration } from '@simplewebauthn/browser';
import { PasswordInput } from '../PasswordInput';
import { getPasskeyRegisterOptions, verifyPasskeyRegister } from '../../api/security';
import { describeUserAgent } from '../../utils/userAgentLabel';
import { describeWebAuthnError, webauthnAvailability } from '../../utils/webauthn';
import { messageForAuthError } from '../../utils/authErrors';
import type { EnrolResult } from './TotpEnrolFlow';

interface Props {
  presetPassword?: string;
  passkeysAvailable: boolean;
  passkeyBlockReason?: string | null;
  /** Shown to admins under the server's reason. */
  adminHint?: boolean;
  onDone: (r: EnrolResult) => void;
  onCancel?: () => void;
}

const inputCls =
  'w-full border border-gray-300 dark:border-gray-600 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white';

export function PasskeyRegisterFlow({ presetPassword, passkeysAvailable, passkeyBlockReason, adminHint, onDone, onCancel }: Props) {
  const browser = webauthnAvailability({
    hasPublicKeyCredential: typeof window !== 'undefined' && typeof window.PublicKeyCredential !== 'undefined',
    isSecureContext: typeof window !== 'undefined' && window.isSecureContext,
  });
  const [password, setPassword] = useState('');
  const [name, setName] = useState(() => describeUserAgent(typeof navigator !== 'undefined' ? navigator.userAgent : ''));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const blocked = !passkeysAvailable ? passkeyBlockReason ?? 'Passkeys are not available on this server yet.' : !browser.supported ? browser.reason ?? null : null;

  const run = async () => {
    setBusy(true);
    setError(null);
    setNote(null);
    const pw = presetPassword ?? password;
    const opts = await getPasskeyRegisterOptions(pw);
    if (opts.error) {
      setBusy(false);
      setError(messageForAuthError(opts.error.code, opts.error.message));
      return;
    }
    let response;
    try {
      response = await startRegistration({ optionsJSON: opts.data.options });
    } catch (err) {
      setBusy(false);
      const info = describeWebAuthnError(err);
      if (info.cancelled) setNote('No passkey was created.');
      else setError(info.message);
      return;
    }
    const verified = await verifyPasskeyRegister(opts.data.challengeId, response, name.trim() || describeUserAgent(navigator.userAgent));
    setBusy(false);
    if (verified.error) {
      setError(messageForAuthError(verified.error.code, verified.error.message));
      return;
    }
    setDone(true);
    onDone({ token: verified.data.token, user: verified.data.user });
  };

  if (blocked) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-gray-600 dark:text-gray-400">{blocked}</p>
        {adminHint && !passkeysAvailable && (
          <p className="text-xs text-gray-500 dark:text-gray-400">Set the public app URL under Settings → Sign-in security.</p>
        )}
        {onCancel && <div className="flex justify-end"><button type="button" onClick={onCancel} className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-50 dark:hover:bg-gray-700">Close</button></div>}
      </div>
    );
  }

  if (done) return <p className="text-sm text-green-700 dark:text-green-400">Passkey added.</p>;

  return (
    <form onSubmit={(e) => { e.preventDefault(); void run(); }} className="space-y-3">
      <p className="text-sm text-gray-600 dark:text-gray-400">
        A passkey signs you in with your fingerprint, face or device PIN — no password, no code. Your browser will ask where to save it.
      </p>
      {error && <div role="alert" className="px-3 py-2 rounded text-xs bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400">{error}</div>}
      {note && <p className="text-xs text-gray-500 dark:text-gray-400">{note}</p>}
      {!presetPassword && (
        <div>
          <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Current password</label>
          <PasswordInput value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" autoFocus required />
        </div>
      )}
      <div>
        <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Name this passkey</label>
        <input value={name} onChange={(e) => setName(e.target.value)} maxLength={64} className={inputCls} autoFocus={!!presetPassword} />
        <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">So you can tell your devices apart later.</p>
      </div>
      <div className="flex gap-2 justify-end">
        {onCancel && <button type="button" onClick={onCancel} className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-50 dark:hover:bg-gray-700">Cancel</button>}
        <button type="submit" disabled={busy || (!presetPassword && !password)} aria-busy={busy} className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50">
          {busy ? 'Waiting for your device…' : 'Create passkey'}
        </button>
      </div>
    </form>
  );
}
