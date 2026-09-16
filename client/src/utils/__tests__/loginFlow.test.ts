// Copyright 2025-2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Use is limited to qualifying small businesses. See LICENSE for terms.

// Run with: npm run test:loginflow (from the repo root)

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { initialStageFromStore, stageAfterLogin, stageAfterRotate, userForStore } from '../loginFlow';

test('after login: mfa first, then rotation, then enrolment, then in', () => {
  assert.equal(stageAfterLogin({ stage: 'ok', user: {} }), 'done');
  assert.equal(stageAfterLogin({ stage: 'mfa', user: {} }), 'mfa');
  assert.equal(stageAfterLogin({ stage: 'mfa', user: { mustChangePassword: true } }), 'mfa', 'code before rotation');
  assert.equal(stageAfterLogin({ stage: 'ok', user: { mustChangePassword: true } }), 'rotate');
  assert.equal(stageAfterLogin({ stage: 'enrol', user: { mustChangePassword: true } }), 'rotate', 'rotation before enrolment');
  assert.equal(stageAfterLogin({ stage: 'enrol', user: {} }), 'enrol');
  assert.equal(stageAfterLogin({ stage: 'ok', user: { mustEnrolTwoFactor: true } }), 'enrol', 'server flag alone is enough');
});

test('after rotation: enrol if the firm requires it, else in', () => {
  assert.equal(stageAfterRotate({}), 'done');
  assert.equal(stageAfterRotate({ mustEnrolTwoFactor: true }), 'enrol');
});

test('mounting with a stored session resumes the pending obligation, never the mfa step', () => {
  assert.equal(initialStageFromStore(null, null), 'credentials');
  assert.equal(initialStageFromStore('t', null), 'credentials');
  assert.equal(initialStageFromStore('t', {}), 'done');
  assert.equal(initialStageFromStore('t', { mustChangePassword: true }), 'rotate');
  assert.equal(initialStageFromStore('t', { mustEnrolTwoFactor: true }), 'enrol');
  assert.equal(initialStageFromStore('t', { mustChangePassword: true, mustEnrolTwoFactor: true }), 'rotate');
});

test('userForStore marks the enrolment obligation from the stage and keeps everything else', () => {
  const u = { id: 1, name: 'x', mustEnrolTwoFactor: false };
  assert.deepEqual(userForStore('enrol', u), { id: 1, name: 'x', mustEnrolTwoFactor: true });
  assert.deepEqual(userForStore('ok', u), { id: 1, name: 'x', mustEnrolTwoFactor: false });
  assert.deepEqual(userForStore('ok', { id: 2, mustEnrolTwoFactor: true }), { id: 2, mustEnrolTwoFactor: true });
});
