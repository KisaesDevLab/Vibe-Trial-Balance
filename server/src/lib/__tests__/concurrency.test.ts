import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mapWithConcurrency } from '../concurrency';

const tick = (): Promise<void> => new Promise((r) => setImmediate(r));

test('returns results in input order', async () => {
  const out = await mapWithConcurrency([3, 1, 2], 2, async (n) => {
    for (let i = 0; i < n; i++) await tick();
    return n * 10;
  });
  assert.deepEqual(out, [30, 10, 20]);
});

test('never exceeds the concurrency limit', async () => {
  let inFlight = 0;
  let peak = 0;
  await mapWithConcurrency(Array.from({ length: 10 }, (_, i) => i), 3, async () => {
    inFlight++;
    peak = Math.max(peak, inFlight);
    await tick(); await tick();
    inFlight--;
  });
  assert.equal(peak, 3);
});

test('a limit above the item count runs everything at once', async () => {
  let inFlight = 0;
  let peak = 0;
  await mapWithConcurrency([1, 2], 8, async () => {
    inFlight++; peak = Math.max(peak, inFlight); await tick(); inFlight--;
  });
  assert.equal(peak, 2);
});

test('empty input resolves to an empty array without calling fn', async () => {
  let calls = 0;
  const out = await mapWithConcurrency([], 4, async () => { calls++; });
  assert.deepEqual(out, []);
  assert.equal(calls, 0);
});

test('rejects with the first error and stops starting new work', async () => {
  const started: number[] = [];
  await assert.rejects(
    mapWithConcurrency([0, 1, 2, 3, 4, 5], 2, async (n) => {
      started.push(n);
      await tick();
      if (n === 1) throw new Error('boom');
    }),
    /boom/,
  );
  // Workers already past the check may pick one more item each, but the
  // pool does not drain the whole list after a failure.
  assert.ok(started.length < 6, `started ${started.join(',')}`);
});
