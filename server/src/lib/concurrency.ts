// Copyright 2025-2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Use is limited to qualifying small businesses. See LICENSE for terms.

/**
 * Map `items` through an async `fn` with at most `limit` calls in flight.
 * Results come back in input order. A rejection propagates once every
 * in-flight call has settled, so callers never see a half-finished pool.
 */
export async function mapWithConcurrency<T, R>(
  items: readonly T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  const width = Math.max(1, Math.min(Math.floor(limit), items.length || 1));
  let next = 0;
  let firstError: unknown;
  let failed = false;

  const worker = async (): Promise<void> => {
    while (next < items.length) {
      if (failed) return;
      const i = next++;
      try {
        results[i] = await fn(items[i] as T, i);
      } catch (err) {
        if (!failed) { failed = true; firstError = err; }
        return;
      }
    }
  };

  await Promise.all(Array.from({ length: width }, () => worker()));
  if (failed) throw firstError;
  return results;
}
