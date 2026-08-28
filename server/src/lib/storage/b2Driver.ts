// Copyright 2025-2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Use is limited to qualifying small businesses. See LICENSE for terms.

/**
 * Backblaze B2 via its S3-compatible API. Ported from Vibe Time & Billing's
 * `packages/storage/src/b2.ts`, keeping every workaround it earned the hard
 * way — each is commented with the failure it prevents.
 *
 * The AWS SDK is loaded through a lazy, memoised dynamic import so this module
 * imports cleanly on an install that never enables B2, and so a Pi that only
 * uses local disk never pays the resident cost of the S3 client's module tree.
 *
 * The same class serves any S3-compatible store (MinIO, Wasabi) — only the
 * endpoint differs.
 */

import { Readable } from 'stream';
import {
  StorageError,
  isNotFoundError,
  type ListOptions,
  type PutOptions,
  type StorageDriver,
  type StorageObjectMeta,
} from './types';

export interface B2DriverOptions {
  endpoint: string;
  region: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  /** B2's S3 layer does not support virtual-hosted style for all bucket names. */
  forcePathStyle?: boolean;
  maxRetries?: number;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type S3Module = any;
let s3ModulePromise: Promise<S3Module> | null = null;

async function loadS3Module(): Promise<S3Module> {
  if (!s3ModulePromise) {
    s3ModulePromise = import('@aws-sdk/client-s3').catch(() => {
      throw new StorageError(
        'Object storage is selected but @aws-sdk/client-s3 is not installed. Run: npm install @aws-sdk/client-s3',
        'SDK_MISSING',
        503,
      );
    });
  }
  return s3ModulePromise;
}

/** Strip the quotes providers wrap around an ETag. */
function unquote(etag: string | undefined): string {
  return (etag ?? '').replace(/"/g, '');
}

export class B2StorageDriver implements StorageDriver {
  readonly kind = 'b2' as const;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private clientPromise: Promise<any> | null = null;

  constructor(private readonly opts: B2DriverOptions) {}

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private async client(): Promise<any> {
    if (!this.clientPromise) {
      this.clientPromise = (async () => {
        const { S3Client } = await loadS3Module();
        return new S3Client({
          endpoint: this.opts.endpoint,
          region: this.opts.region,
          credentials: {
            accessKeyId: this.opts.accessKeyId,
            secretAccessKey: this.opts.secretAccessKey,
          },
          forcePathStyle: this.opts.forcePathStyle ?? true,
          maxAttempts: this.opts.maxRetries ?? 5,
        });
      })();
    }
    return this.clientPromise;
  }

  async head(key: string): Promise<StorageObjectMeta | null> {
    const { HeadObjectCommand } = await loadS3Module();
    const c = await this.client();
    try {
      const r = await c.send(new HeadObjectCommand({ Bucket: this.opts.bucket, Key: key }));
      return {
        key,
        sizeBytes: Number(r.ContentLength ?? 0),
        etag: unquote(r.ETag),
        lastModified: r.LastModified ?? new Date(),
        contentType: r.ContentType,
      };
    } catch (err) {
      // A HEAD on a missing key THROWS rather than returning a falsy result.
      if (isNotFoundError(err)) return null;
      throw err;
    }
  }

  async get(key: string): Promise<{ body: Readable; meta: StorageObjectMeta }> {
    const { GetObjectCommand } = await loadS3Module();
    const c = await this.client();
    try {
      const r = await c.send(new GetObjectCommand({ Bucket: this.opts.bucket, Key: key }));
      return {
        body: r.Body as Readable,
        meta: {
          key,
          sizeBytes: Number(r.ContentLength ?? 0),
          etag: unquote(r.ETag),
          lastModified: r.LastModified ?? new Date(),
          contentType: r.ContentType,
        },
      };
    } catch (err) {
      if (isNotFoundError(err)) throw new StorageError(`Object not found: ${key}`, 'NOT_FOUND', 404);
      throw err;
    }
  }

  async put(key: string, body: Buffer, opts?: PutOptions): Promise<StorageObjectMeta> {
    const { PutObjectCommand } = await loadS3Module();
    const c = await this.client();
    const r = await c.send(new PutObjectCommand({
      Bucket: this.opts.bucket,
      Key: key,
      Body: body,
      // Only set what the caller supplied. Synthesising a Content-Type here is
      // what breaks presigned PUTs in the reference; keeping the same
      // discipline costs nothing and avoids surprising the provider.
      ...(opts?.contentType ? { ContentType: opts.contentType } : {}),
      ...(opts?.metadata ? { Metadata: opts.metadata } : {}),
    }));
    return {
      key,
      sizeBytes: body.length,
      etag: unquote(r.ETag),
      lastModified: new Date(),
      contentType: opts?.contentType,
    };
  }

  async delete(key: string): Promise<void> {
    const { DeleteObjectCommand } = await loadS3Module();
    const c = await this.client();
    await c.send(new DeleteObjectCommand({ Bucket: this.opts.bucket, Key: key }));
  }

  async copy(sourceKey: string, destKey: string): Promise<StorageObjectMeta> {
    const { CopyObjectCommand } = await loadS3Module();
    const c = await this.client();
    // encodeURIComponent turns '/' into '%2F', which B2 cannot resolve — every
    // nested key would 404 with NoSuchKey. Encode each segment separately and
    // rejoin with literal slashes.
    const encodedSource = sourceKey.split('/').map(encodeURIComponent).join('/');
    await c.send(new CopyObjectCommand({
      Bucket: this.opts.bucket,
      Key: destKey,
      CopySource: `${this.opts.bucket}/${encodedSource}`,
    }));
    const meta = await this.head(destKey);
    if (!meta) throw new StorageError(`Copy succeeded but ${destKey} is not readable`, 'COPY_VERIFY_FAILED', 502);
    return meta;
  }

  async *list(prefix: string, opts?: ListOptions): AsyncIterable<StorageObjectMeta> {
    const { ListObjectsV2Command } = await loadS3Module();
    const c = await this.client();
    const limit = opts?.limit ?? Infinity;
    let yielded = 0;
    let token: string | undefined;
    do {
      // No Delimiter: we want every object under the prefix, not CommonPrefixes.
      const r = await c.send(new ListObjectsV2Command({
        Bucket: this.opts.bucket,
        Prefix: prefix,
        ContinuationToken: token,
      }));
      for (const o of r.Contents ?? []) {
        if (!o.Key) continue;
        yield {
          key: o.Key,
          sizeBytes: Number(o.Size ?? 0),
          etag: unquote(o.ETag),
          lastModified: o.LastModified ?? new Date(),
        };
        if (++yielded >= limit) return;
      }
      token = r.IsTruncated ? r.NextContinuationToken : undefined;
    } while (token);
  }

  describe(): string {
    return `b2 ${this.opts.bucket} @ ${this.opts.endpoint}`;
  }
}

/**
 * Translate the provider's opaque failures into something an admin can act on.
 * The first case is the single most common setup mistake: pointing at the
 * native B2 API host, which answers JSON where the S3 client expects XML.
 */
export function explainStorageError(err: unknown): string {
  const e = err as {
    name?: string;
    message?: string;
    Code?: string;
    $metadata?: { httpStatusCode?: number };
  };
  const msg = String(e?.message ?? err ?? '');
  const name = String(e?.name ?? '');
  const code = String(e?.Code ?? '');
  const status = e?.$metadata?.httpStatusCode;
  // A HEAD carries no response body, so the SDK cannot parse an error code out
  // of it and reports a bare "UnknownError". Status and name are all we get
  // there, which is why the health probe leads with list() instead.
  const hay = `${name} ${code} ${msg}`;

  if (/ENOTFOUND|EAI_AGAIN|ECONNREFUSED|ETIMEDOUT|ECONNRESET|socket hang up/i.test(hay)) {
    return `Could not reach the storage endpoint (${msg}). Check the URL and network access.`;
  }
  if (/is not expected|Deserialization|Unexpected token|non-whitespace|InvalidToken|not valid XML/i.test(hay)) {
    return 'The storage endpoint returned a non-S3 response. Use the S3-compatible host, e.g. https://s3.<region>.backblazeb2.com — not the native B2 API URL.';
  }
  if (/InvalidAccessKeyId|SignatureDoesNotMatch|AccessDenied|Unauthorized|Forbidden/i.test(hay) || status === 403) {
    return 'Authentication failed. Check the key ID and application key, and that the key is scoped to this bucket.';
  }
  if (/NoSuchBucket/i.test(hay)) {
    // A wrong endpoint often presents identically to a wrong bucket name, so
    // name both causes — an admin told only "bucket not found" while the real
    // fault is the endpoint has nowhere to go.
    return 'Bucket not found. Check the bucket name, and that the endpoint is the S3-compatible host (e.g. https://s3.<region>.backblazeb2.com) rather than the native B2 API URL.';
  }
  if (status === 404) {
    return 'The endpoint responded 404. Check the bucket name, and that the endpoint is the S3-compatible host rather than the native B2 API URL.';
  }
  if (status === 400) {
    return `The endpoint rejected the request (400). Check the region matches the endpoint.${msg ? ` Detail: ${msg}` : ''}`;
  }
  return msg || name || 'Unknown storage error.';
}
