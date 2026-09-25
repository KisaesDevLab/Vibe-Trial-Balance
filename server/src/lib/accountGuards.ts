// Copyright 2025-2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Use is limited to qualifying small businesses. See LICENSE for terms.

/**
 * Account rules that keep single sign-on from locking a firm out or being
 * sidestepped. Pure: no database, no Express, no jwtConfig — the routes, the
 * Vibe Auth user adapter and the break-glass CLI all load it.
 *
 *   - The break-glass account (`VIBE_BREAKGLASS_USERNAME`, default
 *     `vibe-breakglass`) is the only way in when the identity provider is down
 *     and the mode is `oidc_only`, and the server refuses to boot in that mode
 *     without it. No admin may deactivate, demote or rename it, in ANY mode —
 *     a firm in `both` today is a firm in `oidc_only` tomorrow.
 *   - Self-service password reset is refused for the break-glass account and
 *     for an account that only ever signed in through the identity provider:
 *     otherwise mailbox access alone mints a local password for it, around the
 *     IdP's MFA and offboarding.
 *   - Role sync never demotes the last active admin (break-glass not counted).
 */

export const DEFAULT_BREAKGLASS_USERNAME = 'vibe-breakglass';
export const ADMIN_ROLE = 'admin';

/** The configured break-glass username, resolved the way the package does (trimmed; empty = default). */
export function breakglassUsername(env: NodeJS.ProcessEnv = process.env): string {
  return (env.VIBE_BREAKGLASS_USERNAME ?? '').trim() || DEFAULT_BREAKGLASS_USERNAME;
}

/** Case-insensitive, like the package's own localLoginAllowed(). */
export function isBreakglassUsername(username: string | null | undefined, env: NodeJS.ProcessEnv = process.env): boolean {
  if (typeof username !== 'string') return false;
  return username.trim().toLowerCase() === breakglassUsername(env).toLowerCase();
}

export const BREAKGLASS_PROTECTED = {
  code: 'BREAKGLASS_PROTECTED',
  message:
    'This is the break-glass emergency account: it cannot be deactivated, demoted or renamed here. ' +
    'Change it from the appliance console with "vibe identity rotate-breakglass", or with the CLI ' +
    '("npx vibe-auth breakglass rotate" from server/).',
} as const;

export interface AccountChange {
  isActive?: boolean;
  role?: string;
  username?: string;
}

/**
 * `null` when the change may go ahead, else the error body. Only the three
 * changes that would break the emergency path are refused; display name,
 * email, password and a two-factor reset stay available to an admin.
 */
export function breakglassChangeRefusal(
  targetUsername: string,
  change: AccountChange,
  env: NodeJS.ProcessEnv = process.env,
): { code: string; message: string } | null {
  if (!isBreakglassUsername(targetUsername, env)) return null;
  const deactivates = change.isActive === false;
  const demotes = change.role !== undefined && change.role !== ADMIN_ROLE;
  const renames = change.username !== undefined && change.username !== targetUsername;
  return deactivates || demotes || renames ? { ...BREAKGLASS_PROTECTED } : null;
}

/**
 * An admin setting a password normally forces the user to rotate it at the
 * next sign-in. Not the break-glass account: a forced rotation in the middle
 * of an outage traps the one account meant to get the firm back in, and its
 * password lives in the console secret store, not in anybody's memory.
 */
export function mustChangeAfterAdminPasswordSet(targetUsername: string, env: NodeJS.ProcessEnv = process.env): boolean {
  return !isBreakglassUsername(targetUsername, env);
}

export type ResetRefusalReason = 'breakglass' | 'sso_only';

export interface ResetCandidate {
  username: string;
  /** app_users.sso_only_since — set at just-in-time provisioning, cleared when a real password is set. */
  ssoOnlySince: Date | string | null | undefined;
  /** Whether an auth_identities row points at this user. */
  hasSsoIdentity: boolean;
}

/** Why self-service password reset is refused for this account, or `null` to proceed. */
export function selfServiceResetRefusal(u: ResetCandidate, env: NodeJS.ProcessEnv = process.env): ResetRefusalReason | null {
  if (isBreakglassUsername(u.username, env)) return 'breakglass';
  if (u.hasSsoIdentity && u.ssoOnlySince !== null && u.ssoOnlySince !== undefined) return 'sso_only';
  return null;
}

export type RoleSyncRefusalReason = 'breakglass' | 'last_admin';

export interface RoleSyncInput {
  target: { id: number; username: string; role: string };
  newRole: string;
  /** Every ACTIVE admin, the target included when it is one. */
  activeAdmins: ReadonlyArray<{ id: number; username: string }>;
}

/**
 * Why a role pushed by the identity provider must NOT be applied, or `null`.
 * A group edit at the IdP must not be able to leave the firm with no admin:
 * the break-glass account is for emergencies and does not count as one.
 */
export function roleSyncRefusal(i: RoleSyncInput, env: NodeJS.ProcessEnv = process.env): RoleSyncRefusalReason | null {
  if (i.target.role !== ADMIN_ROLE || i.newRole === ADMIN_ROLE) return null;
  if (isBreakglassUsername(i.target.username, env)) return 'breakglass';
  const another = i.activeAdmins.some((a) => a.id !== i.target.id && !isBreakglassUsername(a.username, env));
  return another ? null : 'last_admin';
}
