// Copyright 2025-2026 Kisaes LLC
// Licensed under the Elastic License 2.0 (ELv2); you may not use this file
// except in compliance with the Elastic License 2.0.
// See LICENSE file in the project root for full license text.

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
