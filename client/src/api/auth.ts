// Copyright 2025-2026 Kisaes LLC
// Licensed under the PolyForm Internal Use License 1.0.0.
// You may not distribute this software. See LICENSE for terms.

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

export function verifyPasswordResetToken(token: string) {
  return apiFetch<{ valid: boolean; reason?: 'expired' | 'consumed' | 'unknown' }>(
    '/auth/password-reset/verify',
    { method: 'POST', body: JSON.stringify({ token }) },
  );
}

export function confirmPasswordReset(token: string, newPassword: string) {
  return apiFetch<{ ok: true }>('/auth/password-reset/confirm', {
    method: 'POST',
    body: JSON.stringify({ token, newPassword }),
  });
}

export interface PublicFeatures {
  ai: boolean;
  passwordResetEnabled: boolean;
}

export function getFeatures() {
  return apiFetch<PublicFeatures>('/features');
}
