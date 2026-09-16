// Copyright 2025-2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Use is limited to qualifying small businesses. See LICENSE for terms.

import { useAuthStore } from '../store/uiStore';
import { API_BASE_URL, withBase } from '../lib/baseConfig';

const BASE_URL = API_BASE_URL;
const LOGIN_PATH = withBase('login');

function getToken(): string | null {
  const stored = localStorage.getItem('auth');
  if (!stored) return null;
  try {
    const parsed = JSON.parse(stored) as { state?: { token?: string } };
    return parsed.state?.token ?? null;
  } catch {
    return null;
  }
}

function handleUnauthorized(): void {
  useAuthStore.getState().clearAuth();
  if (!window.location.pathname.startsWith(LOGIN_PATH)) {
    window.location.href = LOGIN_PATH;
  }
}

export type ApiSuccess<T> = { data: T; error: null };
export type ApiError = { data: null; error: { code: string; message: string } };
export type ApiResult<T> = ApiSuccess<T> | ApiError;

export interface ApiFetchOptions extends RequestInit {
  /**
   * Use this bearer instead of the stored session. The login page passes the
   * short-lived MFA token here, which is how that token stays OUT of the auth
   * store (and so out of ProtectedRoute's reach) until the code is proved.
   */
  authToken?: string;
  /**
   * Return a 401 as an ordinary error instead of clearing the session and
   * redirecting. The login page sets this so an expired MFA token is shown as
   * "sign in again" rather than bouncing the page it is already on.
   */
  noAuthRedirect?: boolean;
}

// The server answers these 403s while a session is restricted to one job:
// finishing a forced password change, or enrolling a second factor the firm
// now requires. Flag it on the stored user; ProtectedRoute sends the user to
// the login page, which lands on the right screen.
const OBLIGATION_CODES = new Set(['PASSWORD_CHANGE_REQUIRED', 'TWO_FACTOR_ENROLMENT_REQUIRED']);

export async function apiFetch<T>(
  path: string,
  options: ApiFetchOptions = {},
): Promise<ApiResult<T>> {
  const { authToken, noAuthRedirect, ...init } = options;
  const token = authToken ?? getToken();

  // Don't set Content-Type for FormData — browser must set it with the multipart boundary
  const isFormData = init.body instanceof FormData;

  let response: Response;
  try {
    response = await fetch(`${BASE_URL}${path}`, {
      ...init,
      headers: {
        ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(init.headers as Record<string, string>),
      },
    });
  } catch {
    return { data: null, error: { code: 'NETWORK_ERROR', message: 'Cannot reach server. Is it running?' } };
  }

  if (response.status === 401 && !noAuthRedirect) {
    handleUnauthorized();
    return { data: null, error: { code: 'UNAUTHORIZED', message: 'Session expired. Please log in again.' } };
  }

  try {
    const json = (await response.json()) as ApiResult<T>;
    if (response.status === 403 && json.error && OBLIGATION_CODES.has(json.error.code)) {
      useAuthStore.getState().markObligation(json.error.code as 'PASSWORD_CHANGE_REQUIRED' | 'TWO_FACTOR_ENROLMENT_REQUIRED');
    }
    return json;
  } catch {
    return { data: null, error: { code: 'PARSE_ERROR', message: `Server returned status ${response.status}` } };
  }
}
