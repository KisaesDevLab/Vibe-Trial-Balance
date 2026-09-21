// Copyright 2025-2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Use is limited to qualifying small businesses. See LICENSE for terms.

/**
 * The product side of the Vibe Auth (single sign-on) wiring — the pure pieces
 * of lib/vibeAuth.ts and the revocation hook in middleware/auth.ts. The OIDC
 * flow itself is exercised end to end by test/sso-e2e.mjs against the fake
 * identity provider. Run: npx tsx --test src/lib/__tests__/vibeAuthWiring.test.ts
 *
 * Importing lib/vibeAuth pulls in db.ts (a knex instance, no connection) and
 * jwtConfig (needs JWT_SECRET) — the same as the route tests.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

process.env.JWT_SECRET ??= 'test'.repeat(16);
process.env.VIBE_OIDC_PUBLIC_URL ??= 'http://localhost:3001';
process.env.VIBE_AUTH_MODE = 'oidc_only';
process.env.VIBE_BREAKGLASS_USERNAME = 'vibe-breakglass';

const { LOCAL_LOGIN_DISABLED, VIBE_TB_ROLES, VIBE_TB_ROLE_MAP, isRateLimitedAuthPath, localLoginRefusal, staleSessionCutoff, withSsoToken } =
  require('../vibeAuth') as typeof import('../vibeAuth');
const { isTokenRevoked, setRevocationCheck } = require('../../middleware/auth') as typeof import('../../middleware/auth');
const { DEFAULT_VIBE_GROUPS, resolveRole } = require('@kisaesdevlab/vibe-auth') as typeof import('@kisaesdevlab/vibe-auth');

test('the IdP group → role map is explicit, covers the five Vibe groups and is what the engine is given', () => {
  // The literal mapping docs/sso.md promises. A change here is a change to who
  // becomes an admin at every firm on the default map — make it on purpose.
  assert.deepEqual({ ...VIBE_TB_ROLE_MAP }, {
    'vibe-admin': 'admin',
    'vibe-it': 'admin',
    'vibe-partner': 'admin',
    'vibe-manager': 'reviewer',
    'vibe-staff': 'preparer',
  });
  assert.deepEqual(Object.keys(VIBE_TB_ROLE_MAP).sort(), [...DEFAULT_VIBE_GROUPS].sort());
  // createVibeAuth() receives VIBE_TB_ROLES as product.roles; the package only
  // falls back to its name-guessing defaultRoleMapFor() when this is absent.
  assert.equal(VIBE_TB_ROLES.defaultRoleMap, VIBE_TB_ROLE_MAP);
  assert.deepEqual([...VIBE_TB_ROLES.roles], ['admin', 'reviewer', 'preparer']);
  assert.equal(VIBE_TB_ROLES.adminRole, 'admin');
  for (const role of Object.values(VIBE_TB_ROLE_MAP)) assert.ok((VIBE_TB_ROLES.roles as readonly string[]).includes(role), role);
});

test('the package resolves each group through the map, the most privileged role winning', () => {
  const resolve = (groups: string[]) =>
    resolveRole({ claims: { groups }, roleClaim: 'roles', groupsClaim: 'groups', roleMap: { ...VIBE_TB_ROLE_MAP }, vocabulary: VIBE_TB_ROLES }).role;
  for (const [group, role] of Object.entries(VIBE_TB_ROLE_MAP)) assert.equal(resolve([group]), role, group);
  assert.equal(resolve(['vibe-staff', 'vibe-manager']), 'reviewer');
  assert.equal(resolve(['vibe-staff', 'vibe-it']), 'admin');
  assert.equal(resolve(['some-other-group']), null);
});

test('withSsoToken puts the bearer on the fragment and replaces any fragment already there', () => {
  assert.equal(withSsoToken('/login', 'abc'), '/login#sso_token=abc');
  assert.equal(withSsoToken('/tb/login?x=1#old', 'a b/+'), '/tb/login?x=1#sso_token=a%20b%2F%2B');
  assert.equal(withSsoToken('https://host/tb/dash', 't'), 'https://host/tb/dash#sso_token=t');
});

test('isRateLimitedAuthPath covers the browser-driven OIDC steps and nothing else', () => {
  for (const p of ['/auth/oidc/start', '/auth/oidc/callback', '/auth/oidc/exchange', '/auth/settings/test', '/auth/oidc/start/']) {
    assert.equal(isRateLimitedAuthPath(p), true, p);
  }
  // The back-channel logout is posted from ONE identity-provider address for
  // every user; limiting it would let a sign-out storm strand sessions.
  for (const p of ['/auth/oidc/backchannel', '/auth/status', '/auth/me', '/auth/settings', '/auth/oidc/logout', '/api/v1/auth/login', '/']) {
    assert.equal(isRateLimitedAuthPath(p), false, p);
  }
});

test('staleSessionCutoff is one token lifetime plus an hour before now', () => {
  const now = Date.UTC(2026, 8, 17, 12, 0, 0);
  const exp = Math.floor(now / 1000) + 8 * 3600; // an 8 h token minted now
  assert.equal(staleSessionCutoff(exp, now).getTime(), now - 9 * 3600 * 1000);
});

test('isTokenRevoked hands the hook the user id and sid, with iat in milliseconds (0 when absent)', async () => {
  const calls: Array<[{ userId: string; sid?: string }, number]> = [];
  setRevocationCheck(async (key, issuedAtMs) => {
    calls.push([key, issuedAtMs]);
    return key.userId === '7';
  });
  try {
    assert.equal(await isTokenRevoked({ userId: 7, sid: 'abc', iat: 1_700_000_000 }), true);
    assert.equal(await isTokenRevoked({ userId: 8 }), false);
    assert.equal(await isTokenRevoked({ userId: 9, sid: 42, iat: 'x' }), false);
    assert.deepEqual(calls, [
      [{ userId: '7', sid: 'abc' }, 1_700_000_000_000],
      [{ userId: '8', sid: undefined }, 0],
      [{ userId: '9', sid: undefined }, 0],
    ]);
  } finally {
    setRevocationCheck(null);
  }
  // No hook registered (before boot) → nothing is revoked.
  assert.equal(await isTokenRevoked({ userId: 7, sid: 'abc', iat: 1 }), false);
});

test('localLoginRefusal admits only the break-glass user in oidc_only, and is the body POST /login and passkey login both send', () => {
  assert.equal(localLoginRefusal('vibe-breakglass'), null);
  assert.equal(localLoginRefusal('  Vibe-Breakglass '), null);
  assert.deepEqual(localLoginRefusal('kurt'), { ...LOCAL_LOGIN_DISABLED });
  assert.deepEqual(localLoginRefusal(''), { ...LOCAL_LOGIN_DISABLED });
  assert.equal(LOCAL_LOGIN_DISABLED.code, 'LOCAL_LOGIN_DISABLED');
});
