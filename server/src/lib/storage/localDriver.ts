// Copyright 2025-2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Use is limited to qualifying small businesses. See LICENSE for terms.

/**
 * Local-disk storage driver — the default, and what every existing install
 * uses. Adapted from Vibe Time & Billing's mock driver, but this is a
 * production backend here, not a dev stand-in.
 *
 * Notable differences from the reference:
 *   - No presign machinery. Uploads and downloads stream through the API so
 *     they stay behind authMiddleware; at this app's 25 MB cap the round trip
 *     costs little, and it avoids a bucket-CORS requirement that would break
 *     silently every time a LAN deployment's IP changed.
 *   - ETags are SHA-256 hex kept in a `.__etag` sidecar, so `head()` is cheap
 *     and doesn't re-read the file. Sidecars are filtered out of `list()`.
 */

import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { Readable } from 'stream';
import {
  StorageError,
  isNotFoundError,
  type ListOptions,
  type PutOptions,
  type StorageDriver,
  type StorageObjectMeta,
} from './types';

const ETAG_SUFFIX = '.__etag';

export class LocalStorageDriver implements StorageDriver {
  readonly kind = 'local' as const;

  constructor(private readonly root: string) {}

  /**
   * Resolve a key under the root, refusing anything that escapes it. This is
   * the same guard documents.ts already applies to downloads; keeping it in the
   * driver means every caller inherits it.
   */
  private resolveKey(key: string): string {
    const normalized = key.replace(/\\/g, '/').replace(/^\/+/, '');
    if (normalized.split('/').some((seg) => seg === '..')) {
      throw new StorageError(`Invalid storage key: ${key}`, 'INVALID_KEY', 400);
    }
    const abs = path.resolve(this.root, normalized);
    const rel = path.relative(this.root, abs);
    if (rel.startsWith('..') || path.isAbsolute(rel)) {
      throw new StorageError(`Storage key escapes the root: ${key}`, 'INVALID_KEY', 400);
    }
    return abs;
  }

  private async readEtag(abs: string): Promise<string> {
    try {
      return (await fs.promises.readFile(`${abs}${ETAG_SUFFIX}`, 'utf8')).trim();
    } catch {
      // Missing sidecar (a file written before this driver existed): hash on
      // demand and write the sidecar so the next read is cheap.
      const buf = await fs.promises.readFile(abs);
      const etag = crypto.createHash('sha256').update(buf).digest('hex');
      await fs.promises.writeFile(`${abs}${ETAG_SUFFIX}`, etag, 'utf8').catch(() => undefined);
      return etag;
    }
  }

  async head(key: string): Promise<StorageObjectMeta | null> {
    const abs = this.resolveKey(key);
    try {
      const st = await fs.promises.stat(abs);
      if (!st.isFile()) return null;
      return {
        key,
        sizeBytes: st.size,
        etag: await this.readEtag(abs),
        lastModified: st.mtime,
      };
    } catch (err) {
      if (isNotFoundError(err)) return null;
      throw err;
    }
  }

  async get(key: string): Promise<{ body: Readable; meta: StorageObjectMeta }> {
    const meta = await this.head(key);
    if (!meta) throw new StorageError(`Object not found: ${key}`, 'NOT_FOUND', 404);
    // Streamed, not buffered — the Pi's heap is the constraint here.
    return { body: fs.createReadStream(this.resolveKey(key)), meta };
  }

  async put(key: string, body: Buffer, _opts?: PutOptions): Promise<StorageObjectMeta> {
    const abs = this.resolveKey(key);
    await fs.promises.mkdir(path.dirname(abs), { recursive: true });
    await fs.promises.writeFile(abs, body);
    const etag = crypto.createHash('sha256').update(body).digest('hex');
    await fs.promises.writeFile(`${abs}${ETAG_SUFFIX}`, etag, 'utf8');
    return { key, sizeBytes: body.length, etag, lastModified: new Date() };
  }

  async delete(key: string): Promise<void> {
    const abs = this.resolveKey(key);
    await fs.promises.rm(abs, { force: true });
    await fs.promises.rm(`${abs}${ETAG_SUFFIX}`, { force: true });
  }

  async copy(sourceKey: string, destKey: string): Promise<StorageObjectMeta> {
    const src = this.resolveKey(sourceKey);
    const dest = this.resolveKey(destKey);
    await fs.promises.mkdir(path.dirname(dest), { recursive: true });
    await fs.promises.copyFile(src, dest);
    const etag = await this.readEtag(src);
    await fs.promises.writeFile(`${dest}${ETAG_SUFFIX}`, etag, 'utf8').catch(() => undefined);
    const st = await fs.promises.stat(dest);
    return { key: destKey, sizeBytes: st.size, etag, lastModified: st.mtime };
  }

  async *list(prefix: string, opts?: ListOptions): AsyncIterable<StorageObjectMeta> {
    const limit = opts?.limit ?? Infinity;
    let yielded = 0;
    const normalized = prefix.replace(/\\/g, '/').replace(/^\/+/, '');
    // Walk from the deepest existing ancestor so a prefix that is a partial
    // segment (e.g. "clients/Acme") still matches.
    const startDir = path.resolve(this.root, normalized.endsWith('/') ? normalized : path.dirname(normalized));

    const walk = async function* (this: LocalStorageDriver, dir: string): AsyncIterable<string> {
      let entries: fs.Dirent[];
      try {
        entries = await fs.promises.readdir(dir, { withFileTypes: true });
      } catch (err) {
        if (isNotFoundError(err)) return;
        throw err;
      }
      for (const e of entries) {
        const abs = path.join(dir, e.name);
        if (e.isDirectory()) {
          yield* walk.call(this, abs);
        } else if (e.isFile() && !e.name.endsWith(ETAG_SUFFIX)) {
          yield abs;
        }
      }
    };

    for await (const abs of walk.call(this, startDir)) {
      const key = path.relative(this.root, abs).replace(/\\/g, '/');
      if (!key.startsWith(normalized)) continue;
      const meta = await this.head(key);
      if (meta) {
        yield meta;
        if (++yielded >= limit) return;
      }
    }
  }

  describe(): string {
    return `local disk (${this.root})`;
  }
}
