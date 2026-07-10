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

export async function apiFetch<T>(
  path: string,
  options: RequestInit = {},
): Promise<ApiResult<T>> {
  const token = getToken();

  // Don't set Content-Type for FormData — browser must set it with the multipart boundary
  const isFormData = options.body instanceof FormData;

  let response: Response;
  try {
    response = await fetch(`${BASE_URL}${path}`, {
      ...options,
      headers: {
        ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(options.headers as Record<string, string>),
      },
    });
  } catch {
    return { data: null, error: { code: 'NETWORK_ERROR', message: 'Cannot reach server. Is it running?' } };
  }

  if (response.status === 401) {
    handleUnauthorized();
    return { data: null, error: { code: 'UNAUTHORIZED', message: 'Session expired. Please log in again.' } };
  }

  try {
    const json = (await response.json()) as ApiResult<T>;
    return json;
  } catch {
    return { data: null, error: { code: 'PARSE_ERROR', message: `Server returned status ${response.status}` } };
  }
}
