// Copyright 2025-2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Use is limited to qualifying small businesses. See LICENSE for terms.

/**
 * The token-stage gates in middleware/auth.ts — which routes an mfa / enrol /
 * full token may reach. Run: npx tsx --test src/middleware/__tests__/authGates.test.ts
 *
 * Importing the middleware pulls in db.ts, which only builds a knex instance
 * (no connection), the same as the route tests do.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

process.env.JWT_SECRET ??= 'test'.repeat(16);
const { ENROL_ALLOWLIST, MFA_ALLOWLIST, ROTATION_ALLOWLIST, gateForRequest, routeKey } =
  require('../auth') as typeof import('../auth');

const full = { stage: null, mustChangePassword: false, requireTwoFactor: false };

test('routeKey drops the query string and upper-cases the method', () => {
  assert.equal(routeKey('get', '/api/v1/auth/me?x=1'), 'GET /api/v1/auth/me');
});

test('a full token (no stage claim) is never gated by the 2FA policy — this is what keeps the MCP agent working', () => {
  for (const route of ['GET /api/v1/clients', 'POST /api/v1/tax-lines/auto-assign', 'DELETE /api/v1/auth/totp']) {
    assert.equal(gateForRequest({ ...full, route }), null);
    assert.equal(gateForRequest({ ...full, route, requireTwoFactor: true }), null);
  }
});

test('the existing forced-rotation gate is unchanged for a full token', () => {
  const r = gateForRequest({ ...full, mustChangePassword: true, route: 'GET /api/v1/clients' });
  assert.equal(r?.status, 403);
  assert.equal(r?.code, 'PASSWORD_CHANGE_REQUIRED');
  for (const route of ROTATION_ALLOWLIST) {
    assert.equal(gateForRequest({ ...full, mustChangePassword: true, route }), null);
  }
});

test('a single-sign-on token skips the forced-rotation gate — the flag is about a local password the session never used', () => {
  assert.equal(gateForRequest({ ...full, sso: true, mustChangePassword: true, route: 'GET /api/v1/clients' }), null);
  // …but not the stage rules: a stage claim on an SSO token is still a bad token.
  assert.equal(gateForRequest({ ...full, sso: true, stage: 'bogus', route: 'GET /api/v1/clients' })?.status, 401);
  // and a local token with the same flag is gated exactly as before.
  assert.equal(gateForRequest({ ...full, sso: false, mustChangePassword: true, route: 'GET /api/v1/clients' })?.code, 'PASSWORD_CHANGE_REQUIRED');
});

test('an mfa token reaches only the challenge endpoints, and is refused with a 401 elsewhere', () => {
  for (const route of MFA_ALLOWLIST) {
    assert.equal(gateForRequest({ ...full, stage: 'mfa', route }), null);
  }
  for (const route of ['GET /api/v1/clients', 'GET /api/v1/auth/me', 'POST /api/v1/auth/change-password', 'GET /api/v1/auth/two-factor']) {
    const r = gateForRequest({ ...full, stage: 'mfa', route });
    assert.equal(r?.status, 401, route);
    assert.equal(r?.code, 'MFA_REQUIRED');
  }
  // Even with a forced rotation pending: the mfa token cannot rotate the password.
  assert.equal(gateForRequest({ ...full, stage: 'mfa', mustChangePassword: true, route: 'POST /api/v1/auth/change-password' })?.code, 'MFA_REQUIRED');
});

test('an enrol token reaches the enrolment endpoints and the profile, nothing else, while the policy is on', () => {
  for (const route of ENROL_ALLOWLIST) {
    assert.equal(gateForRequest({ ...full, stage: 'enrol', requireTwoFactor: true, route }), null, route);
  }
  const r = gateForRequest({ ...full, stage: 'enrol', requireTwoFactor: true, route: 'GET /api/v1/clients' });
  assert.equal(r?.status, 403);
  assert.equal(r?.code, 'TWO_FACTOR_ENROLMENT_REQUIRED');
  assert.ok(ENROL_ALLOWLIST.has('GET /api/v1/auth/me'));
  assert.ok(ENROL_ALLOWLIST.has('POST /api/v1/auth/change-password'));
});

test('password rotation still comes first for an enrol token', () => {
  const r = gateForRequest({ ...full, stage: 'enrol', requireTwoFactor: true, mustChangePassword: true, route: 'POST /api/v1/auth/totp/enrol/start' });
  assert.equal(r?.code, 'PASSWORD_CHANGE_REQUIRED');
  assert.equal(gateForRequest({ ...full, stage: 'enrol', requireTwoFactor: true, mustChangePassword: true, route: 'POST /api/v1/auth/change-password' }), null);
});

test('an enrol token becomes a full session once the admin switches the policy off', () => {
  assert.equal(gateForRequest({ ...full, stage: 'enrol', requireTwoFactor: false, route: 'GET /api/v1/clients' }), null);
});

test('an unknown stage value is refused outright', () => {
  assert.equal(gateForRequest({ ...full, stage: 'admin', route: 'GET /api/v1/clients' })?.status, 401);
});
