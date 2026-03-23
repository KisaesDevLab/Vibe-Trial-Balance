import { apiFetch } from './client';

export interface AppUser {
  id: number;
  username: string;
  display_name: string;
  role: 'admin' | 'reviewer' | 'preparer';
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface UserInput {
  username: string;
  displayName: string;
  password: string;
  role: 'admin' | 'reviewer' | 'preparer';
}

export interface UserPatch {
  displayName?: string;
  password?: string;
  role?: 'admin' | 'reviewer' | 'preparer';
  isActive?: boolean;
}

export const listUsers = () => apiFetch<AppUser[]>('/users');

export const createUser = (input: UserInput) =>
  apiFetch<AppUser>('/users', { method: 'POST', body: JSON.stringify(input) });

export const updateUser = (id: number, input: UserPatch) =>
  apiFetch<AppUser>(`/users/${id}`, { method: 'PATCH', body: JSON.stringify(input) });

export const deactivateUser = (id: number) =>
  apiFetch<AppUser>(`/users/${id}`, { method: 'DELETE' });
