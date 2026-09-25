// Copyright 2025-2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Use is limited to qualifying small businesses. See LICENSE for terms.

/**
 * The account rules behind the single sign-on hardening (lib/accountGuards.ts):
 * the break-glass account cannot be deactivated / demoted / renamed and is
 * never put into forced password rotation; self-service password reset is
 * refused for it and for SSO-only accounts; role sync never demotes the last
 * active admin. The routes and the Vibe Auth user adapter only apply these
 * decisions — test/sso-e2e.mjs walks them against a real server and database.
 * Run: npx tsx --test src/lib/__tests__/accountGuards.test.ts
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  BREAKGLASS_PROTECTED,
  breakglassChangeRefusal,
  breakglassUsername,
  isBreakglassUsername,
  mustChangeAfterAdminPasswordSet,
  roleSyncRefusal,
  selfServiceResetRefusal,
} from '../accountGuards';

const DEFAULT_ENV = {} as NodeJS.ProcessEnv;
const CUSTOM_ENV = { VIBE_BREAKGLASS_USERNAME: '  Emergency-Admin ' } as NodeJS.ProcessEnv;

test('the break-glass username comes from VIBE_BREAKGLASS_USERNAME, trimmed, defaulting to vibe-breakglass', () => {
  assert.equal(breakglassUsername(DEFAULT_ENV), 'vibe-breakglass');
  assert.equal(breakglassUsername({ VIBE_BREAKGLASS_USERNAME: '' } as NodeJS.ProcessEnv), 'vibe-breakglass');
  assert.equal(breakglassUsername({ VIBE_BREAKGLASS_USERNAME: '   ' } as NodeJS.ProcessEnv), 'vibe-breakglass');
  assert.equal(breakglassUsername(CUSTOM_ENV), 'Emergency-Admin');
});

test('the account is recognised by username, case-insensitively, and by nothing else', () => {
  for (const u of ['vibe-breakglass', 'Vibe-Breakglass', '  VIBE-BREAKGLASS ']) assert.equal(isBreakglassUsername(u, DEFAULT_ENV), true, u);
  for (const u of ['vibe-breakglass2', 'breakglass', 'admin', '', null, undefined]) assert.equal(isBreakglassUsername(u, DEFAULT_ENV), false, String(u));
  assert.equal(isBreakglassUsername('emergency-admin', CUSTOM_ENV), true);
  assert.equal(isBreakglassUsername('vibe-breakglass', CUSTOM_ENV), false, 'a renamed break-glass account frees the default name');
});

test('break-glass cannot be deactivated, demoted or renamed — whatever the sign-in mode', () => {
  const saved = process.env.VIBE_AUTH_MODE;
  try {
    for (const mode of ['local', 'both', 'oidc_only']) {
      process.env.VIBE_AUTH_MODE = mode;
      assert.deepEqual(breakglassChangeRefusal('vibe-breakglass', { isActive: false }, DEFAULT_ENV), { ...BREAKGLASS_PROTECTED }, mode);
      assert.deepEqual(breakglassChangeRefusal('vibe-breakglass', { role: 'reviewer' }, DEFAULT_ENV), { ...BREAKGLASS_PROTECTED }, mode);
      assert.deepEqual(breakglassChangeRefusal('vibe-breakglass', { role: 'preparer' }, DEFAULT_ENV), { ...BREAKGLASS_PROTECTED }, mode);
      assert.deepEqual(breakglassChangeRefusal('vibe-breakglass', { username: 'someone-else' }, DEFAULT_ENV), { ...BREAKGLASS_PROTECTED }, mode);
      assert.deepEqual(breakglassChangeRefusal('Vibe-Breakglass', { isActive: false }, DEFAULT_ENV), { ...BREAKGLASS_PROTECTED }, mode);
    }
  } finally {
    if (saved === undefined) delete process.env.VIBE_AUTH_MODE;
    else process.env.VIBE_AUTH_MODE = saved;
  }
});

test('the refusal names the code and the supported way to change the account', () => {
  assert.equal(BREAKGLASS_PROTECTED.code, 'BREAKGLASS_PROTECTED');
  assert.match(BREAKGLASS_PROTECTED.message, /vibe identity rotate-breakglass/);
  assert.match(BREAKGLASS_PROTECTED.message, /vibe-auth breakglass rotate/);
});

test('changes that keep the emergency path intact are allowed on break-glass', () => {
  assert.equal(breakglassChangeRefusal('vibe-breakglass', {}, DEFAULT_ENV), null);
  assert.equal(breakglassChangeRefusal('vibe-breakglass', { isActive: true, role: 'admin' }, DEFAULT_ENV), null);
  assert.equal(breakglassChangeRefusal('vibe-breakglass', { username: 'vibe-breakglass' }, DEFAULT_ENV), null);
});

test('every other account is untouched by the break-glass rule', () => {
  assert.equal(breakglassChangeRefusal('kurt', { isActive: false, role: 'preparer', username: 'kurt2' }, DEFAULT_ENV), null);
  assert.equal(breakglassChangeRefusal('vibe-breakglass', { isActive: false }, CUSTOM_ENV), null, 'only the CONFIGURED name is protected');
  assert.deepEqual(breakglassChangeRefusal('emergency-admin', { isActive: false }, CUSTOM_ENV), { ...BREAKGLASS_PROTECTED });
});

test('an admin password set forces rotation for everyone except break-glass', () => {
  assert.equal(mustChangeAfterAdminPasswordSet('kurt', DEFAULT_ENV), true);
  assert.equal(mustChangeAfterAdminPasswordSet('vibe-breakglass', DEFAULT_ENV), false);
  assert.equal(mustChangeAfterAdminPasswordSet('VIBE-Breakglass', DEFAULT_ENV), false);
  assert.equal(mustChangeAfterAdminPasswordSet('vibe-breakglass', CUSTOM_ENV), true);
});

test('self-service reset: refused for break-glass by rule, even with no SSO identity', () => {
  assert.equal(selfServiceResetRefusal({ username: 'vibe-breakglass', ssoOnlySince: null, hasSsoIdentity: false }, DEFAULT_ENV), 'breakglass');
  assert.equal(selfServiceResetRefusal({ username: 'Vibe-Breakglass', ssoOnlySince: null, hasSsoIdentity: true }, DEFAULT_ENV), 'breakglass');
});

test('self-service reset: refused for an account provisioned by SSO that never had a local password', () => {
  assert.equal(selfServiceResetRefusal({ username: 'kurt', ssoOnlySince: new Date(), hasSsoIdentity: true }, DEFAULT_ENV), 'sso_only');
  assert.equal(selfServiceResetRefusal({ username: 'kurt', ssoOnlySince: '2026-09-17T12:00:00Z', hasSsoIdentity: true }, DEFAULT_ENV), 'sso_only');
});

test('self-service reset: allowed for local accounts, linked or not, and once an admin has set a password', () => {
  // A local user whose email was later linked to the IdP keeps a real password.
  assert.equal(selfServiceResetRefusal({ username: 'pat', ssoOnlySince: null, hasSsoIdentity: true }, DEFAULT_ENV), null);
  assert.equal(selfServiceResetRefusal({ username: 'pat', ssoOnlySince: undefined, hasSsoIdentity: true }, DEFAULT_ENV), null);
  assert.equal(selfServiceResetRefusal({ username: 'pat', ssoOnlySince: null, hasSsoIdentity: false }, DEFAULT_ENV), null);
  // The marker without a linked identity (the link was removed) is not an SSO account any more.
  assert.equal(selfServiceResetRefusal({ username: 'kurt', ssoOnlySince: new Date(), hasSsoIdentity: false }, DEFAULT_ENV), null);
});

const KURT = { id: 1, username: 'kurt' };
const PAT = { id: 2, username: 'pat' };
const BREAKGLASS = { id: 9, username: 'vibe-breakglass' };

test('role sync: the last active admin is not demoted, and break-glass does not count as another admin', () => {
  assert.equal(roleSyncRefusal({ target: { ...KURT, role: 'admin' }, newRole: 'reviewer', activeAdmins: [KURT] }, DEFAULT_ENV), 'last_admin');
  assert.equal(roleSyncRefusal({ target: { ...KURT, role: 'admin' }, newRole: 'preparer', activeAdmins: [KURT, BREAKGLASS] }, DEFAULT_ENV), 'last_admin');
  assert.equal(roleSyncRefusal({ target: { ...KURT, role: 'admin' }, newRole: 'preparer', activeAdmins: [BREAKGLASS] }, DEFAULT_ENV), 'last_admin');
  assert.equal(roleSyncRefusal({ target: { ...KURT, role: 'admin' }, newRole: 'preparer', activeAdmins: [] }, DEFAULT_ENV), 'last_admin');
});

test('role sync: a demotion goes through while another real admin is active', () => {
  assert.equal(roleSyncRefusal({ target: { ...KURT, role: 'admin' }, newRole: 'reviewer', activeAdmins: [KURT, PAT] }, DEFAULT_ENV), null);
  assert.equal(roleSyncRefusal({ target: { ...KURT, role: 'admin' }, newRole: 'reviewer', activeAdmins: [PAT, BREAKGLASS] }, DEFAULT_ENV), null);
});

test('role sync: promotions and changes between non-admin roles are never refused', () => {
  assert.equal(roleSyncRefusal({ target: { ...KURT, role: 'preparer' }, newRole: 'admin', activeAdmins: [] }, DEFAULT_ENV), null);
  assert.equal(roleSyncRefusal({ target: { ...KURT, role: 'preparer' }, newRole: 'reviewer', activeAdmins: [] }, DEFAULT_ENV), null);
  assert.equal(roleSyncRefusal({ target: { ...KURT, role: 'admin' }, newRole: 'admin', activeAdmins: [KURT] }, DEFAULT_ENV), null);
});

test('role sync: the break-glass account itself is never demoted, however many admins there are', () => {
  assert.equal(roleSyncRefusal({ target: { ...BREAKGLASS, role: 'admin' }, newRole: 'preparer', activeAdmins: [KURT, PAT, BREAKGLASS] }, DEFAULT_ENV), 'breakglass');
});
