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
