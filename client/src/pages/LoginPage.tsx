// Copyright 2025-2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Use is limited to qualifying small businesses. See LICENSE for terms.

/**
 * Sign-in as a state machine (utils/loginFlow.ts):
 *   credentials → mfa → rotate → enrol → done
 *
 * The 5-minute MFA token lives ONLY in this component's state and is passed
 * explicitly to the verify calls: it never reaches useAuthStore, so
 * ProtectedRoute cannot let a half-authenticated user in, and a reload simply
 * starts over. The rotate / enrol stages are real (restricted) sessions and
 * DO live in the store, flagged by mustChangePassword / mustEnrolTwoFactor,
 * which is what lets a reload resume the right screen.
 */

import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { startAuthentication } from '@simplewebauthn/browser';
import {
  changePassword,
  getMfaPasskeyOptions,
  getPasskeyLoginOptions,
  login,
  verifyMfaPasskey,
  verifyMfaTotp,
  verifyPasskeyLogin,
} from '../api/auth';
import { useAuthStore, type AuthUser } from '../store/uiStore';
import { PasswordInput } from '../components/PasswordInput';
import { OneTimeCodeInput } from '../components/auth/OneTimeCodeInput';
import { TotpEnrolFlow, type EnrolResult } from '../components/auth/TotpEnrolFlow';
import { PasskeyRegisterFlow } from '../components/auth/PasskeyRegisterFlow';
import { useFeatures } from '../hooks/useFeatures';
import { initialStageFromStore, stageAfterLogin, stageAfterRotate, userForStore, type LoginUiStage, type MfaMethod } from '../utils/loginFlow';
import { isMfaTerminal, messageForAuthError } from '../utils/authErrors';
import { describeWebAuthnError, webauthnAvailability } from '../utils/webauthn';

const btnPrimary =
  'w-full bg-blue-600 text-white py-2 px-4 rounded-md text-sm font-medium hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors';
const btnOutline =
  'w-full border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 py-2 px-4 rounded-md text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors';
const linkCls = 'text-xs text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300';

const KeyIcon = (
  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="7.5" cy="15.5" r="5.5" />
    <path d="m21 2-9.6 9.6" />
    <path d="m15.5 7.5 3 3L22 7l-3-3" />
  </svg>
);

export function LoginPage() {
  const setAuth = useAuthStore((s) => s.setAuth);
  const updateUser = useAuthStore((s) => s.updateUser);
  const clearAuth = useAuthStore((s) => s.clearAuth);
  const storedToken = useAuthStore((s) => s.token);
  const storedUser = useAuthStore((s) => s.user);
  const navigate = useNavigate();
  const features = useFeatures();

  const [stage, setStage] = useState<LoginUiStage>(() => initialStageFromStore(storedToken, storedUser));
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [code, setCode] = useState('');
  const [rememberBrowser, setRememberBrowser] = useState(false);
  const [mfaToken, setMfaToken] = useState<string | null>(null);
  const [mfaMethods, setMfaMethods] = useState<MfaMethod[]>([]);
  const [enrolMethod, setEnrolMethod] = useState<'totp' | 'passkey' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [codeError, setCodeError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [passkeyBusy, setPasskeyBusy] = useState(false);
  const [locked, setLocked] = useState(false);

  const browser = webauthnAvailability({
    hasPublicKeyCredential: typeof window.PublicKeyCredential !== 'undefined',
    isSecureContext: window.isSecureContext,
  });
  const passkeysOn = !!features?.passkeys;

  /** A full session arrived (password-only, after a code, or by passkey): store it and move on. */
  const finishSignIn = (data: { stage: 'ok' | 'mfa' | 'enrol'; token: string; user: AuthUser }) => {
    const next = stageAfterLogin({ stage: data.stage, user: data.user });
    setAuth(data.token, userForStore(data.stage, data.user));
    setMfaToken(null);
    setCode('');
    if (next === 'done') navigate('/');
    else setStage(next);
  };

  // ── credentials ─────────────────────────────────────────────────────────
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setNote(null);
    setLoading(true);
    const result = await login(username, password);
    setLoading(false);
    if (result.error) {
      setError(messageForAuthError(result.error.code, result.error.message));
      return;
    }
    if (result.data.stage === 'mfa') {
      setMfaToken(result.data.token);
      setMfaMethods(result.data.methods);
      setCodeError(null);
      setStage('mfa');
      return;
    }
    finishSignIn(result.data);
  };

  const handlePasskeyLogin = async () => {
    setError(null);
    setNote(null);
    setPasskeyBusy(true);
    const opts = await getPasskeyLoginOptions();
    if (opts.error) {
      setPasskeyBusy(false);
      setError(messageForAuthError(opts.error.code, opts.error.message));
      return;
    }
    let response;
    try {
      response = await startAuthentication({ optionsJSON: opts.data.options });
    } catch (err) {
      setPasskeyBusy(false);
      const info = describeWebAuthnError(err);
      if (info.cancelled) setNote(info.message);
      else setError(info.message);
      return;
    }
    const result = await verifyPasskeyLogin(opts.data.challengeId, response);
    setPasskeyBusy(false);
    if (result.error) {
      setError(messageForAuthError(result.error.code, result.error.message));
      return;
    }
    finishSignIn(result.data);
  };

  // ── mfa ─────────────────────────────────────────────────────────────────
  const backToCredentials = (message?: string) => {
    setMfaToken(null);
    setMfaMethods([]);
    setCode('');
    setCodeError(null);
    setPassword('');
    setLocked(false);
    setError(message ?? null);
    setStage('credentials');
  };

  const handleMfaCode = async (c: string) => {
    if (!mfaToken || loading || locked) return;
    setLoading(true);
    setCodeError(null);
    const result = await verifyMfaTotp(mfaToken, c, rememberBrowser);
    setLoading(false);
    if (result.error) {
      if (isMfaTerminal(result.error.code)) { backToCredentials(messageForAuthError(result.error.code, result.error.message, { onMfaStep: true })); return; }
      setCode('');
      setCodeError(messageForAuthError(result.error.code, result.error.message));
      if (result.error.code === 'RATE_LIMITED') setLocked(true);
      return;
    }
    finishSignIn({ stage: 'ok', token: result.data.token, user: result.data.user });
  };

  const handleMfaPasskey = async () => {
    if (!mfaToken) return;
    setPasskeyBusy(true);
    setCodeError(null);
    setNote(null);
    const opts = await getMfaPasskeyOptions(mfaToken);
    if (opts.error) {
      setPasskeyBusy(false);
      if (isMfaTerminal(opts.error.code)) { backToCredentials(messageForAuthError(opts.error.code, opts.error.message, { onMfaStep: true })); return; }
      setCodeError(messageForAuthError(opts.error.code, opts.error.message));
      return;
    }
    let response;
    try {
      response = await startAuthentication({ optionsJSON: opts.data.options });
    } catch (err) {
      setPasskeyBusy(false);
      const info = describeWebAuthnError(err);
      if (info.cancelled) setNote(info.message);
      else setCodeError(info.message);
      return;
    }
    const result = await verifyMfaPasskey(mfaToken, opts.data.challengeId, response, rememberBrowser);
    setPasskeyBusy(false);
    if (result.error) {
      if (isMfaTerminal(result.error.code)) { backToCredentials(messageForAuthError(result.error.code, result.error.message, { onMfaStep: true })); return; }
      setCodeError(messageForAuthError(result.error.code, result.error.message));
      return;
    }
    finishSignIn({ stage: 'ok', token: result.data.token, user: result.data.user });
  };

  // ── rotate ──────────────────────────────────────────────────────────────
  const handleRotate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (newPassword.length < 8) {
      setError('New password must be at least 8 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('The two new-password fields do not match.');
      return;
    }
    if (newPassword === password) {
      setError('New password must differ from the current one.');
      return;
    }
    setLoading(true);
    const result = await changePassword(password, newPassword);
    setLoading(false);
    if (result.error) {
      setError(result.error.message);
      return;
    }
    updateUser({ mustChangePassword: false });
    // The new password is what enrolment will step-up against.
    setPassword(newPassword);
    const next = stageAfterRotate(useAuthStore.getState().user ?? {});
    if (next === 'done') navigate('/');
    else setStage(next);
  };

  // ── enrol ───────────────────────────────────────────────────────────────
  const handleEnrolled = (r: EnrolResult) => {
    if (r.token) setAuth(r.token, { ...r.user, mustEnrolTwoFactor: false });
    else updateUser({ mustEnrolTwoFactor: false, twoFactor: r.user.twoFactor });
    navigate('/');
  };

  if (stage === 'done') return <Navigate to="/" replace />;

  const shell = (title: string, subtitle: React.ReactNode, body: React.ReactNode) => (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
      <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-lg shadow-md p-8">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">{title}</h1>
        <p className="text-sm text-gray-500 dark:text-gray-500 mb-6">{subtitle}</p>
        <div key={stage}>{body}</div>
      </div>
    </div>
  );

  const errorBanner = error && (
    <div role="alert" className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 text-red-700 dark:text-red-400 px-4 py-3 rounded text-sm">
      {error}
    </div>
  );

  // ── rotate screen (unchanged) ───────────────────────────────────────────
  if (stage === 'rotate') {
    return shell(
      'Set a new password',
      'This account is using a temporary password. Pick something only you know before continuing.',
      <form onSubmit={handleRotate} className="space-y-4">
        {errorBanner}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">New password</label>
          <PasswordInput value={newPassword} onChange={(e) => setNewPassword(e.target.value)} minLength={8} autoFocus autoComplete="new-password" required />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Confirm new password</label>
          <PasswordInput value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} minLength={8} autoComplete="new-password" required />
        </div>
        {!password && (
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Current password</label>
            <PasswordInput value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required />
          </div>
        )}
        <button type="submit" disabled={loading} className={btnPrimary}>{loading ? 'Saving...' : 'Save and continue'}</button>
      </form>,
    );
  }

  // ── enrol screen ────────────────────────────────────────────────────────
  if (stage === 'enrol') {
    const chooser = (
      <div className="space-y-3">
        <button type="button" onClick={() => setEnrolMethod('totp')} className="w-full text-left border border-gray-200 dark:border-gray-700 rounded-md p-4 hover:border-blue-400 dark:hover:border-blue-500">
          <span className="block text-sm font-medium text-gray-900 dark:text-white">Authenticator app</span>
          <span className="block text-xs text-gray-500 dark:text-gray-400 mt-0.5">A 6-digit code from Google Authenticator, 1Password, Authy or similar.</span>
        </button>
        {passkeysOn && (
          <button
            type="button"
            onClick={() => setEnrolMethod('passkey')}
            disabled={!browser.supported}
            title={browser.supported ? undefined : browser.reason}
            className="w-full text-left border border-gray-200 dark:border-gray-700 rounded-md p-4 hover:border-blue-400 dark:hover:border-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <span className="block text-sm font-medium text-gray-900 dark:text-white">Passkey</span>
            <span className="block text-xs text-gray-500 dark:text-gray-400 mt-0.5">Your fingerprint, face or device PIN. {browser.supported ? '' : browser.reason}</span>
          </button>
        )}
        <div className="text-center pt-1">
          <button type="button" onClick={() => { clearAuth(); backToCredentials(); }} className={linkCls}>Sign out</button>
        </div>
      </div>
    );
    return shell(
      'Set up two-factor authentication',
      'Your firm requires a second factor. Choose one to continue.',
      enrolMethod === null ? chooser : (
        <div className="space-y-4">
          {enrolMethod === 'totp' ? (
            <TotpEnrolFlow presetPassword={password || undefined} onDone={handleEnrolled} onCancel={() => setEnrolMethod(null)} />
          ) : (
            <PasskeyRegisterFlow presetPassword={password || undefined} passkeysAvailable={passkeysOn} onDone={handleEnrolled} onCancel={() => setEnrolMethod(null)} />
          )}
        </div>
      ),
    );
  }

  // ── mfa screen ──────────────────────────────────────────────────────────
  if (stage === 'mfa') {
    const hasTotp = mfaMethods.includes('totp');
    const hasPasskey = mfaMethods.includes('passkey');
    return shell(
      'Verify it\'s you',
      <>Signing in as <span className="font-medium text-gray-700 dark:text-gray-300">{username}</span>.</>,
      <div className="space-y-4">
        {hasTotp && (
          <form onSubmit={(e) => { e.preventDefault(); void handleMfaCode(code); }} className="space-y-4">
            <OneTimeCodeInput value={code} onChange={setCode} onComplete={(c) => void handleMfaCode(c)} disabled={loading || locked} error={codeError} autoFocus label="Enter the code from your authenticator app" />
            <button type="submit" disabled={loading || locked || code.length !== 6} className={btnPrimary}>{loading ? 'Verifying...' : 'Verify'}</button>
          </form>
        )}
        {hasPasskey && (
          <div className="space-y-2">
            {hasTotp && <div className="relative text-center text-xs text-gray-400"><span className="bg-white dark:bg-gray-800 px-2 relative z-10">or</span><div className="absolute inset-x-0 top-1/2 border-t border-gray-200 dark:border-gray-700" /></div>}
            {!hasTotp && codeError && <div role="alert" className="text-xs text-red-600 dark:text-red-400">{codeError}</div>}
            <button type="button" onClick={() => void handleMfaPasskey()} disabled={passkeyBusy || !browser.supported} aria-busy={passkeyBusy} title={browser.supported ? undefined : browser.reason} className={`${btnOutline} inline-flex items-center justify-center gap-2`}>
              {KeyIcon}{passkeyBusy ? 'Waiting for your device…' : 'Use your passkey'}
            </button>
          </div>
        )}
        {note && <p className="text-xs text-gray-500 dark:text-gray-400">{note}</p>}
        <label className="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-300 cursor-pointer">
          <input type="checkbox" checked={rememberBrowser} onChange={(e) => setRememberBrowser(e.target.checked)} className="mt-0.5 rounded border-gray-300 text-blue-600" />
          <span>
            Remember this browser for 30 days
            <span className="block text-xs text-gray-500 dark:text-gray-400">You won't be asked again on this browser. Don't tick this on a shared computer.</span>
          </span>
        </label>
        <div className="text-center">
          <button type="button" onClick={() => backToCredentials()} className={linkCls}>Use a different account</button>
        </div>
      </div>,
    );
  }

  // ── credentials screen ──────────────────────────────────────────────────
  return shell(
    'Vibe TB',
    'Sign in to continue',
    <form onSubmit={handleLogin} className="space-y-4">
      {errorBanner}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Username</label>
        <input
          type="text"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          className="w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white dark:placeholder-gray-400"
          required
          autoFocus
          autoComplete="username"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Password</label>
        <PasswordInput value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="current-password" />
      </div>
      <button type="submit" disabled={loading || passkeyBusy} className={btnPrimary}>{loading ? 'Signing in...' : 'Sign in'}</button>

      {passkeysOn && (
        <>
          <div className="relative text-center text-xs text-gray-400"><span className="bg-white dark:bg-gray-800 px-2 relative z-10">or</span><div className="absolute inset-x-0 top-1/2 border-t border-gray-200 dark:border-gray-700" /></div>
          <button
            type="button"
            onClick={() => void handlePasskeyLogin()}
            disabled={passkeyBusy || loading || !browser.supported}
            aria-busy={passkeyBusy}
            title={browser.supported ? undefined : browser.reason}
            className={`${btnOutline} inline-flex items-center justify-center gap-2`}
          >
            {KeyIcon}{passkeyBusy ? 'Waiting for your device…' : 'Sign in with a passkey'}
          </button>
          {!browser.supported && <p className="text-xs text-gray-500 dark:text-gray-400 text-center">{browser.reason}</p>}
          {note && <p className="text-xs text-gray-500 dark:text-gray-400 text-center">{note}</p>}
        </>
      )}

      {features?.passwordResetEnabled && (
        <div className="text-center pt-1">
          <Link to="/password-reset/request" className={linkCls}>Forgot password?</Link>
        </div>
      )}
    </form>,
  );
}
