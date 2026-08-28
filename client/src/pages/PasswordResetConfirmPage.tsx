// Copyright 2025-2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Use is limited to qualifying small businesses. See LICENSE for terms.

import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { confirmPasswordReset, verifyPasswordResetToken } from '../api/auth';
import { PasswordInput } from '../components/PasswordInput';
import { pushToast } from '../store/uiStore';

type VerifyState = 'checking' | 'valid' | 'invalid';

// The same token endpoints back both flows; only the wording differs. An
// invite is defaulted from the route so the heading is right on first paint,
// then confirmed by the token's own purpose.
const COPY = {
  reset: {
    heading: 'Choose a new password',
    checking: 'Checking your reset link…',
    submit: 'Save new password',
    done: 'Password updated. Sign in with your new password.',
  },
  invite: {
    heading: 'Set your password',
    checking: 'Checking your invitation…',
    submit: 'Set password',
    done: 'Password set. Sign in to get started.',
  },
} as const;

export function PasswordResetConfirmPage() {
  const [params] = useSearchParams();
  const location = useLocation();
  const token = params.get('token') ?? '';
  const navigate = useNavigate();

  const [purpose, setPurpose] = useState<'reset' | 'invite'>(
    location.pathname.startsWith('/invite') ? 'invite' : 'reset',
  );
  const copy = COPY[purpose];
  const [verifyState, setVerifyState] = useState<VerifyState>('checking');
  const [invalidReason, setInvalidReason] = useState<string>('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!token) {
      setVerifyState('invalid');
      setInvalidReason('Missing token. Open the link from your email again.');
      return;
    }
    void verifyPasswordResetToken(token).then((res) => {
      if (cancelled) return;
      if (res.error) {
        setVerifyState('invalid');
        setInvalidReason(res.error.message);
        return;
      }
      const tokenPurpose = res.data.purpose ?? 'reset';
      setPurpose(tokenPurpose);
      if (res.data.valid) {
        setVerifyState('valid');
      } else {
        setVerifyState('invalid');
        const reason = res.data.reason;
        const noun = tokenPurpose === 'invite' ? 'invitation' : 'reset link';
        const remedy = tokenPurpose === 'invite'
          ? 'Ask an administrator to resend it.'
          : 'Request a new one to continue.';
        setInvalidReason(
          reason === 'expired'
            ? `This ${noun} has expired. ${remedy}`
            : reason === 'consumed'
              ? `This ${noun} has already been used. ${tokenPurpose === 'invite' ? 'Sign in, or reset your password if you have forgotten it.' : remedy}`
              : `This ${noun} is no longer valid. ${remedy}`,
        );
      }
    });
    return () => {
      cancelled = true;
    };
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (newPassword !== confirmPw) {
      setError('The two new-password fields do not match.');
      return;
    }
    setLoading(true);
    const result = await confirmPasswordReset(token, newPassword);
    setLoading(false);
    if (result.error) {
      setError(result.error.message);
      return;
    }
    pushToast(COPY[result.data?.purpose ?? purpose].done, 'success');
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
      <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-lg shadow-md p-8">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">{copy.heading}</h1>
        <p className="text-sm text-gray-500 dark:text-gray-500 mb-6">
          At least 8 characters with one uppercase, one lowercase, and one number.
        </p>

        {verifyState === 'checking' && (
          <div className="text-sm text-gray-500 dark:text-gray-400">{copy.checking}</div>
        )}

        {verifyState === 'invalid' && (
          <div className="space-y-4">
            <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 text-red-700 dark:text-red-400 px-4 py-3 rounded text-sm">
              {invalidReason}
            </div>
            <div className="flex justify-between">
              {purpose === 'invite' ? <span /> : (
                <Link
                  to="/password-reset/request"
                  className="text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
                >
                  Request a new link
                </Link>
              )}
              <Link
                to="/login"
                className="text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
              >
                Back to sign in
              </Link>
            </div>
          </div>
        )}

        {verifyState === 'valid' && (
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 text-red-700 dark:text-red-400 px-4 py-3 rounded text-sm">
                {error}
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{purpose === 'invite' ? 'Password' : 'New password'}</label>
              <PasswordInput
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                minLength={8}
                autoFocus
                autoComplete="new-password"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{purpose === 'invite' ? 'Confirm password' : 'Confirm new password'}</label>
              <PasswordInput
                value={confirmPw}
                onChange={(e) => setConfirmPw(e.target.value)}
                minLength={8}
                autoComplete="new-password"
                required
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 text-white py-2 px-4 rounded-md text-sm font-medium hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? 'Saving...' : copy.submit}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
