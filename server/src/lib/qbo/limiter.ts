// Copyright 2025-2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Use is limited to qualifying small businesses. See LICENSE for terms.

/**
 * Per-realm serial queue + retry with backoff for QuickBooks API calls.
 *
 * Intuit throttles per company (realm), so calls for one realm are run one at
 * a time; different realms proceed independently. 429 and 5xx are retried
 * with exponential backoff (a `Retry-After` header wins when present);
 * 400/401/403 are never retried — a bad request stays bad, and a 401 is the
 * API client's job to handle with ONE forced token refresh.
 */

export class RetryableStatusError extends Error {
  readonly status: number;
  readonly retryAfter: string | null;
  constructor(status: number, message: string, retryAfter: string | null = null) {
    super(message);
    this.name = 'RetryableStatusError';
    this.status = status;
    this.retryAfter = retryAfter;
  }
}

export function shouldRetry(status: number): boolean {
  return status === 429 || status >= 500;
}

const BASE_BACKOFF_MS = 500;
const MAX_BACKOFF_MS = 30_000;

/** attempt 0 → 500ms, 1 → 1s, 2 → 2s …; a numeric `Retry-After` (seconds) overrides. */
export function computeBackoffMs(attempt: number, retryAfter?: string | null): number {
  if (retryAfter) {
    const secs = Number(retryAfter.trim());
    if (Number.isFinite(secs) && secs >= 0) return Math.min(MAX_BACKOFF_MS, Math.round(secs * 1000));
  }
  return Math.min(MAX_BACKOFF_MS, BASE_BACKOFF_MS * 2 ** Math.max(0, attempt));
}

export interface RetryOptions {
  /** Retries AFTER the first attempt. Default 3 → at most 4 calls. */
  maxRetries?: number;
  sleep?: (ms: number) => Promise<void>;
}

const defaultSleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

/**
 * Run `fn`, retrying when it throws a `RetryableStatusError` whose status
 * `shouldRetry`. Any other error propagates immediately.
 */
export async function withRetry<T>(fn: (attempt: number) => Promise<T>, opts: RetryOptions = {}): Promise<T> {
  const maxRetries = opts.maxRetries ?? 3;
  const sleep = opts.sleep ?? defaultSleep;
  for (let attempt = 0; ; attempt++) {
    try {
      return await fn(attempt);
    } catch (err) {
      if (!(err instanceof RetryableStatusError) || !shouldRetry(err.status) || attempt >= maxRetries) throw err;
      await sleep(computeBackoffMs(attempt, err.retryAfter));
    }
  }
}

export interface RealmLimiter {
  run<T>(realmId: string, fn: () => Promise<T>): Promise<T>;
}

/** One promise chain per realm: a call starts only after the previous one for that realm settled. */
export function createRealmLimiter(): RealmLimiter {
  const tails = new Map<string, Promise<void>>();
  return {
    run<T>(realmId: string, fn: () => Promise<T>): Promise<T> {
      const prev = tails.get(realmId) ?? Promise.resolve();
      const next = prev.then(fn);
      // Keep the chain alive but never let a rejection poison the next caller.
      const settled: Promise<void> = next.then(
        () => undefined,
        () => undefined,
      );
      tails.set(realmId, settled);
      void settled.then(() => {
        if (tails.get(realmId) === settled) tails.delete(realmId);
      });
      return next;
    },
  };
}

/** Process-wide limiter shared by every request path and the keepalive. */
export const qboLimiter: RealmLimiter = createRealmLimiter();
