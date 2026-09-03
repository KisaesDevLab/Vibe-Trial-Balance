// Copyright 2025-2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Use is limited to qualifying small businesses. See LICENSE for terms.

/**
 * Map `items` through an async `fn` with at most `limit` calls in flight.
 * Results come back in input order. When `shouldStop` returns true no further
 * items are started; the slots for unstarted items stay `undefined`.
 */
export async function mapWithConcurrency<T, R>(
  items: readonly T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
  shouldStop: () => boolean = () => false,
): Promise<Array<R | undefined>> {
  const results: Array<R | undefined> = new Array(items.length);
  const width = Math.max(1, Math.min(Math.floor(limit), items.length || 1));
  let next = 0;
  let firstError: unknown;
  let failed = false;

  const worker = async (): Promise<void> => {
    while (next < items.length) {
      if (failed || shouldStop()) return;
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
