// Copyright 2025-2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Use is limited to qualifying small businesses. See LICENSE for terms.

/**
 * The login page as a state machine, pure so the transitions are tested.
 *
 *   credentials → mfa → rotate → enrol → done
 *
 * Order matters and mirrors the server: a second factor is proved before a
 * forced password change (a temporary password must not be enough to rotate
 * a 2FA-protected account), and a password change happens before enrolment
 * (the public bootstrap password must never enrol a factor).
 */

export type ServerStage = 'ok' | 'mfa' | 'enrol';
export type MfaMethod = 'totp' | 'passkey';
export type LoginUiStage = 'credentials' | 'mfa' | 'rotate' | 'enrol' | 'done';

export interface StageUser {
  mustChangePassword?: boolean;
  mustEnrolTwoFactor?: boolean;
}

/** After POST /login (or after a second factor / passkey login, with stage 'ok'). */
export function stageAfterLogin(r: { stage: ServerStage; user: StageUser }): LoginUiStage {
  if (r.stage === 'mfa') return 'mfa';
  if (r.user.mustChangePassword) return 'rotate';
  if (r.stage === 'enrol' || r.user.mustEnrolTwoFactor) return 'enrol';
  return 'done';
}

/** After a successful password rotation. */
export function stageAfterRotate(user: StageUser): 'enrol' | 'done' {
  return user.mustEnrolTwoFactor ? 'enrol' : 'done';
}

/**
 * Where to land when the login page mounts with a session already stored
 * (a reload mid-flow, or a user who typed /login while signed in).
 */
export function initialStageFromStore(token: string | null, user: StageUser | null): 'credentials' | 'rotate' | 'enrol' | 'done' {
  if (!token || !user) return 'credentials';
  if (user.mustChangePassword) return 'rotate';
  if (user.mustEnrolTwoFactor) return 'enrol';
  return 'done';
}

/** The user object to store for a given server stage: 'enrol' sets the obligation flag. */
export function userForStore<T extends StageUser>(stage: ServerStage, user: T): T {
  return { ...user, mustEnrolTwoFactor: stage === 'enrol' || !!user.mustEnrolTwoFactor };
}
