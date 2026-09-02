// Copyright 2025-2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Use is limited to qualifying small businesses. See LICENSE for terms.

/**
 * QuickBooks retry/backoff + per-realm serial limiter.
 * Run: npx tsx --test src/lib/__tests__/qboLimiter.test.ts
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeBackoffMs, createRealmLimiter, RetryableStatusError, shouldRetry, withRetry } from '../qbo/limiter';

test('backoff doubles from 500ms and Retry-After (seconds) wins', () => {
  assert.equal(computeBackoffMs(0), 500);
  assert.equal(computeBackoffMs(1), 1000);
  assert.equal(computeBackoffMs(2), 2000);
  assert.equal(computeBackoffMs(20), 30_000);
  assert.equal(computeBackoffMs(0, '7'), 7000);
  assert.equal(computeBackoffMs(0, '120'), 30_000);
  assert.equal(computeBackoffMs(1, 'garbage'), 1000);
});

test('shouldRetry: 429 and 5xx only', () => {
  assert.equal(shouldRetry(429), true);
  assert.equal(shouldRetry(500), true);
  assert.equal(shouldRetry(503), true);
  assert.equal(shouldRetry(400), false);
  assert.equal(shouldRetry(401), false);
  assert.equal(shouldRetry(403), false);
  assert.equal(shouldRetry(404), false);
});

test('withRetry sleeps [500, 1000, 2000] across three retries then succeeds', async () => {
  const sleeps: number[] = [];
  let calls = 0;
  const result = await withRetry(
    async () => {
      calls++;
      if (calls < 4) throw new RetryableStatusError(503, 'down');
      return 'ok';
    },
    { sleep: async (ms) => void sleeps.push(ms) },
  );
  assert.equal(result, 'ok');
  assert.equal(calls, 4);
  assert.deepEqual(sleeps, [500, 1000, 2000]);
});

test('withRetry gives up after maxRetries and rethrows the last error', async () => {
  const sleeps: number[] = [];
  await assert.rejects(
    withRetry(
      async () => {
        throw new RetryableStatusError(429, 'throttled', '2');
      },
      { sleep: async (ms) => void sleeps.push(ms) },
    ),
    (err: unknown) => err instanceof RetryableStatusError && err.status === 429,
  );
  assert.deepEqual(sleeps, [2000, 2000, 2000]);
});

test('withRetry never retries 400/401/403 or non-retryable errors', async () => {
  for (const status of [400, 401, 403]) {
    let calls = 0;
    await assert.rejects(
      withRetry(async () => {
        calls++;
        throw new RetryableStatusError(status, 'no');
      }),
      (err: unknown) => err instanceof RetryableStatusError && err.status === status,
    );
    assert.equal(calls, 1);
  }
  let calls = 0;
  await assert.rejects(
    withRetry(async () => {
      calls++;
      throw new Error('plain');
    }),
    /plain/,
  );
  assert.equal(calls, 1);
});

test('realm limiter serialises calls per realm and isolates realms and failures', async () => {
  const limiter = createRealmLimiter();
  const log: string[] = [];
  const gate = (name: string, ms: number, fail = false) => async (): Promise<string> => {
    log.push(`${name}:start`);
    await new Promise((r) => setTimeout(r, ms));
    log.push(`${name}:end`);
    if (fail) throw new Error(name);
    return name;
  };
  const a1 = limiter.run('A', gate('a1', 20, true)).catch((e: Error) => `caught:${e.message}`);
  const a2 = limiter.run('A', gate('a2', 1));
  const b1 = limiter.run('B', gate('b1', 1));
  const results = await Promise.all([a1, a2, b1]);
  assert.deepEqual(results, ['caught:a1', 'a2', 'b1']);
  // a2 waited for a1 (even though a1 failed); b1 did not wait for A at all.
  assert.ok(log.indexOf('a1:end') < log.indexOf('a2:start'));
  assert.ok(log.indexOf('b1:start') < log.indexOf('a1:end'));
});
