// Copyright 2025-2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Use is limited to qualifying small businesses. See LICENSE for terms.

import { apiFetch } from './client';
import type { AuthUser } from '../store/uiStore';

interface LoginResponse {
  token: string;
  user: AuthUser;
}

export function login(username: string, password: string) {
  return apiFetch<LoginResponse>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  });
}

export function getMe() {
  return apiFetch<AuthUser>('/auth/me');
}

export function changePassword(currentPassword: string, newPassword: string) {
  return apiFetch<{ ok: true }>('/auth/change-password', {
    method: 'POST',
    body: JSON.stringify({ currentPassword, newPassword }),
  });
}

export function requestPasswordReset(identifier: string) {
  return apiFetch<{ ok: true; message: string }>('/auth/password-reset/request', {
    method: 'POST',
    body: JSON.stringify({ identifier }),
  });
}

/** `purpose` distinguishes an invite link from a reset link so the confirm
 *  page can show the right copy — both use this endpoint. */
export function verifyPasswordResetToken(token: string) {
  return apiFetch<{
    valid: boolean;
    reason?: 'expired' | 'consumed' | 'unknown';
    purpose?: 'reset' | 'invite';
  }>('/auth/password-reset/verify', { method: 'POST', body: JSON.stringify({ token }) });
}

export function confirmPasswordReset(token: string, newPassword: string) {
  return apiFetch<{ ok: true; purpose: 'reset' | 'invite' }>('/auth/password-reset/confirm', {
    method: 'POST',
    body: JSON.stringify({ token, newPassword }),
  });
}

export interface PublicFeatures {
  ai: boolean;
  passwordResetEnabled: boolean;
  mailEnabled: boolean;
}

export function getFeatures() {
  return apiFetch<PublicFeatures>('/features');
}
