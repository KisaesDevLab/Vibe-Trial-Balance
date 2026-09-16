// Copyright 2025-2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Use is limited to qualifying small businesses. See LICENSE for terms.

/**
 * Authenticator-app enrolment: prove the password → scan the QR (or type the
 * key) → enter one code. Used inside a Modal on Settings and inline on the
 * login page's forced-enrolment screen, which already holds the password and
 * passes it as `presetPassword` to skip the first step.
 */

import { useEffect, useState } from 'react';
import { PasswordInput } from '../PasswordInput';
import { OneTimeCodeInput } from './OneTimeCodeInput';
import { CopyButton } from './CopyButton';
import { confirmTotpEnrol, startTotpEnrol } from '../../api/security';
import { formatSecretForDisplay } from '../../utils/totpCode';
import { messageForAuthError } from '../../utils/authErrors';
import type { AuthUser } from '../../store/uiStore';

export interface EnrolResult {
  token: string | null;
  user: AuthUser;
}

interface Props {
  presetPassword?: string;
  onDone: (r: EnrolResult) => void;
  onCancel?: () => void;
}

type Step = 'password' | 'verify' | 'done';

export function TotpEnrolFlow({ presetPassword, onDone, onCancel }: Props) {
  const [step, setStep] = useState<Step>(presetPassword ? 'verify' : 'password');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [codeError, setCodeError] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [locked, setLocked] = useState(false);
  const [setup, setSetup] = useState<{ secretBase32: string; otpauthUrl: string; qrDataUrl: string } | null>(null);
  const [showKey, setShowKey] = useState(false);

  const start = async (pw: string) => {
    setBusy(true);
    setError(null);
    const res = await startTotpEnrol(pw);
    setBusy(false);
    if (res.error) {
      setError(messageForAuthError(res.error.code, res.error.message));
      setStep('password');
      return;
    }
    setSetup(res.data);
    setStep('verify');
  };

  // Login page hands us the password it already verified.
  useEffect(() => {
    if (presetPassword && !setup) void start(presetPassword);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const confirm = async (c: string) => {
    if (busy || locked) return;
    setBusy(true);
    setCodeError(null);
    const res = await confirmTotpEnrol(c);
    setBusy(false);
    if (res.error) {
      setCode('');
      setCodeError(messageForAuthError(res.error.code, res.error.message));
      if (res.error.code === 'RATE_LIMITED') setLocked(true);
      return;
    }
    setStep('done');
    onDone({ token: res.data.token, user: res.data.user });
  };

  if (step === 'password') {
    return (
      <form onSubmit={(e) => { e.preventDefault(); void start(password); }} className="space-y-3">
        <p className="text-sm text-gray-600 dark:text-gray-400">Confirm your password to set up an authenticator app.</p>
        {error && <div role="alert" className="px-3 py-2 rounded text-xs bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400">{error}</div>}
        <div>
          <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Current password</label>
          <PasswordInput value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" autoFocus required />
        </div>
        <div className="flex gap-2 justify-end">
          {onCancel && <button type="button" onClick={onCancel} className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-50 dark:hover:bg-gray-700">Cancel</button>}
          <button type="submit" disabled={busy || !password} className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50">{busy ? 'Starting…' : 'Continue'}</button>
        </div>
      </form>
    );
  }

  if (step === 'done') {
    return <p className="text-sm text-green-700 dark:text-green-400">Authenticator app added.</p>;
  }

  if (!setup) {
    return <p className="text-sm text-gray-500 dark:text-gray-400">{error ?? 'Preparing…'}</p>;
  }

  return (
    <div className="space-y-4">
      <ol className="text-sm text-gray-600 dark:text-gray-400 list-decimal pl-5 space-y-1">
        <li>Open Google Authenticator, Microsoft Authenticator, 1Password, Authy or any authenticator app.</li>
        <li>Scan this code, or add the key by hand.</li>
        <li>Enter the 6-digit code the app shows.</li>
      </ol>
      <div className="flex flex-col sm:flex-row gap-4 items-start">
        <img
          src={setup.qrDataUrl}
          alt="QR code to scan with your authenticator app"
          className="w-44 h-44 rounded bg-white p-2 border border-gray-200 dark:border-gray-600 shrink-0"
        />
        <div className="text-xs text-gray-600 dark:text-gray-400 space-y-2">
          <button type="button" onClick={() => setShowKey((v) => !v)} className="text-blue-600 dark:text-blue-400 hover:underline">
            {showKey ? 'Hide the key' : "Can't scan? Enter this key instead"}
          </button>
          {showKey && (
            <div className="space-y-1.5">
              <code className="block font-mono text-sm tracking-wider text-gray-800 dark:text-gray-200 break-all">{formatSecretForDisplay(setup.secretBase32)}</code>
              <div className="flex gap-2 items-center">
                <CopyButton text={setup.secretBase32} label="Copy key" />
                <a href={setup.otpauthUrl} className="text-blue-600 dark:text-blue-400 hover:underline">Open in authenticator app</a>
              </div>
              <p>Time-based, 6 digits, 30 seconds.</p>
            </div>
          )}
        </div>
      </div>
      <OneTimeCodeInput value={code} onChange={setCode} onComplete={(c) => void confirm(c)} disabled={busy || locked} error={codeError} autoFocus label="Code from the app" />
      <div className="flex gap-2 justify-end">
        {onCancel && <button type="button" onClick={onCancel} className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-50 dark:hover:bg-gray-700">Cancel</button>}
        <button type="button" onClick={() => void confirm(code)} disabled={busy || locked || code.length !== 6} className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50">{busy ? 'Verifying…' : 'Verify and turn on'}</button>
      </div>
    </div>
  );
}
