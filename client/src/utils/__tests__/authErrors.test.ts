// Copyright 2025-2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Use is limited to qualifying small businesses. See LICENSE for terms.

// Run with: npm run test:autherrors (from the repo root)

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isMfaTerminal, messageForAuthError } from '../authErrors';

test('known codes get friendly copy, unknown ones keep the server message', () => {
  assert.match(messageForAuthError('INVALID_CODE', 'x'), /not valid/);
  assert.match(messageForAuthError('RATE_LIMITED', 'x'), /15 minutes/);
  assert.equal(messageForAuthError('SOMETHING_ELSE', 'server said so'), 'server said so');
});

test('a 401 on the code step reads as a timeout, elsewhere it does not', () => {
  assert.match(messageForAuthError('UNAUTHORIZED', 'x', { onMfaStep: true }), /timed out/);
  assert.equal(messageForAuthError('UNAUTHORIZED', 'x'), 'x');
});

test('terminal codes send the user back to the credentials form', () => {
  assert.equal(isMfaTerminal('UNAUTHORIZED'), true);
  assert.equal(isMfaTerminal('MFA_REQUIRED'), true);
  assert.equal(isMfaTerminal('INVALID_CODE'), false);
  assert.equal(isMfaTerminal('RATE_LIMITED'), false);
});
