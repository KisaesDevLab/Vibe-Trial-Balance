// Copyright 2025-2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Use is limited to qualifying small businesses. See LICENSE for terms.

/**
 * Client ↔ storage-folder binding.
 *
 * Linking is explicit: nothing is auto-created, and an upload for an unlinked
 * client is refused. The binding is what every later object key depends on, so
 * it gets reviewed once rather than appearing as a side effect.
 *
 * Ordering rule throughout: STORAGE FIRST, then the DB. If the sentinel is
 * written and the DB transaction then fails, the result is an orphaned sentinel
 * that a later verify adopts — self-healing. The reverse ordering would lose
 * the binding instead.
 */

import crypto from 'crypto';
import type { Knex } from 'knex';
import { db } from '../db';
import { getStorageConfig, getStorageDriver, getStorageDriverFor } from './storage';
import { clientFolderPath, clientFolderName } from './storage/keys';
import { folderBasename, joinPath, normalizeTopPrefix, sanitizeForWindows } from './storage/paths';
import { readSentinel, writeSentinel, sentinelKey, type SentinelV1 } from './storage/sentinel';
import { StorageError, type StorageDriver } from './storage/types';

export interface ClientFolderLink {
  id: number;
  client_id: number;
  storage_backend: 'local' | 'b2';
  storage_path: string;
  sentinel_id: string | null;
  is_legacy_layout: boolean;
  status: 'active' | 'missing' | 'conflict';
  last_verified_at: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * The install's own id, minted once and stored in settings. This is what lets a
 * folder written by a *different* deployment be recognised rather than adopted.
 */
export async function getInstallId(q: Knex | Knex.Transaction = db): Promise<string> {
  const row = await q('settings').where({ key: 'storage.install_id' }).first('value');
  if (row?.value) return row.value as string;
  const id = crypto.randomUUID();
  // ignore(), not merge(): merge would let a concurrent first-time caller
  // overwrite an id another caller has already returned and stamped into a
  // sentinel — that folder would then read back as wrong_install forever.
  await q('settings')
    .insert({ key: 'storage.install_id', value: id, updated_at: q.fn.now() })
    .onConflict('key')
    .ignore();
  // Re-read: whoever won the insert owns the id.
  const stored = await q('settings').where({ key: 'storage.install_id' }).first('value');
  return (stored?.value as string | undefined) ?? id;
}

export async function getLink(clientId: number, q: Knex | Knex.Transaction = db): Promise<ClientFolderLink | null> {
  return (await q('client_folder_links').where({ client_id: clientId }).first()) ?? null;
}

/**
 * The link an upload must have. Throws 409 CLIENT_NOT_LINKED rather than
 * inventing a folder, so the failure is actionable instead of silent.
 */
export async function requireLink(clientId: number, q: Knex | Knex.Transaction = db): Promise<ClientFolderLink> {
  const link = await getLink(clientId, q);
  if (!link) {
    throw new StorageError(
      'This client has no storage folder yet. Link or create one before uploading.',
      'CLIENT_NOT_LINKED',
      409,
    );
  }
  return link;
}

/** Folders under the prefix that no client is bound to. */
export async function listUnboundFolders(): Promise<Array<{ path: string; name: string; hasSentinel: boolean; boundToClientId: number | null }>> {
  const cfg = await getStorageConfig();
  const driver = await getStorageDriver();
  const prefix = normalizeTopPrefix(cfg.prefix);

  // Distinct first path segment under the prefix. There is no delimiter walk in
  // the driver contract, so derive folders from the keys themselves.
  const seen = new Set<string>();
  for await (const obj of driver.list(prefix, { limit: 5000 })) {
    const rest = obj.key.slice(prefix.length);
    const slash = rest.indexOf('/');
    if (slash > 0) seen.add(rest.slice(0, slash));
  }

  const links = await db('client_folder_links').select('client_id', 'storage_path');
  const boundByPath = new Map<string, number>(
    (links as Array<{ client_id: number; storage_path: string }>).map((l) => [l.storage_path, l.client_id]),
  );

  const out: Array<{ path: string; name: string; hasSentinel: boolean; boundToClientId: number | null }> = [];
  for (const name of [...seen].sort()) {
    const path = `${prefix}${name}/`;
    const sentinel = await readSentinel(driver, path);
    out.push({
      path,
      name,
      hasSentinel: sentinel.ok,
      boundToClientId: boundByPath.get(path) ?? (sentinel.ok ? sentinel.payload.client_id : null),
    });
  }
  return out;
}

export interface LinkResult {
  ok: true;
  link: ClientFolderLink;
  created: boolean;
  idempotent: boolean;
}

export interface LinkConflict {
  ok: false;
  code: 'FOLDER_ALREADY_BOUND' | 'CLIENT_ALREADY_BOUND' | 'WRONG_INSTALL' | 'SENTINEL_UNREADABLE';
  message: string;
  boundToClientId?: number;
  boundToClientName?: string;
}

/**
 * Bind a client to an existing folder.
 *
 * A folder whose sentinel names a different client is BLOCKED: nothing is
 * written to storage and no row is touched. Blocking is the whole behaviour —
 * silently re-pointing a folder would strand the other client's documents.
 */
export async function linkClientFolder(
  clientId: number,
  storagePath: string,
  userId: number | null,
): Promise<LinkResult | LinkConflict> {
  const client = await db('clients').where({ id: clientId }).first('id', 'name');
  if (!client) throw new StorageError('Client not found', 'NOT_FOUND', 404);

  const path = storagePath.endsWith('/') ? storagePath : `${storagePath}/`;
  const cfg = await getStorageConfig();
  const driver = await getStorageDriver();
  const installId = await getInstallId();

  const existing = await getLink(clientId);
  if (existing && existing.storage_path !== path) {
    return {
      ok: false,
      code: 'CLIENT_ALREADY_BOUND',
      message: `This client is already linked to ${existing.storage_path}. Unlink it first.`,
    };
  }

  const sentinel = await readSentinel(driver, path, { expectedInstallId: installId });

  if (sentinel.ok && sentinel.payload.client_id !== clientId) {
    const other = await db('clients').where({ id: sentinel.payload.client_id }).first('id', 'name');
    return {
      ok: false,
      code: 'FOLDER_ALREADY_BOUND',
      message: `That folder already belongs to ${other?.name ?? 'another client'}.`,
      boundToClientId: sentinel.payload.client_id,
      boundToClientName: (other?.name as string | undefined) ?? undefined,
    };
  }
  if (!sentinel.ok && sentinel.reason === 'wrong_install') {
    return {
      ok: false,
      code: 'WRONG_INSTALL',
      message: 'That folder was created by a different Vibe TB installation. Linking it here could mix up two firms\' documents.',
    };
  }
  if (!sentinel.ok && (sentinel.reason === 'unparseable' || sentinel.reason === 'schema_invalid')) {
    return {
      ok: false,
      code: 'SENTINEL_UNREADABLE',
      message: 'That folder has a marker file this app cannot read. Resolve it before linking.',
    };
  }

  // Already ours: idempotent re-link, no storage write.
  if (sentinel.ok && sentinel.payload.client_id === clientId) {
    const link = existing ?? (await insertLink(clientId, cfg.provider, path, sentinel.payload.sentinel_id, userId));
    return { ok: true, link, created: false, idempotent: true };
  }

  // No sentinel: write it FIRST, then record the row.
  const payload: SentinelV1 = {
    version: 1,
    app: 'vibe-tb',
    sentinel_id: crypto.randomUUID(),
    client_id: clientId,
    install_id: installId,
    display_name_at_creation: client.name as string,
    created_at: new Date().toISOString(),
    created_by: userId,
  };
  await writeSentinel(driver, path, payload);
  const link = existing
    ? await touchLink(existing.id, { sentinel_id: payload.sentinel_id, is_legacy_layout: false, status: 'active' })
    : await insertLink(clientId, cfg.provider, path, payload.sentinel_id, userId);
  return { ok: true, link, created: false, idempotent: false };
}

/** Create a fresh folder for a client and bind it. */
export async function createClientFolder(
  clientId: number,
  folderName: string | null,
  userId: number | null,
): Promise<LinkResult | LinkConflict> {
  const client = await db('clients').where({ id: clientId }).first('id', 'name', 'client_code');
  if (!client) throw new StorageError('Client not found', 'NOT_FOUND', 404);

  const existing = await getLink(clientId);
  if (existing) {
    return {
      ok: false,
      code: 'CLIENT_ALREADY_BOUND',
      message: `This client is already linked to ${existing.storage_path}.`,
    };
  }

  const cfg = await getStorageConfig();
  const prefix = normalizeTopPrefix(cfg.prefix);
  const base = folderName
    ? sanitizeForWindows(folderName)
    : clientFolderName(
        { id: clientId, name: client.name as string, code: client.client_code as string | null },
        cfg.clientFolderFormat,
      );

  // Walk for a free name rather than failing on a collision.
  const driver = await getStorageDriver();
  const installId = await getInstallId();
  let path: string | null = null;
  for (let i = 1; i <= 9 && !path; i++) {
    const candidate = `${joinPath(prefix, i === 1 ? base : `${base} (${i})`)}/`;
    const s = await readSentinel(driver, candidate);
    if (!s.ok && s.reason === 'missing') path = candidate;
    else if (s.ok && s.payload.client_id === clientId) path = candidate; // adopt a half-finished link
  }
  if (!path) {
    return { ok: false, code: 'FOLDER_ALREADY_BOUND', message: 'Could not find a free folder name — try a different one.' };
  }

  const payload: SentinelV1 = {
    version: 1,
    app: 'vibe-tb',
    sentinel_id: crypto.randomUUID(),
    client_id: clientId,
    install_id: installId,
    display_name_at_creation: client.name as string,
    created_at: new Date().toISOString(),
    created_by: userId,
  };
  await writeSentinel(driver, path, payload);
  const link = await insertLink(clientId, cfg.provider, path, payload.sentinel_id, userId);
  return { ok: true, link, created: true, idempotent: false };
}

export interface VerifyResult {
  status: 'active' | 'missing' | 'conflict';
  message: string;
  /** Set when the folder was found at a new path and the row was re-bound. */
  rebound?: { from: string; to: string };
}

/**
 * Confirm the binding still holds, and follow a rename.
 *
 * This is the payoff for having a sentinel at all: if the folder was renamed
 * outside the app, its sentinel is found at the new path and the row is
 * re-pointed, instead of the binding silently breaking.
 */
export async function verifyClientFolder(clientId: number): Promise<VerifyResult> {
  const link = await getLink(clientId);
  if (!link) throw new StorageError('This client has no storage folder.', 'CLIENT_NOT_LINKED', 409);

  // Legacy rows predate the sentinel scheme; there is nothing to verify.
  if (link.is_legacy_layout) {
    return { status: 'active', message: 'Using the original per-client upload folder. Migrate it to the folder layout when convenient.' };
  }

  const driver = await getStorageDriverFor(link.storage_backend);
  const installId = await getInstallId();
  const at = await readSentinel(driver, link.storage_path, { expectedInstallId: installId });

  if (at.ok && at.payload.client_id === clientId) {
    await touchLink(link.id, { status: 'active', last_verified_at: db.fn.now() });
    return { status: 'active', message: 'Folder verified.' };
  }
  if (at.ok && at.payload.client_id !== clientId) {
    await touchLink(link.id, { status: 'conflict' });
    return { status: 'conflict', message: 'The folder at this path now belongs to a different client.' };
  }

  // Not at the recorded path — look for our sentinel elsewhere under the prefix.
  const moved = await findFolderBySentinel(driver, clientId, installId);
  if (moved) {
    const from = link.storage_path;
    await touchLink(link.id, { storage_path: moved, status: 'active', last_verified_at: db.fn.now() });
    return {
      status: 'active',
      message: `The folder was renamed. Re-bound to ${folderBasename(moved)}.`,
      rebound: { from, to: moved },
    };
  }

  await touchLink(link.id, { status: 'missing' });
  return { status: 'missing', message: 'The folder could not be found in storage. It may have been deleted or moved outside the prefix.' };
}

/** Scan the prefix for a folder whose sentinel names this client. */
async function findFolderBySentinel(
  driver: StorageDriver,
  clientId: number,
  installId: string,
): Promise<string | null> {
  const cfg = await getStorageConfig();
  const prefix = normalizeTopPrefix(cfg.prefix);
  const suffix = `/${sentinelKey('').replace(/^\/+/, '')}`;
  for await (const obj of driver.list(prefix, { limit: 20000 })) {
    if (!obj.key.endsWith(suffix)) continue;
    const folder = obj.key.slice(0, obj.key.length - suffix.length + 1);
    const s = await readSentinel(driver, folder, { expectedInstallId: installId });
    if (s.ok && s.payload.client_id === clientId) return folder;
  }
  return null;
}

/** Remove the binding. The folder and its contents are left alone. */
export async function unlinkClientFolder(clientId: number): Promise<{ removed: number }> {
  const removed = await db('client_folder_links').where({ client_id: clientId }).delete();
  return { removed };
}

// ─── internals ───────────────────────────────────────────────────────────────

async function insertLink(
  clientId: number,
  backend: 'local' | 'b2',
  path: string,
  sentinelId: string | null,
  userId: number | null,
): Promise<ClientFolderLink> {
  const [row] = await db('client_folder_links').insert({
    client_id: clientId,
    storage_backend: backend,
    storage_path: path,
    sentinel_id: sentinelId,
    is_legacy_layout: false,
    status: 'active',
    last_verified_at: db.fn.now(),
    created_by: userId,
  }).returning('*');
  return row as ClientFolderLink;
}

async function touchLink(id: number, updates: Record<string, unknown>): Promise<ClientFolderLink> {
  const [row] = await db('client_folder_links')
    .where({ id })
    .update({ ...updates, updated_at: db.fn.now() })
    .returning('*');
  return row as ClientFolderLink;
}

/** The default path a client's folder would get, for the "create" preview. */
export async function suggestedFolderPath(clientId: number, name: string): Promise<string> {
  const cfg = await getStorageConfig();
  const client = await db('clients').where({ id: clientId }).first('client_code');
  return clientFolderPath(
    cfg.prefix,
    { id: clientId, name, code: (client?.client_code as string | null) ?? null },
    cfg.clientFolderFormat,
  );
}
