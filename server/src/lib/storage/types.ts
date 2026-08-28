// Copyright 2025-2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Use is limited to qualifying small businesses. See LICENSE for terms.

/**
 * The storage driver contract. Two implementations: local disk (the default)
 * and B2 via its S3-compatible API.
 *
 * Ported from Vibe Time & Billing's `StorageClient`, minus the presign methods.
 * This app streams uploads and downloads through the API rather than handing
 * out presigned URLs — see the note in localDriver.ts for why.
 */

import type { Readable } from 'stream';

export type StorageBackend = 'local' | 'b2';

export interface StorageObjectMeta {
  key: string;
  sizeBytes: number;
  /** Provider ETag, unquoted. On B2 this is NOT a content hash. */
  etag: string;
  lastModified: Date;
  contentType?: string;
}

export interface PutOptions {
  contentType?: string;
  /** Provider-side metadata. Ignored by the local driver. */
  metadata?: Record<string, string>;
}

export interface ListOptions {
  /** Stop after this many objects. */
  limit?: number;
}

export interface StorageDriver {
  readonly kind: StorageBackend;

  /** Object metadata, or null when the key does not exist. Never throws for a
   *  simple miss — providers signal that differently and the driver normalises it. */
  head(key: string): Promise<StorageObjectMeta | null>;

  get(key: string): Promise<{ body: Readable; meta: StorageObjectMeta }>;

  put(key: string, body: Buffer, opts?: PutOptions): Promise<StorageObjectMeta>;

  delete(key: string): Promise<void>;

  /** Server-side copy where the provider supports it. */
  copy(sourceKey: string, destKey: string): Promise<StorageObjectMeta>;

  list(prefix: string, opts?: ListOptions): AsyncIterable<StorageObjectMeta>;

  /** Human-readable description for logs and the settings health probe. */
  describe(): string;
}

/** Raised for an expected, actionable condition rather than a bug. */
export class StorageError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly status = 500,
  ) {
    super(message);
    this.name = 'StorageError';
  }
}

/**
 * Providers signal "no such key" inconsistently — the local driver throws
 * ENOENT, the S3 client throws NotFound/404. One matcher, used by both, keeps
 * that difference from leaking into callers.
 */
export function isNotFoundError(err: unknown): boolean {
  const e = err as { name?: string; code?: string; $metadata?: { httpStatusCode?: number } };
  if (e?.$metadata?.httpStatusCode === 404) return true;
  if (e?.name === 'NotFound' || e?.name === 'NoSuchKey') return true;
  if (e?.code === 'ENOENT' || e?.code === 'NoSuchKey') return true;
  return /not found|NoSuchKey|ENOENT/i.test(String((err as Error)?.message ?? ''));
}
