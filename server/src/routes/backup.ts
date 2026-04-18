// Copyright 2025-2026 Kisaes LLC
// Licensed under the PolyForm Internal Use License 1.0.0.
// You may not distribute this software. See LICENSE for terms.

/**
 * Phase 17: Backup & Restore System
 *
 * POST /api/v1/backup/full                    -> create full backup
 * POST /api/v1/backup/settings                -> create settings backup
 * POST /api/v1/backup/client/:clientId        -> create client backup
 * POST /api/v1/backup/period/:periodId        -> create period backup
 * GET  /api/v1/backup/history                 -> list backups
 * GET  /api/v1/backup/:backupId/download      -> download .tbak file
 * DELETE /api/v1/backup/:backupId             -> delete backup
 * POST /api/v1/restore/upload                 -> upload & preview
 * POST /api/v1/restore/execute                -> execute restore
 * GET  /api/v1/restore/history                -> list restore history
 */
import { Router, Response, Request, NextFunction } from 'express';
import archiver from 'archiver';
import unzipper from 'unzipper';
import multer from 'multer';
import rateLimit from 'express-rate-limit';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import cron from 'node-cron';
import { db } from '../db';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import type { Knex } from 'knex';
import { sendServerError } from '../lib/safeError';

// ─────────────────────────────────────────────────────────────────────────────
// Restore upload session cache
//
// When an admin uploads a .tbak via /restore/upload we stage it under TEMP_DIR
// and hand back a basename. /restore/execute then resolves that basename and runs
// the restore. Without binding, any admin (or any admin session with a CSRF-ish
// vector) could point execute at another admin's staged file. We therefore
// associate each staged file with (uploaderId, randomNonce) and require the
// executing admin to supply both a matching nonce and be the same uploader.
// ─────────────────────────────────────────────────────────────────────────────

interface RestoreUploadSession { uploaderId: number; nonce: string; expiresAt: number; }
const restoreUploadSessions = new Map<string, RestoreUploadSession>();
const UPLOAD_SESSION_TTL_MS = 60 * 60 * 1000; // 1 hour

function rememberUploadSession(tempBase: string, uploaderId: number, nonce: string): void {
  restoreUploadSessions.set(tempBase, { uploaderId, nonce, expiresAt: Date.now() + UPLOAD_SESSION_TTL_MS });
}
function consumeUploadSession(tempBase: string, uploaderId: number, nonce: string): boolean {
  const entry = restoreUploadSessions.get(tempBase);
  if (!entry) return false;
  if (entry.expiresAt < Date.now()) { restoreUploadSessions.delete(tempBase); return false; }
  if (entry.uploaderId !== uploaderId) return false;
  // Constant-time comparison on the nonce so a leaked filename can't be brute forced
  const a = Buffer.from(entry.nonce, 'utf8');
  const b = Buffer.from(String(nonce ?? ''), 'utf8');
  if (a.length !== b.length) return false;
  if (!crypto.timingSafeEqual(a, b)) return false;
  restoreUploadSessions.delete(tempBase);
  return true;
}
// Periodic sweep — cheap, no-op if the map is empty.
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of restoreUploadSessions) {
    if (v.expiresAt < now) restoreUploadSessions.delete(k);
  }
}, 10 * 60 * 1000).unref();

// ─────────────────────────────────────────────────────────────────────────────
// Directories
// ─────────────────────────────────────────────────────────────────────────────

const BACKUP_DIR = path.join(process.cwd(), 'backups');
const TEMP_DIR = path.join(BACKUP_DIR, 'temp');

fs.mkdirSync(BACKUP_DIR, { recursive: true });
fs.mkdirSync(TEMP_DIR, { recursive: true });

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

type BackupLevel = 'full' | 'settings' | 'client' | 'period';

interface BackupOptions {
  clientId?: number;
  periodId?: number;
  triggerType?: 'manual' | 'scheduled' | 'pre_restore';
}

interface BackupHistoryRow {
  id: number;
  backup_type: string;
  backup_level: string;
  client_id: number | null;
  client_name: string | null;
  period_id: number | null;
  period_name: string | null;
  filename: string;
  file_size: number | null;
  checksum: string | null;
  storage_local: string | null;
  trigger_type: string;
  status: string;
  error_message: string | null;
  record_counts: Record<string, number> | null;
  created_by: number | null;
  created_at: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Backup service
// ─────────────────────────────────────────────────────────────────────────────

async function createBackup(
  level: BackupLevel,
  options: BackupOptions,
  userId: number | null,
): Promise<BackupHistoryRow> {
  const { clientId, periodId, triggerType = 'manual' } = options;

  // Collect table data inside a REPEATABLE READ transaction so that every
  // SELECT sees the same snapshot — otherwise a user committing a JE or TB
  // edit mid-backup can produce an internally inconsistent archive.
  const tableData: Record<string, unknown[]> = {};
  const recordCounts: Record<string, number> = {};
  let clientName: string | null = null;
  let periodName: string | null = null;
  let username = 'system';

  await db.transaction(
    async (trx) => {
      async function dump(table: string, rows: unknown[]) {
        tableData[table] = rows;
        recordCounts[table] = rows.length;
      }

      // Resolve names inside the txn too so they stay consistent with the dump.
      if (clientId) {
        const c = await trx('clients').where('id', clientId).first('name');
        clientName = c?.name ?? null;
      }
      if (periodId) {
        const p = await trx('periods').where('id', periodId).first('period_name');
        periodName = p?.period_name ?? null;
      }
      if (userId) {
        const u = await trx('app_users').where('id', userId).first('username');
        username = u?.username ?? 'system';
      }

      if (level === 'full') {
        await dump('app_users', await trx('app_users').select('*'));
        await dump('clients', await trx('clients').select('*'));
        await dump('periods', await trx('periods').select('*'));
        await dump('chart_of_accounts', await trx('chart_of_accounts').select('*'));
        await dump('trial_balance', await trx('trial_balance').select('*'));
        await dump('journal_entries', await trx('journal_entries').select('*'));
        await dump('journal_entry_lines', await trx('journal_entry_lines').select('*'));
        await dump('bank_transactions', await trx('bank_transactions').select('*'));
        await dump('classification_rules', await trx('classification_rules').select('*'));
        await dump('variance_notes', await trx('variance_notes').select('*'));
        await dump('document_imports', await trx('document_imports').select('*'));
        await dump('tax_codes', await trx('tax_codes').select('*'));
        await dump('tax_code_software_maps', await trx('tax_code_software_maps').select('*'));
        const hasSettings = await trx.schema.hasTable('app_settings');
        if (hasSettings) {
          await dump('app_settings', await trx('app_settings').select('*'));
        }
      } else if (level === 'settings') {
        await dump('tax_codes', await trx('tax_codes').select('*'));
        await dump('tax_code_software_maps', await trx('tax_code_software_maps').select('*'));
        await dump('app_users', await trx('app_users').select('*'));
        const hasSettings = await trx.schema.hasTable('app_settings');
        if (hasSettings) {
          await dump('app_settings', await trx('app_settings').select('*'));
        }
      } else if (level === 'client' && clientId) {
        const client = await trx('clients').where('id', clientId).select('*');
        await dump('clients', client);
        const periodRows = await trx('periods').where('client_id', clientId).select('*');
        await dump('periods', periodRows);
        const periodIds = periodRows.map((p: { id: number }) => p.id);
        await dump('chart_of_accounts', await trx('chart_of_accounts').where('client_id', clientId).select('*'));
        const coaRows = await trx('chart_of_accounts').where('client_id', clientId).select('id');
        const coaIds = coaRows.map((r: { id: number }) => r.id);
        await dump('trial_balance', periodIds.length > 0 ? await trx('trial_balance').whereIn('period_id', periodIds).select('*') : []);
        await dump('journal_entries', periodIds.length > 0 ? await trx('journal_entries').whereIn('period_id', periodIds).select('*') : []);
        const jeRows = periodIds.length > 0 ? await trx('journal_entries').whereIn('period_id', periodIds).select('id') : [];
        const jeIds = jeRows.map((r: { id: number }) => r.id);
        await dump('journal_entry_lines', jeIds.length > 0 ? await trx('journal_entry_lines').whereIn('journal_entry_id', jeIds).select('*') : []);
        await dump('bank_transactions', await trx('bank_transactions').where('client_id', clientId).select('*'));
        await dump('classification_rules', await trx('classification_rules').where('client_id', clientId).select('*'));
        await dump('variance_notes', coaIds.length > 0 ? await trx('variance_notes').whereIn('account_id', coaIds).select('*') : []);
        await dump('document_imports', periodIds.length > 0 ? await trx('document_imports').whereIn('period_id', periodIds).select('*') : []);
      } else if (level === 'period' && periodId) {
        const period = await trx('periods').where('id', periodId).first('*');
        const cId = period?.client_id;
        const client = cId ? await trx('clients').where('id', cId).select('*') : [];
        await dump('clients', client);
        await dump('periods', period ? [period] : []);
        await dump('chart_of_accounts', cId ? await trx('chart_of_accounts').where('client_id', cId).select('*') : []);
        const coaRows = cId ? await trx('chart_of_accounts').where('client_id', cId).select('id') : [];
        const coaIds = coaRows.map((r: { id: number }) => r.id);
        await dump('trial_balance', await trx('trial_balance').where('period_id', periodId).select('*'));
        const jeRows = await trx('journal_entries').where('period_id', periodId).select('*');
        await dump('journal_entries', jeRows);
        const jeIds = jeRows.map((r: { id: number }) => r.id);
        await dump('journal_entry_lines', jeIds.length > 0 ? await trx('journal_entry_lines').whereIn('journal_entry_id', jeIds).select('*') : []);
        await dump('bank_transactions', cId ? await trx('bank_transactions').where('client_id', cId).where('period_id', periodId).select('*') : []);
        await dump('variance_notes', coaIds.length > 0 ? await trx('variance_notes').where('period_id', periodId).whereIn('account_id', coaIds).select('*') : []);
        await dump('document_imports', await trx('document_imports').where('period_id', periodId).select('*'));
      }
    },
    { isolationLevel: 'repeatable read' },
  );

  // Build filename. TypeScript narrows these to `null` across the async
  // closure above even though the callback assigns to them, so force the
  // wider type via assertion.
  const resolvedClientName = clientName as string | null;
  const resolvedPeriodName = periodName as string | null;
  const ts = new Date().toISOString().replace(/[:.]/g, '-').replace('T', '_').slice(0, 19);
  const suffix = resolvedClientName
    ? `_${resolvedClientName.replace(/[^a-zA-Z0-9]/g, '_').slice(0, 30)}`
    : resolvedPeriodName
    ? `_${resolvedPeriodName.replace(/[^a-zA-Z0-9]/g, '_').slice(0, 30)}`
    : '';
  const filename = `backup_${level}${suffix}_${ts}.tbak`;
  const filePath = path.join(BACKUP_DIR, filename);

  // Build manifest (no checksum yet)
  const manifest = {
    version: '1.0',
    backupType: level,
    backupLevel: level,
    createdAt: new Date().toISOString(),
    createdBy: username,
    clientId: clientId ?? null,
    clientName: resolvedClientName,
    periodId: periodId ?? null,
    periodName: resolvedPeriodName,
    recordCounts,
    checksum: '',
  };

  // Create ZIP
  await new Promise<void>((resolve, reject) => {
    const output = fs.createWriteStream(filePath);
    const archive = archiver('zip', { zlib: { level: 9 } });

    output.on('close', resolve);
    archive.on('error', reject);
    archive.pipe(output);

    // Add manifest
    archive.append(JSON.stringify(manifest, null, 2), { name: 'manifest.json' });

    // Add table files
    for (const [tableName, rows] of Object.entries(tableData)) {
      archive.append(JSON.stringify(rows, null, 2), { name: `tables/${tableName}.json` });
    }

    archive.finalize();
  });

  // Compute checksum via streaming hash — avoids pulling the whole .tbak into
  // memory, which matters for full backups that can reach several hundred MB.
  const stat = fs.statSync(filePath);
  const fileSize = stat.size;
  const checksum: string = await new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256');
    const stream = fs.createReadStream(filePath);
    stream.on('data', (chunk) => hash.update(chunk));
    stream.on('end', () => resolve('sha256:' + hash.digest('hex')));
    stream.on('error', reject);
  });

  // Update manifest with checksum (re-zip would be needed for perfect integrity; store in DB instead)
  manifest.checksum = checksum;

  // Insert backup_history
  const [record] = await db('backup_history')
    .insert({
      backup_type: level,
      backup_level: level,
      client_id: clientId ?? null,
      client_name: resolvedClientName,
      period_id: periodId ?? null,
      period_name: resolvedPeriodName,
      filename,
      file_size: fileSize,
      checksum,
      storage_local: filePath,
      trigger_type: triggerType,
      status: 'completed',
      record_counts: JSON.stringify(recordCounts),
      created_by: userId,
    })
    .returning('*');

  return record as BackupHistoryRow;
}

// ─────────────────────────────────────────────────────────────────────────────
// Restore helpers
// ─────────────────────────────────────────────────────────────────────────────

// Guards against zip-bomb / pathological archives on restore. Totals are
// tracked across all extracted table files — a crafted .tbak that claims
// to hold a billion rows can otherwise OOM the Pi.
const MAX_RESTORE_ENTRIES = 200;
const MAX_RESTORE_UNCOMPRESSED_BYTES = 2 * 1024 * 1024 * 1024; // 2 GiB
const MAX_RESTORE_TABLE_BYTES = 512 * 1024 * 1024;             // 512 MiB per table

async function readZipContents(filePath: string): Promise<Record<string, unknown[]>> {
  const tables: Record<string, unknown[]> = {};
  const dir = await unzipper.Open.file(filePath);

  if (dir.files.length > MAX_RESTORE_ENTRIES) {
    throw Object.assign(
      new Error(`Backup archive has ${dir.files.length} entries (max ${MAX_RESTORE_ENTRIES})`),
      { code: 'INVALID_BACKUP' },
    );
  }

  let totalBytes = 0;
  for (const file of dir.files) {
    // Reject entries whose path tries to escape the archive root.
    if (file.path.includes('..') || path.isAbsolute(file.path)) {
      throw Object.assign(new Error(`Backup contains unsafe path: ${file.path}`), { code: 'INVALID_BACKUP' });
    }
    if (!file.path.startsWith('tables/') || !file.path.endsWith('.json')) continue;

    // unzipper exposes both compressed and uncompressed sizes; the
    // uncompressedSize field is reported by the ZIP's central directory.
    const declaredSize = (file as unknown as { uncompressedSize?: number }).uncompressedSize ?? 0;
    if (declaredSize > MAX_RESTORE_TABLE_BYTES) {
      throw Object.assign(
        new Error(`Backup table "${file.path}" is ${declaredSize} bytes (max ${MAX_RESTORE_TABLE_BYTES})`),
        { code: 'INVALID_BACKUP' },
      );
    }
    totalBytes += declaredSize;
    if (totalBytes > MAX_RESTORE_UNCOMPRESSED_BYTES) {
      throw Object.assign(
        new Error(`Backup archive exceeds ${MAX_RESTORE_UNCOMPRESSED_BYTES} bytes uncompressed`),
        { code: 'INVALID_BACKUP' },
      );
    }

    const tableName = path.basename(file.path, '.json');
    const content = await file.buffer();
    tables[tableName] = JSON.parse(content.toString('utf8')) as unknown[];
  }
  return tables;
}

async function readManifest(filePath: string): Promise<Record<string, unknown>> {
  const dir = await unzipper.Open.file(filePath);
  const manifestFile = dir.files.find((f) => f.path === 'manifest.json');
  if (!manifestFile) throw new Error('manifest.json not found in backup');
  const content = await manifestFile.buffer();
  return JSON.parse(content.toString('utf8')) as Record<string, unknown>;
}

type IdMap = Map<string, Map<number, number>>;

// Chunk a long array into batches of `size` — lets us bulk-insert without
// hitting Postgres parameter limits (~65k placeholders per INSERT).
function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}
const BATCH_SIZE = 500;

async function restoreAsNew(
  tables: Record<string, unknown[]>,
  trx: Knex.Transaction,
): Promise<{ newClientId: number; idMappings: Record<string, Record<number, number>> }> {
  const idMap: IdMap = new Map();

  function getNewId(table: string, oldId: number): number {
    // Fail loudly rather than silently fall through to the old ID — if the backup
    // references a parent row we never mapped, returning `oldId` would point the
    // new child at an unrelated (possibly different-client) existing row.
    const mapped = idMap.get(table)?.get(oldId);
    if (mapped === undefined) {
      throw Object.assign(
        new Error(`Restore consistency error: ${table} id ${oldId} referenced but not remapped. The backup is missing a parent row.`),
        { code: 'RESTORE_BROKEN_REF', status: 400 },
      );
    }
    return mapped;
  }

  function registerMap(table: string): Map<number, number> {
    const m = new Map<number, number>();
    idMap.set(table, m);
    return m;
  }

  let newClientId = 0;

  // 1. clients — row-by-row because we check for name collisions
  const clientsData = tables['clients'] as Array<Record<string, unknown>> | undefined;
  if (clientsData && clientsData.length > 0) {
    const clientMap = registerMap('clients');
    for (const row of clientsData) {
      const oldId = row.id as number;
      const existing = await trx('clients').where('name', row.name as string).first('id');
      let insertName = row.name as string;
      if (existing) {
        insertName = `${insertName} (Restored)`;
      }
      const [inserted] = await trx('clients')
        .insert({ ...row, id: undefined, name: insertName })
        .returning('id');
      const newId = (inserted as { id: number }).id;
      clientMap.set(oldId, newId);
      newClientId = newId;
    }

    // Take a per-client advisory lock so a second concurrent restore onto the
    // same target client serializes cleanly rather than corrupting state.
    // pg_advisory_xact_lock releases automatically at transaction end.
    await trx.raw('SELECT pg_advisory_xact_lock(?, ?)', [42, newClientId]);
  }

  // 2. periods — bulk insert, preserving old->new id order
  const periodsData = tables['periods'] as Array<Record<string, unknown>> | undefined;
  if (periodsData && periodsData.length > 0) {
    const periodMap = registerMap('periods');
    const prepared = periodsData.map((row) => ({
      ...row,
      id: undefined,
      client_id: getNewId('clients', row.client_id as number),
    }));
    for (const batch of chunk(prepared, BATCH_SIZE)) {
      const indexInWhole = prepared.indexOf(batch[0]);
      const inserted = await trx('periods').insert(batch).returning('id');
      inserted.forEach((r, i) => {
        const oldId = periodsData[indexInWhole + i].id as number;
        periodMap.set(oldId, (r as { id: number }).id);
      });
    }
  }

  // 3. chart_of_accounts — bulk insert
  const coaData = tables['chart_of_accounts'] as Array<Record<string, unknown>> | undefined;
  if (coaData && coaData.length > 0) {
    const coaMap = registerMap('chart_of_accounts');
    const prepared = coaData.map((row) => ({
      ...row,
      id: undefined,
      client_id: getNewId('clients', row.client_id as number),
    }));
    for (const batch of chunk(prepared, BATCH_SIZE)) {
      const indexInWhole = prepared.indexOf(batch[0]);
      const inserted = await trx('chart_of_accounts').insert(batch).returning('id');
      inserted.forEach((r, i) => {
        const oldId = coaData[indexInWhole + i].id as number;
        coaMap.set(oldId, (r as { id: number }).id);
      });
    }
  }

  // 4. trial_balance — bulk insert (no id mapping needed downstream)
  const tbData = tables['trial_balance'] as Array<Record<string, unknown>> | undefined;
  if (tbData && tbData.length > 0) {
    const rows = tbData.map((row) => ({
      ...row,
      id: undefined,
      period_id: getNewId('periods', row.period_id as number),
      account_id: getNewId('chart_of_accounts', row.account_id as number),
    }));
    for (const batch of chunk(rows, BATCH_SIZE)) {
      await trx('trial_balance').insert(batch);
    }
  }

  // 5. journal_entries — bulk insert, tracking old->new id
  const jeData = tables['journal_entries'] as Array<Record<string, unknown>> | undefined;
  if (jeData && jeData.length > 0) {
    const jeMap = registerMap('journal_entries');
    const prepared = jeData.map((row) => ({
      ...row,
      id: undefined,
      period_id: getNewId('periods', row.period_id as number),
    }));
    for (const batch of chunk(prepared, BATCH_SIZE)) {
      const indexInWhole = prepared.indexOf(batch[0]);
      const inserted = await trx('journal_entries').insert(batch).returning('id');
      inserted.forEach((r, i) => {
        const oldId = jeData[indexInWhole + i].id as number;
        jeMap.set(oldId, (r as { id: number }).id);
      });
    }
  }

  // 6. journal_entry_lines — bulk insert
  const jelData = tables['journal_entry_lines'] as Array<Record<string, unknown>> | undefined;
  if (jelData && jelData.length > 0) {
    const rows = jelData.map((row) => ({
      ...row,
      id: undefined,
      journal_entry_id: getNewId('journal_entries', row.journal_entry_id as number),
      account_id: getNewId('chart_of_accounts', row.account_id as number),
    }));
    for (const batch of chunk(rows, BATCH_SIZE)) {
      await trx('journal_entry_lines').insert(batch);
    }
  }

  // 7. bank_transactions — bulk insert
  const btData = tables['bank_transactions'] as Array<Record<string, unknown>> | undefined;
  if (btData && btData.length > 0) {
    const rows = btData.map((row) => ({
      ...row,
      id: undefined,
      client_id: getNewId('clients', row.client_id as number),
      account_id: row.account_id ? getNewId('chart_of_accounts', row.account_id as number) : null,
    }));
    for (const batch of chunk(rows, BATCH_SIZE)) {
      await trx('bank_transactions').insert(batch);
    }
  }

  // 8. classification_rules — bulk insert
  const rulesData = tables['classification_rules'] as Array<Record<string, unknown>> | undefined;
  if (rulesData && rulesData.length > 0) {
    const rows = rulesData.map((row) => ({
      ...row,
      id: undefined,
      client_id: getNewId('clients', row.client_id as number),
      account_id: row.account_id ? getNewId('chart_of_accounts', row.account_id as number) : null,
    }));
    for (const batch of chunk(rows, BATCH_SIZE)) {
      await trx('classification_rules').insert(batch);
    }
  }

  // 9. variance_notes — bulk insert
  const vnData = tables['variance_notes'] as Array<Record<string, unknown>> | undefined;
  if (vnData && vnData.length > 0) {
    const rows = vnData.map((row) => ({
      ...row,
      id: undefined,
      account_id: getNewId('chart_of_accounts', row.account_id as number),
      period_id: getNewId('periods', row.period_id as number),
    }));
    for (const batch of chunk(rows, BATCH_SIZE)) {
      await trx('variance_notes').insert(batch);
    }
  }

  // 10. document_imports — bulk insert
  const diData = tables['document_imports'] as Array<Record<string, unknown>> | undefined;
  if (diData && diData.length > 0) {
    const rows = diData.map((row) => ({
      ...row,
      id: undefined,
      period_id: getNewId('periods', row.period_id as number),
    }));
    for (const batch of chunk(rows, BATCH_SIZE)) {
      await trx('document_imports').insert(batch);
    }
  }

  // Build serializable id_mappings
  const idMappings: Record<string, Record<number, number>> = {};
  for (const [table, map] of idMap.entries()) {
    idMappings[table] = Object.fromEntries(map.entries());
  }

  return { newClientId, idMappings };
}

async function restoreReplace(
  tables: Record<string, unknown[]>,
  targetClientId: number,
  trx: Knex.Transaction,
): Promise<void> {
  // Take a per-client advisory lock first so concurrent restores on the same
  // client serialize. Any other session holding the lock (e.g. another
  // restore) blocks here until the current txn ends.
  await trx.raw('SELECT pg_advisory_xact_lock(?, ?)', [42, targetClientId]);

  // Delete existing client (cascade handles related tables)
  await trx('clients').where('id', targetClientId).delete();

  const clientsData = tables['clients'] as Array<Record<string, unknown>> | undefined;
  if (!clientsData || clientsData.length === 0) return;

  const oldClientId = clientsData[0].id as number;

  function remapClientId(row: Record<string, unknown>): Record<string, unknown> {
    if (row.client_id === oldClientId) return { ...row, client_id: targetClientId };
    return row;
  }

  // Insert client with target ID
  await trx('clients').insert({ ...clientsData[0], id: targetClientId });

  const periodIdMap = new Map<number, number>();
  const coaIdMap = new Map<number, number>();
  const jeIdMap = new Map<number, number>();

  // periods — bulk
  const periodsData = tables['periods'] as Array<Record<string, unknown>> | undefined;
  if (periodsData && periodsData.length > 0) {
    const prepared = periodsData.map((row) => remapClientId({ ...row, id: undefined }));
    for (const batch of chunk(prepared, BATCH_SIZE)) {
      const indexInWhole = prepared.indexOf(batch[0]);
      const ins = await trx('periods').insert(batch).returning('id');
      ins.forEach((r, i) => {
        periodIdMap.set(periodsData[indexInWhole + i].id as number, (r as { id: number }).id);
      });
    }
  }

  // chart_of_accounts — bulk
  const coaData = tables['chart_of_accounts'] as Array<Record<string, unknown>> | undefined;
  if (coaData && coaData.length > 0) {
    const prepared = coaData.map((row) => remapClientId({ ...row, id: undefined }));
    for (const batch of chunk(prepared, BATCH_SIZE)) {
      const indexInWhole = prepared.indexOf(batch[0]);
      const ins = await trx('chart_of_accounts').insert(batch).returning('id');
      ins.forEach((r, i) => {
        coaIdMap.set(coaData[indexInWhole + i].id as number, (r as { id: number }).id);
      });
    }
  }

  // trial_balance — bulk
  const tbData = tables['trial_balance'] as Array<Record<string, unknown>> | undefined;
  if (tbData && tbData.length > 0) {
    const rows = tbData.map((row) => ({
      ...row,
      id: undefined,
      period_id: periodIdMap.get(row.period_id as number) ?? row.period_id,
      account_id: coaIdMap.get(row.account_id as number) ?? row.account_id,
    }));
    for (const batch of chunk(rows, BATCH_SIZE)) {
      await trx('trial_balance').insert(batch);
    }
  }

  // journal_entries — bulk
  const jeData = tables['journal_entries'] as Array<Record<string, unknown>> | undefined;
  if (jeData && jeData.length > 0) {
    const prepared = jeData.map((row) => ({
      ...row,
      id: undefined,
      period_id: periodIdMap.get(row.period_id as number) ?? row.period_id,
    }));
    for (const batch of chunk(prepared, BATCH_SIZE)) {
      const indexInWhole = prepared.indexOf(batch[0]);
      const ins = await trx('journal_entries').insert(batch).returning('id');
      ins.forEach((r, i) => {
        jeIdMap.set(jeData[indexInWhole + i].id as number, (r as { id: number }).id);
      });
    }
  }

  // journal_entry_lines — bulk
  const jelData = tables['journal_entry_lines'] as Array<Record<string, unknown>> | undefined;
  if (jelData && jelData.length > 0) {
    const rows = jelData.map((row) => ({
      ...row,
      id: undefined,
      journal_entry_id: jeIdMap.get(row.journal_entry_id as number) ?? row.journal_entry_id,
      account_id: coaIdMap.get(row.account_id as number) ?? row.account_id,
    }));
    for (const batch of chunk(rows, BATCH_SIZE)) {
      await trx('journal_entry_lines').insert(batch);
    }
  }

  // bank_transactions — bulk
  const btData = tables['bank_transactions'] as Array<Record<string, unknown>> | undefined;
  if (btData && btData.length > 0) {
    const rows = btData.map((row) => ({
      ...row,
      id: undefined,
      client_id: targetClientId,
      account_id: row.account_id ? (coaIdMap.get(row.account_id as number) ?? row.account_id) : null,
    }));
    for (const batch of chunk(rows, BATCH_SIZE)) {
      await trx('bank_transactions').insert(batch);
    }
  }

  // classification_rules — bulk
  const rulesData = tables['classification_rules'] as Array<Record<string, unknown>> | undefined;
  if (rulesData && rulesData.length > 0) {
    const rows = rulesData.map((row) => remapClientId({
      ...row,
      id: undefined,
      account_id: row.account_id ? (coaIdMap.get(row.account_id as number) ?? row.account_id) : null,
    }));
    for (const batch of chunk(rows, BATCH_SIZE)) {
      await trx('classification_rules').insert(batch);
    }
  }

  // variance_notes — bulk
  const vnData = tables['variance_notes'] as Array<Record<string, unknown>> | undefined;
  if (vnData && vnData.length > 0) {
    const rows = vnData.map((row) => ({
      ...row,
      id: undefined,
      account_id: coaIdMap.get(row.account_id as number) ?? row.account_id,
      period_id: periodIdMap.get(row.period_id as number) ?? row.period_id,
    }));
    for (const batch of chunk(rows, BATCH_SIZE)) {
      await trx('variance_notes').insert(batch);
    }
  }

  // document_imports — bulk
  const diData = tables['document_imports'] as Array<Record<string, unknown>> | undefined;
  if (diData && diData.length > 0) {
    const rows = diData.map((row) => ({
      ...row,
      id: undefined,
      period_id: periodIdMap.get(row.period_id as number) ?? row.period_id,
    }));
    for (const batch of chunk(rows, BATCH_SIZE)) {
      await trx('document_imports').insert(batch);
    }
  }
}

interface RestoreSettingsReport {
  taxCodesUpserted: number;
  taxCodeMapsUpserted: number;
  appSettingsReplaced: boolean;
  usersCreated: string[];
  usersSkipped: string[];
}

interface RestoreSettingsOptions {
  /**
   * When true, settings-level restore will materialize app_users from the
   * backup (inserting new usernames, skipping existing ones). Only safe when
   * the archive originated from a known-trusted backup of this same instance.
   * Defaults to false so a malicious .tbak can't inject admin accounts.
   */
  allowUsers?: boolean;
}

async function restoreSettings(
  tables: Record<string, unknown[]>,
  trx: Knex.Transaction,
  options: RestoreSettingsOptions = {},
): Promise<RestoreSettingsReport> {
  const report: RestoreSettingsReport = {
    taxCodesUpserted: 0,
    taxCodeMapsUpserted: 0,
    appSettingsReplaced: false,
    usersCreated: [],
    usersSkipped: [],
  };

  // Serialize settings restores so two admins can't race each other.
  await trx.raw('SELECT pg_advisory_xact_lock(?, ?)', [42, 0]);

  // Tax codes: upsert by (return_form, activity_type, tax_code)
  const taxCodesData = tables['tax_codes'] as Array<Record<string, unknown>> | undefined;
  if (taxCodesData && taxCodesData.length > 0) {
    for (const row of taxCodesData) {
      await trx('tax_codes')
        .insert({ ...row })
        .onConflict(['return_form', 'activity_type', 'tax_code'])
        .merge();
      report.taxCodesUpserted++;
    }
  }

  // Tax code software maps: upsert
  const mapsData = tables['tax_code_software_maps'] as Array<Record<string, unknown>> | undefined;
  if (mapsData && mapsData.length > 0) {
    for (const row of mapsData) {
      await trx('tax_code_software_maps').insert({ ...row }).onConflict(['tax_code_id', 'software']).merge();
      report.taxCodeMapsUpserted++;
    }
  }

  // App settings: delete all, re-insert
  const hasSettings = await trx.schema.hasTable('app_settings');
  if (hasSettings) {
    const settingsData = tables['app_settings'] as Array<Record<string, unknown>> | undefined;
    if (settingsData && settingsData.length > 0) {
      await trx('app_settings').delete();
      for (const row of settingsData) {
        await trx('app_settings').insert(row);
      }
      report.appSettingsReplaced = true;
    }
  }

  // Users: only restored when the caller explicitly opts in. Blocks the
  // attack where an admin uploads a crafted .tbak containing an attacker's
  // password_hash for a new username — which would otherwise silently give
  // them a login.
  const usersData = tables['app_users'] as Array<Record<string, unknown>> | undefined;
  if (usersData && usersData.length > 0) {
    if (options.allowUsers) {
      for (const row of usersData) {
        const username = row.username as string;
        const existing = await trx('app_users').where('username', username).first('id');
        if (existing) {
          report.usersSkipped.push(username);
        } else {
          await trx('app_users').insert({ ...row, id: undefined });
          report.usersCreated.push(username);
        }
      }
    } else {
      // Report every username we refused to touch so the operator understands
      // why their user list didn't come back.
      for (const row of usersData) {
        report.usersSkipped.push(row.username as string);
      }
    }
  }

  return report;
}

// ─────────────────────────────────────────────────────────────────────────────
// Routers
// ─────────────────────────────────────────────────────────────────────────────

export const backupRouter = Router();
export const restoreRouter = Router();

backupRouter.use(authMiddleware);
restoreRouter.use(authMiddleware);

function requireAdmin(req: AuthRequest, res: Response): boolean {
  if (req.user?.role !== 'admin') {
    res.status(403).json({ data: null, error: { code: 'FORBIDDEN', message: 'Admin access required' } });
    return false;
  }
  return true;
}

// POST /api/v1/backup/full
backupRouter.post('/full', async (req: AuthRequest, res: Response): Promise<void> => {
  if (!requireAdmin(req, res)) return;
  try {
    const record = await createBackup('full', { triggerType: 'manual' }, req.user!.userId);
    res.json({ data: record, error: null });
  } catch (err: unknown) {
    sendServerError(res, err, 'backup');
  }
});

// POST /api/v1/backup/settings
backupRouter.post('/settings', async (req: AuthRequest, res: Response): Promise<void> => {
  if (!requireAdmin(req, res)) return;
  try {
    const record = await createBackup('settings', { triggerType: 'manual' }, req.user!.userId);
    res.json({ data: record, error: null });
  } catch (err: unknown) {
    sendServerError(res, err, 'backup');
  }
});

// POST /api/v1/backup/client/:clientId
backupRouter.post('/client/:clientId', async (req: AuthRequest, res: Response): Promise<void> => {
  if (!requireAdmin(req, res)) return;
  try {
    const clientId = parseInt(req.params.clientId, 10);
    if (isNaN(clientId)) {
      res.status(400).json({ data: null, error: { code: 'VALIDATION_ERROR', message: 'Invalid clientId' } });
      return;
    }
    const record = await createBackup('client', { clientId, triggerType: 'manual' }, req.user!.userId);
    res.json({ data: record, error: null });
  } catch (err: unknown) {
    sendServerError(res, err, 'backup');
  }
});

// POST /api/v1/backup/period/:periodId
backupRouter.post('/period/:periodId', async (req: AuthRequest, res: Response): Promise<void> => {
  if (!requireAdmin(req, res)) return;
  try {
    const periodId = parseInt(req.params.periodId, 10);
    if (isNaN(periodId)) {
      res.status(400).json({ data: null, error: { code: 'VALIDATION_ERROR', message: 'Invalid periodId' } });
      return;
    }
    const record = await createBackup('period', { periodId, triggerType: 'manual' }, req.user!.userId);
    res.json({ data: record, error: null });
  } catch (err: unknown) {
    sendServerError(res, err, 'backup');
  }
});

// GET /api/v1/backup/history
backupRouter.get('/history', async (req: AuthRequest, res: Response): Promise<void> => {
  if (!requireAdmin(req, res)) return;
  try {
    const { clientId } = req.query;
    let query = db('backup_history').select('*').orderBy('created_at', 'desc');
    if (clientId) {
      query = query.where('client_id', parseInt(clientId as string, 10));
    }
    const rows = await query;
    res.json({ data: rows, error: null });
  } catch (err: unknown) {
    sendServerError(res, err, 'backup');
  }
});

// GET /api/v1/backup/:backupId/download
backupRouter.get('/:backupId/download', async (req: AuthRequest, res: Response): Promise<void> => {
  if (!requireAdmin(req, res)) return;
  try {
    const backupId = parseInt(req.params.backupId, 10);
    const record = await db('backup_history').where('id', backupId).first('*');
    if (!record) {
      res.status(404).json({ data: null, error: { code: 'NOT_FOUND', message: 'Backup not found' } });
      return;
    }
    const filePath = record.storage_local as string;
    if (!fs.existsSync(filePath)) {
      res.status(404).json({ data: null, error: { code: 'FILE_NOT_FOUND', message: 'Backup file not found on disk' } });
      return;
    }
    res.setHeader('Content-Disposition', `attachment; filename="${record.filename as string}"`);
    res.setHeader('Content-Type', 'application/zip');
    fs.createReadStream(filePath).pipe(res);
  } catch (err: unknown) {
    sendServerError(res, err, 'backup');
  }
});

// DELETE /api/v1/backup/:backupId
backupRouter.delete('/:backupId', async (req: AuthRequest, res: Response): Promise<void> => {
  if (!requireAdmin(req, res)) return;
  try {
    const backupId = parseInt(req.params.backupId, 10);
    const record = await db('backup_history').where('id', backupId).first('*');
    if (!record) {
      res.status(404).json({ data: null, error: { code: 'NOT_FOUND', message: 'Backup not found' } });
      return;
    }
    const filePath = record.storage_local as string;
    if (filePath && fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
    await db('backup_history').where('id', backupId).delete();
    res.json({ data: { deleted: true }, error: null });
  } catch (err: unknown) {
    sendServerError(res, err, 'backup');
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Restore routes
// ─────────────────────────────────────────────────────────────────────────────

// 500 MB ceiling for uploaded .tbak archives — bounded so an admin mis-click or
// a rogue browser upload can't fill the disk. Matches nginx client_max_body_size.
const upload = multer({
  dest: TEMP_DIR,
  limits: { fileSize: 500 * 1024 * 1024, files: 1 },
});

// Narrow rate-limit in front of /restore/upload — 500 MB uploads are expensive,
// so bound them independently of the global bucket to 5/hour per authenticated
// admin (keyed by userId so shared-IP teams don't block each other).
const restoreUploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: Request) => {
    const userId = (req as AuthRequest).user?.userId;
    return userId ? `user:${userId}` : (req.ip ?? 'unknown');
  },
  message: { data: null, error: { code: 'RATE_LIMITED', message: 'Too many restore uploads in the last hour. Wait before retrying.' } },
});

// POST /api/v1/restore/upload
restoreRouter.post(
  '/upload',
  (req: Request, res: Response, next: NextFunction): void => {
    if ((req as AuthRequest).user?.role !== 'admin') {
      res.status(403).json({ data: null, error: { code: 'FORBIDDEN', message: 'Admin access required' } });
      return;
    }
    next();
  },
  restoreUploadLimiter,
  upload.single('file'),
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      if (!req.file) {
        res.status(400).json({ data: null, error: { code: 'NO_FILE', message: 'No file uploaded' } });
        return;
      }

      // Rename to .tbak
      const tbakPath = req.file.path + '.tbak';
      fs.renameSync(req.file.path, tbakPath);

      // Read manifest
      const manifest = await readManifest(tbakPath);

      // Bind this staged file to the uploading admin + a one-time nonce. /restore/execute
      // verifies both before touching the file. Ad-hoc filenames are no longer enough.
      const tempBase = path.basename(tbakPath);
      const nonce = crypto.randomBytes(24).toString('base64url');
      rememberUploadSession(tempBase, req.user!.userId, nonce);

      res.json({
        data: {
          tempFile: tempBase,
          uploadNonce: nonce,
          manifest,
        },
        error: null,
      });
    } catch (err: unknown) {
      sendServerError(res, err, 'backup');
    }
  },
);

// POST /api/v1/restore/execute
restoreRouter.post('/execute', async (req: AuthRequest, res: Response): Promise<void> => {
  if (!requireAdmin(req, res)) return;
  try {
    const { backupId, tempFile, uploadNonce, mode, targetClientId } = req.body as {
      backupId?: number;
      tempFile?: string;
      uploadNonce?: string;
      mode: string;
      targetClientId?: number;
    };

    let filePath: string;
    let backupRecord: BackupHistoryRow | null = null;

    if (backupId) {
      backupRecord = await db('backup_history').where('id', backupId).first('*') as BackupHistoryRow | null;
      if (!backupRecord) {
        res.status(404).json({ data: null, error: { code: 'NOT_FOUND', message: 'Backup not found' } });
        return;
      }
      filePath = backupRecord.storage_local!;
    } else if (tempFile) {
      // Validate no path traversal
      const safeName = path.basename(tempFile);
      // Tie the temp file to the admin who uploaded it + a one-time nonce —
      // a second admin cannot execute a file staged by a different session.
      if (!consumeUploadSession(safeName, req.user!.userId, uploadNonce ?? '')) {
        res.status(403).json({
          data: null,
          error: { code: 'RESTORE_SESSION_INVALID', message: 'This upload was not made by your session, has expired, or the nonce is wrong. Re-upload the file.' },
        });
        return;
      }
      filePath = path.join(TEMP_DIR, safeName);
    } else {
      res.status(400).json({ data: null, error: { code: 'VALIDATION_ERROR', message: 'backupId or tempFile required' } });
      return;
    }

    if (!fs.existsSync(filePath)) {
      res.status(404).json({ data: null, error: { code: 'FILE_NOT_FOUND', message: 'Backup file not found' } });
      return;
    }

    // Verify checksum for known backups (backupId path). Hash via a stream so the
    // entire .tbak (possibly hundreds of MB) is never held in memory at once.
    if (backupRecord?.checksum) {
      const actual: string = await new Promise((resolve, reject) => {
        const hash = crypto.createHash('sha256');
        const stream = fs.createReadStream(filePath);
        stream.on('data', (chunk) => hash.update(chunk));
        stream.on('end', () => resolve('sha256:' + hash.digest('hex')));
        stream.on('error', reject);
      });
      if (actual !== backupRecord.checksum) {
        res.status(400).json({
          data: null,
          error: { code: 'CHECKSUM_MISMATCH', message: 'Backup file integrity check failed. The file may have been modified or corrupted.' },
        });
        return;
      }
    }

    const tables = await readZipContents(filePath);

    // Validate essential data structure
    if (tables.clients && !Array.isArray(tables.clients)) {
      res.status(400).json({ data: null, error: { code: 'INVALID_BACKUP', message: 'Invalid backup data: clients must be an array.' } });
      return;
    }
    if (tables.periods && !Array.isArray(tables.periods)) {
      res.status(400).json({ data: null, error: { code: 'INVALID_BACKUP', message: 'Invalid backup data: periods must be an array.' } });
      return;
    }
    if (tables.app_users && !Array.isArray(tables.app_users)) {
      res.status(400).json({ data: null, error: { code: 'INVALID_BACKUP', message: 'Invalid backup data: app_users must be an array.' } });
      return;
    }
    let newClientId: number | null = null;
    let idMappings: Record<string, Record<number, number>> = {};
    let settingsReport: RestoreSettingsReport | null = null;

    // Pre-restore backup for replace mode
    if (mode === 'replace' && targetClientId) {
      try {
        await createBackup('client', { clientId: targetClientId, triggerType: 'pre_restore' }, req.user!.userId);
      } catch (_e) {
        // Non-fatal
      }
    }

    await db.transaction(async (trx) => {
      if (mode === 'as_new') {
        const result = await restoreAsNew(tables, trx);
        newClientId = result.newClientId;
        idMappings = result.idMappings;
      } else if (mode === 'replace') {
        if (!targetClientId) throw new Error('targetClientId required for replace mode');
        await restoreReplace(tables, targetClientId, trx);
        newClientId = targetClientId;
      } else if (mode === 'settings') {
        // Only trust app_users rows when we're restoring a backup we produced
        // (looked up by backupId). Ad-hoc uploaded .tbak files never get to
        // create accounts.
        const allowUsers = !!backupRecord;
        settingsReport = await restoreSettings(tables, trx, { allowUsers });
      } else {
        throw new Error(`Unknown restore mode: ${mode}`);
      }
    });

    // Clean up the uploaded restore temp file now that we've used it. Backups
    // loaded by backupId are kept (they live in backups/ not backups/temp).
    if (tempFile) {
      try {
        await fs.promises.unlink(filePath);
      } catch {
        // best-effort; stale temp files can be swept later
      }
    }

    // Log restore history
    await db('restore_history').insert({
      backup_id: backupRecord?.id ?? null,
      restore_mode: mode,
      target_client_id: targetClientId ?? null,
      new_client_id: newClientId,
      id_mappings: JSON.stringify(idMappings),
      status: 'completed',
      restored_by: req.user!.userId,
    });

    res.json({
      data: {
        success: true,
        mode,
        newClientId,
        idMappings,
        settingsReport,
      },
      error: null,
    });
  } catch (err: unknown) {
    const internal = err instanceof Error ? err.message : 'Unknown error';
    const code = (err as { code?: string }).code;
    // Log failure
    try {
      await db('restore_history').insert({
        backup_id: null,
        restore_mode: (req.body as { mode?: string }).mode ?? 'unknown',
        status: 'failed',
        error_message: internal,
        restored_by: (req as AuthRequest).user?.userId ?? null,
      });
    } catch (_e) { /* ignore */ }
    if (code === 'INVALID_BACKUP') {
      res.status(400).json({ data: null, error: { code: 'INVALID_BACKUP', message: internal } });
      return;
    }
    sendServerError(res, err, 'backup');
  }
});

// GET /api/v1/restore/history
restoreRouter.get('/history', async (req: AuthRequest, res: Response): Promise<void> => {
  if (!requireAdmin(req, res)) return;
  try {
    const rows = await db('restore_history').select('*').orderBy('restored_at', 'desc').limit(100);
    res.json({ data: rows, error: null });
  } catch (err: unknown) {
    sendServerError(res, err, 'backup');
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Scheduled backup
// ─────────────────────────────────────────────────────────────────────────────

export function startBackupScheduler(): void {
  // Run at 2:00 AM daily
  cron.schedule('0 2 * * *', async () => {
    console.log('[backup] Starting scheduled full backup...');
    try {
      const record = await createBackup('full', { triggerType: 'scheduled' }, null);
      console.log(`[backup] Scheduled backup complete: ${record.filename}`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      console.error(`[backup] Scheduled backup failed: ${message}`);
    }
  });
  console.log('[backup] Scheduler registered (daily at 02:00)');
}
