// Copyright 2025-2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Use is limited to qualifying small businesses. See LICENSE for terms.

import { apiFetch } from './client';

export interface AppUser {
  id: number;
  username: string;
  display_name: string;
  email: string | null;
  role: 'admin' | 'reviewer' | 'preparer';
  is_active: boolean;
  /** Last time an invite email went out; null if never invited. */
  invited_at: string | null;
  /** Set when the invitee actually set their password. */
  invite_accepted_at: string | null;
  created_at: string;
  updated_at: string;
}

export type InviteFailureReason =
  | 'not_found'
  | 'inactive'
  | 'no_email'
  | 'mail_not_configured'
  | 'send_failed';

export type InviteResult =
  | { sent: true; resend: boolean; email: string; expiresAt: string }
  | { sent: false; reason: InviteFailureReason; message: string };

export interface UserInput {
  username: string;
  displayName: string;
  email?: string | null;
  /** Omit when sendInvite is set — the invitee chooses their own. */
  password?: string;
  role: 'admin' | 'reviewer' | 'preparer';
  sendInvite?: boolean;
}

export interface UserPatch {
  displayName?: string;
  email?: string | null;
  password?: string;
  role?: 'admin' | 'reviewer' | 'preparer';
  isActive?: boolean;
}

export const listUsers = () => apiFetch<AppUser[]>('/users');

export const createUser = (input: UserInput) =>
  apiFetch<AppUser & { invite: InviteResult | null }>('/users', {
    method: 'POST',
    body: JSON.stringify(input),
  });

/** Sends the invite email. Same call for the first send and every resend —
 *  each one supersedes any outstanding link for that user. */
export const sendUserInvite = (id: number) =>
  apiFetch<Extract<InviteResult, { sent: true }>>(`/users/${id}/invite`, { method: 'POST' });

export const updateUser = (id: number, input: UserPatch) =>
  apiFetch<AppUser>(`/users/${id}`, { method: 'PATCH', body: JSON.stringify(input) });

export const deactivateUser = (id: number) =>
  apiFetch<AppUser>(`/users/${id}`, { method: 'DELETE' });
