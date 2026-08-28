// Copyright 2025-2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Use is limited to qualifying small businesses. See LICENSE for terms.

/**
 * The folder sentinel — a small JSON file at `<clientFolder>/_Vibe/client.json`
 * that carries the client's identity.
 *
 * Why it exists: identity is anchored in the sentinel, NOT the path. A folder
 * renamed in the B2 console or a mounted drive would otherwise orphan every key
 * that references it; with a sentinel, a verify pass reads the file and re-binds
 * the row to the folder's new path. It also disambiguates two clients that share
 * a name, which this schema permits (`clients.name` has no unique index).
 *
 * `install_id` replaces the reference's `firm_id`. This app is single-tenant —
 * no firms or tenants tables — so a folder belonging to a *different install*
 * (two deployments sharing a bucket, or a folder left by a restored instance
 * whose client ids mean something else) is detected by comparing a UUID minted
 * once into settings.
 *
 * Reading returns a discriminated union rather than throwing, so a corrupt or
 * foreign sentinel becomes a message in the UI, never a crash and never a
 * silent overwrite.
 */

import { z } from 'zod';
import { joinPath } from './paths';
import { isNotFoundError, type StorageDriver } from './types';

export const SENTINEL_FOLDER = '_Vibe';
export const SENTINEL_FILE = 'client.json';

export const SentinelV1 = z.object({
  version: z.literal(1),
  app: z.literal('vibe-tb'),
  sentinel_id: z.string().min(1).max(64),
  client_id: z.number().int().positive(),
  install_id: z.string().min(1).max(64),
  display_name_at_creation: z.string(),
  created_at: z.string(),
  created_by: z.number().int().positive().nullable(),
});
export type SentinelV1 = z.infer<typeof SentinelV1>;

/** `<clientFolder>/_Vibe/client.json` */
export function sentinelKey(folderPath: string): string {
  return joinPath(folderPath, SENTINEL_FOLDER, SENTINEL_FILE);
}

export type ReadSentinelResult =
  | { ok: true; payload: SentinelV1; etag: string }
  | { ok: false; reason: 'missing' }
  | { ok: false; reason: 'unparseable'; error: string }
  | { ok: false; reason: 'schema_invalid'; error: string }
  | { ok: false; reason: 'wrong_install'; payload: SentinelV1 };

async function drain(stream: NodeJS.ReadableStream): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const c of stream) chunks.push(Buffer.from(c as Buffer));
  return Buffer.concat(chunks);
}

/**
 * Read and validate the sentinel. `expectedInstallId` is opt-in: the verify and
 * scan paths pass it; a plain read that only wants the client id does not.
 */
export async function readSentinel(
  driver: StorageDriver,
  folderPath: string,
  opts: { expectedInstallId?: string } = {},
): Promise<ReadSentinelResult> {
  const key = sentinelKey(folderPath);
  let body: Buffer;
  let etag: string;
  try {
    const r = await driver.get(key);
    etag = r.meta.etag;
    body = await drain(r.body);
  } catch (err) {
    // Providers signal a miss differently; anything else is a real fault and
    // must not be swallowed into "missing".
    if (isNotFoundError(err)) return { ok: false, reason: 'missing' };
    throw err;
  }

  let raw: unknown;
  try {
    raw = JSON.parse(body.toString('utf8'));
  } catch (err) {
    return { ok: false, reason: 'unparseable', error: (err as Error).message };
  }

  const parsed = SentinelV1.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, reason: 'schema_invalid', error: parsed.error.message };
  }
  if (opts.expectedInstallId && parsed.data.install_id !== opts.expectedInstallId) {
    return { ok: false, reason: 'wrong_install', payload: parsed.data };
  }
  return { ok: true, payload: parsed.data, etag };
}

/** Convenience for callers that only care about a valid sentinel or nothing. */
export async function tryReadSentinel(
  driver: StorageDriver,
  folderPath: string,
): Promise<SentinelV1 | null> {
  const r = await readSentinel(driver, folderPath);
  return r.ok ? r.payload : null;
}

/**
 * Write a sentinel. Used when a folder is first bound to a client, and by the
 * admin reassign path. The caller is responsible for having checked that no
 * sentinel for a *different* client already sits there.
 */
export async function writeSentinel(
  driver: StorageDriver,
  folderPath: string,
  payload: SentinelV1,
): Promise<{ etag: string }> {
  const validated = SentinelV1.parse(payload);
  const body = Buffer.from(`${JSON.stringify(validated, null, 2)}\n`, 'utf8');
  const meta = await driver.put(sentinelKey(folderPath), body, {
    contentType: 'application/json',
    metadata: { 'vibe-sentinel-version': String(validated.version) },
  });
  return { etag: meta.etag };
}

/**
 * Partial update — refreshing the display name after a client rename, for
 * instance.
 *
 * `client_id` and `install_id` are immutable, enforced three ways: the
 * parameter type forbids them, a runtime check throws before any I/O, and the
 * merged object re-pins both from the current payload. Re-pointing a folder at
 * a different client must go through writeSentinel from the one admin path
 * that is allowed to do it.
 *
 * Refuses to run when the current sentinel is not `ok`, so a corrupt file can
 * never be silently repaired into a valid one for the wrong client.
 */
export async function updateSentinel(
  driver: StorageDriver,
  folderPath: string,
  partial: Partial<Omit<SentinelV1, 'client_id' | 'install_id'>> & {
    client_id?: never;
    install_id?: never;
  },
): Promise<{ etag: string; payload: SentinelV1 }> {
  if ('client_id' in partial && partial.client_id !== undefined) {
    throw new Error('updateSentinel: client_id is immutable — use writeSentinel to bind a fresh folder.');
  }
  if ('install_id' in partial && partial.install_id !== undefined) {
    throw new Error('updateSentinel: install_id is immutable.');
  }
  const current = await readSentinel(driver, folderPath);
  if (!current.ok) {
    throw new Error(`updateSentinel: cannot update — sentinel state is ${current.reason}`);
  }
  const next: SentinelV1 = {
    ...current.payload,
    ...partial,
    client_id: current.payload.client_id,
    install_id: current.payload.install_id,
  };
  const { etag } = await writeSentinel(driver, folderPath, next);
  return { etag, payload: next };
}
