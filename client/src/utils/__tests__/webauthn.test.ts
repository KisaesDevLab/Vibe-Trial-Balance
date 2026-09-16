// Copyright 2025-2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Use is limited to qualifying small businesses. See LICENSE for terms.

// Run with: npm run test:webauthn (from the repo root)

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { describeWebAuthnError, webauthnAvailability } from '../webauthn';

test('availability needs the API and a secure context', () => {
  assert.equal(webauthnAvailability({ hasPublicKeyCredential: true, isSecureContext: true }).supported, true);
  const noApi = webauthnAvailability({ hasPublicKeyCredential: false, isSecureContext: true });
  assert.equal(noApi.supported, false);
  assert.match(noApi.reason!, /does not support/);
  const http = webauthnAvailability({ hasPublicKeyCredential: true, isSecureContext: false });
  assert.equal(http.supported, false);
  assert.match(http.reason!, /https/);
});

test('a dismissed prompt is a quiet cancellation, by SimpleWebAuthn code or by DOMException name', () => {
  assert.equal(describeWebAuthnError({ code: 'ERROR_CEREMONY_ABORTED', name: 'WebAuthnError' }).cancelled, true);
  assert.equal(describeWebAuthnError({ name: 'NotAllowedError', message: 'x' }).cancelled, true);
  assert.equal(describeWebAuthnError({ name: 'AbortError' }).cancelled, true);
});

test('real failures get actionable copy', () => {
  assert.match(describeWebAuthnError({ code: 'ERROR_INVALID_RP_ID' }).message, /public URL/);
  assert.match(describeWebAuthnError({ code: 'ERROR_AUTHENTICATOR_PREVIOUSLY_REGISTERED' }).message, /already has a passkey/);
  assert.match(describeWebAuthnError({ name: 'SecurityError' }).message, /https/);
  assert.match(describeWebAuthnError({ name: 'InvalidStateError' }).message, /already has a passkey/);
  assert.equal(describeWebAuthnError({ name: 'SecurityError' }).cancelled, false);
});

test('unknown errors fall back to their own message or a generic one', () => {
  assert.equal(describeWebAuthnError(new Error('boom')).message, 'boom');
  assert.match(describeWebAuthnError(null).message, /failed/);
  assert.match(describeWebAuthnError('weird').message, /failed/);
});
