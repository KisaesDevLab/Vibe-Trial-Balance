// Copyright 2025-2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Use is limited to qualifying small businesses. See LICENSE for terms.

// Run with: npm run test:twofactor-client (from the repo root)

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { twoFactorSummary } from '../twoFactorSummary';
import { describeUserAgent } from '../userAgentLabel';

test('the Users pill names what is enrolled', () => {
  assert.deepEqual(twoFactorSummary({}), { label: 'None', enrolled: false });
  assert.deepEqual(twoFactorSummary({ totp_enabled: true }), { label: 'TOTP', enrolled: true });
  assert.deepEqual(twoFactorSummary({ passkey_count: 1 }), { label: 'Passkey', enrolled: true });
  assert.deepEqual(twoFactorSummary({ passkey_count: 3 }), { label: 'Passkey ×3', enrolled: true });
  assert.deepEqual(twoFactorSummary({ totp_enabled: true, passkey_count: 2 }), { label: 'TOTP + Passkey ×2', enrolled: true });
  assert.deepEqual(twoFactorSummary({ totp_enabled: false, passkey_count: 0 }), { label: 'None', enrolled: false });
});

test('user agents are described by browser and OS', () => {
  assert.equal(
    describeUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36 Edg/128.0.0.0'),
    'Edge on Windows',
  );
  assert.equal(
    describeUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'),
    'Safari on iPhone',
  );
  assert.equal(
    describeUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36'),
    'Chrome on Mac',
  );
  assert.equal(describeUserAgent('Mozilla/5.0 (X11; Linux x86_64; rv:129.0) Gecko/20100101 Firefox/129.0'), 'Firefox on Linux');
  assert.equal(describeUserAgent(''), 'Unknown browser');
  assert.equal(describeUserAgent(null), 'Unknown browser');
});
