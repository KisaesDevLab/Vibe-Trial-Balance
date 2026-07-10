// Copyright 2025-2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Use is limited to qualifying small businesses. See LICENSE for terms.

import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { confirmPasswordReset, verifyPasswordResetToken } from '../api/auth';
import { PasswordInput } from '../components/PasswordInput';
import { pushToast } from '../store/uiStore';

type VerifyState = 'checking' | 'valid' | 'invalid';

export function PasswordResetConfirmPage() {
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const navigate = useNavigate();

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
      setInvalidReason('Missing reset token. Open the link from your email again.');
      return;
    }
    void verifyPasswordResetToken(token).then((res) => {
      if (cancelled) return;
      if (res.error) {
        setVerifyState('invalid');
        setInvalidReason(res.error.message);
        return;
      }
      if (res.data.valid) {
        setVerifyState('valid');
      } else {
        setVerifyState('invalid');
        const reason = res.data.reason;
        setInvalidReason(
          reason === 'expired'
            ? 'This reset link has expired. Request a new one to continue.'
            : reason === 'consumed'
              ? 'This reset link has already been used. Request a new one if you need to reset your password again.'
              : 'This reset link is no longer valid. Request a new one to continue.',
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
    pushToast('Password updated. Sign in with your new password.', 'success');
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
      <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-lg shadow-md p-8">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">Choose a new password</h1>
        <p className="text-sm text-gray-500 dark:text-gray-500 mb-6">
          At least 8 characters with one uppercase, one lowercase, and one number.
        </p>

        {verifyState === 'checking' && (
          <div className="text-sm text-gray-500 dark:text-gray-400">Checking your reset link…</div>
        )}

        {verifyState === 'invalid' && (
          <div className="space-y-4">
            <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 text-red-700 dark:text-red-400 px-4 py-3 rounded text-sm">
              {invalidReason}
            </div>
            <div className="flex justify-between">
              <Link
                to="/password-reset/request"
                className="text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
              >
                Request a new link
              </Link>
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
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">New password</label>
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
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Confirm new password</label>
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
              {loading ? 'Saving...' : 'Save new password'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
