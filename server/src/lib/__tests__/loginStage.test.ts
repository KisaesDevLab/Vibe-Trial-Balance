// Copyright 2025-2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Use is limited to qualifying small businesses. See LICENSE for terms.

/**
 * The after-password decision table.
 * Run: npx tsx --test src/lib/__tests__/loginStage.test.ts
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isStageClaim, resolveLoginStage, stageTokenTtl } from '../loginStage';

const base = { hasTotp: false, hasPasskey: false, trustedBrowser: false, requireTwoFactor: false };

test('nothing enrolled: ok unless the firm requires a factor', () => {
  assert.deepEqual(resolveLoginStage(base), { stage: 'ok', methods: [] });
  assert.deepEqual(resolveLoginStage({ ...base, requireTwoFactor: true }), { stage: 'enrol', methods: [] });
  // A trusted-browser cookie means nothing when there is no factor to skip.
  assert.deepEqual(resolveLoginStage({ ...base, requireTwoFactor: true, trustedBrowser: true }), { stage: 'enrol', methods: [] });
});

test('an enrolled factor demands a second step, naming what the user can answer with', () => {
  assert.deepEqual(resolveLoginStage({ ...base, hasTotp: true }), { stage: 'mfa', methods: ['totp'] });
  assert.deepEqual(resolveLoginStage({ ...base, hasPasskey: true }), { stage: 'mfa', methods: ['passkey'] });
  assert.deepEqual(resolveLoginStage({ ...base, hasTotp: true, hasPasskey: true }), { stage: 'mfa', methods: ['totp', 'passkey'] });
});

test('a passkey-only user typing a password is still challenged, so the policy cannot be bypassed', () => {
  assert.equal(resolveLoginStage({ ...base, hasPasskey: true, requireTwoFactor: true }).stage, 'mfa');
});

test('a trusted browser skips the challenge for an enrolled user', () => {
  assert.deepEqual(resolveLoginStage({ ...base, hasTotp: true, trustedBrowser: true }), { stage: 'ok', methods: ['totp'] });
});

test('scoped token lifetimes and claim recognition', () => {
  assert.equal(stageTokenTtl('mfa'), '5m');
  assert.equal(stageTokenTtl('enrol'), '15m');
  assert.equal(isStageClaim('mfa'), true);
  assert.equal(isStageClaim('enrol'), true);
  assert.equal(isStageClaim('ok'), false);
  assert.equal(isStageClaim(undefined), false);
});
