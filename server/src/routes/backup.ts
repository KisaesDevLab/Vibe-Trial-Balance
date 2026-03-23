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
import { Router, Response, Request } from 'express';
import archiver from 'archiver';
import unzipper from 'unzipper';
import multer from 'multer';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import cron from 'node-cron';
import { db } from '../db';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import type { Knex } from 'knex';

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

  // Resolve names
  let clientName: string | null = null;
  let periodName: string | null = null;

  if (clientId) {
    const c = await db('clients').where('id', clientId).first('name');
    clientName = c?.name ?? null;
  }
  if (periodId) {
    const p = await db('periods').where('id', periodId).first('period_name');
    periodName = p?.period_name ?? null;
  }

  // Resolve username for manifest
  let username = 'system';
  if (userId) {
    const u = await db('app_users').where('id', userId).first('username');
    username = u?.username ?? 'system';
  }

  // Collect table data
  const tableData: Record<string, unknown[]> = {};
  const recordCounts: Record<string, number> = {};

  async function dump(table: string, rows: unknown[]) {
    tableData[table] = rows;
    recordCounts[table] = rows.length;
  }

  if (level === 'full') {
    await dump('app_users', await db('app_users').select('*'));
    await dump('clients', await db('clients').select('*'));
    await dump('periods', await db('periods').select('*'));
    await dump('chart_of_accounts', await db('chart_of_accounts').select('*'));
    await dump('trial_balance', await db('trial_balance').select('*'));
    await dump('journal_entries', await db('journal_entries').select('*'));
    await dump('journal_entry_lines', await db('journal_entry_lines').select('*'));
    await dump('bank_transactions', await db('bank_transactions').select('*'));
    await dump('classification_rules', await db('classification_rules').select('*'));
    await dump('variance_notes', await db('variance_notes').select('*'));
    await dump('document_imports', await db('document_imports').select('*'));
    await dump('tax_codes', await db('tax_codes').select('*'));
    await dump('tax_code_software_maps', await db('tax_code_software_maps').select('*'));
    const hasSettings = await db.schema.hasTable('app_settings');
    if (hasSettings) {
      await dump('app_settings', await db('app_settings').select('*'));
    }
  } else if (level === 'settings') {
    await dump('tax_codes', await db('tax_codes').select('*'));
    await dump('tax_code_software_maps', await db('tax_code_software_maps').select('*'));
    await dump('app_users', await db('app_users').select('*'));
    const hasSettings = await db.schema.hasTable('app_settings');
    if (hasSettings) {
      await dump('app_settings', await db('app_settings').select('*'));
    }
  } else if (level === 'client' && clientId) {
    const client = await db('clients').where('id', clientId).select('*');
    await dump('clients', client);
    const periodRows = await db('periods').where('client_id', clientId).select('*');
    await dump('periods', periodRows);
    const periodIds = periodRows.map((p: { id: number }) => p.id);
    await dump('chart_of_accounts', await db('chart_of_accounts').where('client_id', clientId).select('*'));
    const coaRows = await db('chart_of_accounts').where('client_id', clientId).select('id');
    const coaIds = coaRows.map((r: { id: number }) => r.id);
    await dump('trial_balance', periodIds.length > 0 ? await db('trial_balance').whereIn('period_id', periodIds).select('*') : []);
    await dump('journal_entries', periodIds.length > 0 ? await db('journal_entries').whereIn('period_id', periodIds).select('*') : []);
    const jeRows = periodIds.length > 0 ? await db('journal_entries').whereIn('period_id', periodIds).select('id') : [];
    const jeIds = jeRows.map((r: { id: number }) => r.id);
    await dump('journal_entry_lines', jeIds.length > 0 ? await db('journal_entry_lines').whereIn('journal_entry_id', jeIds).select('*') : []);
    await dump('bank_transactions', await db('bank_transactions').where('client_id', clientId).select('*'));
    await dump('classification_rules', await db('classification_rules').where('client_id', clientId).select('*'));
    await dump('variance_notes', coaIds.length > 0 ? await db('variance_notes').whereIn('account_id', coaIds).select('*') : []);
    await dump('document_imports', periodIds.length > 0 ? await db('document_imports').whereIn('period_id', periodIds).select('*') : []);
  } else if (level === 'period' && periodId) {
    const period = await db('periods').where('id', periodId).first('*');
    const cId = period?.client_id;
    const client = cId ? await db('clients').where('id', cId).select('*') : [];
    await dump('clients', client);
    await dump('periods', period ? [period] : []);
    await dump('chart_of_accounts', cId ? await db('chart_of_accounts').where('client_id', cId).select('*') : []);
    const coaRows = cId ? await db('chart_of_accounts').where('client_id', cId).select('id') : [];
    const coaIds = coaRows.map((r: { id: number }) => r.id);
    await dump('trial_balance', await db('trial_balance').where('period_id', periodId).select('*'));
    const jeRows = await db('journal_entries').where('period_id', periodId).select('*');
    await dump('journal_entries', jeRows);
    const jeIds = jeRows.map((r: { id: number }) => r.id);
    await dump('journal_entry_lines', jeIds.length > 0 ? await db('journal_entry_lines').whereIn('journal_entry_id', jeIds).select('*') : []);
    await dump('bank_transactions', cId ? await db('bank_transactions').where('client_id', cId).where('period_id', periodId).select('*') : []);
    await dump('variance_notes', coaIds.length > 0 ? await db('variance_notes').where('period_id', periodId).whereIn('account_id', coaIds).select('*') : []);
    await dump('document_imports', await db('document_imports').where('period_id', periodId).select('*'));
  }

  // Build filename
  const ts = new Date().toISOString().replace(/[:.]/g, '-').replace('T', '_').slice(0, 19);
  const suffix = clientName
    ? `_${clientName.replace(/[^a-zA-Z0-9]/g, '_').slice(0, 30)}`
    : periodName
    ? `_${periodName.replace(/[^a-zA-Z0-9]/g, '_').slice(0, 30)}`
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
    clientName: clientName ?? null,
    periodId: periodId ?? null,
    periodName: periodName ?? null,
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

  // Compute checksum
  const fileBuffer = fs.readFileSync(filePath);
  const checksum = 'sha256:' + crypto.createHash('sha256').update(fileBuffer).digest('hex');
  const fileSize = fileBuffer.length;

  // Update manifest with checksum (re-zip would be needed for perfect integrity; store in DB instead)
  manifest.checksum = checksum;

  // Insert backup_history
  const [record] = await db('backup_history')
    .insert({
      backup_type: level,
      backup_level: level,
      client_id: clientId ?? null,
      client_name: clientName,
      period_id: periodId ?? null,
      period_name: periodName,
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

async function readZipContents(filePath: string): Promise<Record<string, unknown[]>> {
  const tables: Record<string, unknown[]> = {};
  const dir = await unzipper.Open.file(filePath);
  for (const file of dir.files) {
    if (file.path.startsWith('tables/') && file.path.endsWith('.json')) {
      const tableName = path.basename(file.path, '.json');
      const content = await file.buffer();
      tables[tableName] = JSON.parse(content.toString('utf8')) as unknown[];
    }
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

async function restoreAsNew(
  tables: Record<string, unknown[]>,
  trx: Knex.Transaction,
): Promise<{ newClientId: number; idMappings: Record<string, Record<number, number>> }> {
  const idMap: IdMap = new Map();

  function getNewId(table: string, oldId: number): number {
    return idMap.get(table)?.get(oldId) ?? oldId;
  }

  function registerMap(table: string): Map<number, number> {
    const m = new Map<number, number>();
    idMap.set(table, m);
    return m;
  }

  let newClientId = 0;

  // 1. clients
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
  }

  // 2. periods
  const periodsData = tables['periods'] as Array<Record<string, unknown>> | undefined;
  if (periodsData && periodsData.length > 0) {
    const periodMap = registerMap('periods');
    for (const row of periodsData) {
      const oldId = row.id as number;
      const newClientId2 = getNewId('clients', row.client_id as number);
      const [inserted] = await trx('periods')
        .insert({ ...row, id: undefined, client_id: newClientId2 })
        .returning('id');
      const newId = (inserted as { id: number }).id;
      periodMap.set(oldId, newId);
    }
  }

  // 3. chart_of_accounts
  const coaData = tables['chart_of_accounts'] as Array<Record<string, unknown>> | undefined;
  if (coaData && coaData.length > 0) {
    const coaMap = registerMap('chart_of_accounts');
    for (const row of coaData) {
      const oldId = row.id as number;
      const newCId = getNewId('clients', row.client_id as number);
      const [inserted] = await trx('chart_of_accounts')
        .insert({ ...row, id: undefined, client_id: newCId })
        .returning('id');
      const newId = (inserted as { id: number }).id;
      coaMap.set(oldId, newId);
    }
  }

  // 4. trial_balance
  const tbData = tables['trial_balance'] as Array<Record<string, unknown>> | undefined;
  if (tbData && tbData.length > 0) {
    for (const row of tbData) {
      const newPeriodId = getNewId('periods', row.period_id as number);
      const newAccountId = getNewId('chart_of_accounts', row.account_id as number);
      await trx('trial_balance').insert({ ...row, id: undefined, period_id: newPeriodId, account_id: newAccountId });
    }
  }

  // 5. journal_entries
  const jeData = tables['journal_entries'] as Array<Record<string, unknown>> | undefined;
  if (jeData && jeData.length > 0) {
    const jeMap = registerMap('journal_entries');
    for (const row of jeData) {
      const oldId = row.id as number;
      const newPeriodId = getNewId('periods', row.period_id as number);
      const [inserted] = await trx('journal_entries')
        .insert({ ...row, id: undefined, period_id: newPeriodId })
        .returning('id');
      const newId = (inserted as { id: number }).id;
      jeMap.set(oldId, newId);
    }
  }

  // 6. journal_entry_lines
  const jelData = tables['journal_entry_lines'] as Array<Record<string, unknown>> | undefined;
  if (jelData && jelData.length > 0) {
    for (const row of jelData) {
      const newJeId = getNewId('journal_entries', row.journal_entry_id as number);
      const newAccountId = getNewId('chart_of_accounts', row.account_id as number);
      await trx('journal_entry_lines').insert({
        ...row,
        id: undefined,
        journal_entry_id: newJeId,
        account_id: newAccountId,
      });
    }
  }

  // 7. bank_transactions
  const btData = tables['bank_transactions'] as Array<Record<string, unknown>> | undefined;
  if (btData && btData.length > 0) {
    for (const row of btData) {
      const newCId = getNewId('clients', row.client_id as number);
      const newAccountId = row.account_id ? getNewId('chart_of_accounts', row.account_id as number) : null;
      await trx('bank_transactions').insert({ ...row, id: undefined, client_id: newCId, account_id: newAccountId });
    }
  }

  // 8. classification_rules
  const rulesData = tables['classification_rules'] as Array<Record<string, unknown>> | undefined;
  if (rulesData && rulesData.length > 0) {
    for (const row of rulesData) {
      const newCId = getNewId('clients', row.client_id as number);
      const newAccountId = row.account_id ? getNewId('chart_of_accounts', row.account_id as number) : null;
      await trx('classification_rules').insert({ ...row, id: undefined, client_id: newCId, account_id: newAccountId });
    }
  }

  // 9. variance_notes
  const vnData = tables['variance_notes'] as Array<Record<string, unknown>> | undefined;
  if (vnData && vnData.length > 0) {
    for (const row of vnData) {
      const newAccountId = getNewId('chart_of_accounts', row.account_id as number);
      const newPeriodId = getNewId('periods', row.period_id as number);
      await trx('variance_notes').insert({ ...row, id: undefined, account_id: newAccountId, period_id: newPeriodId });
    }
  }

  // 10. document_imports
  const diData = tables['document_imports'] as Array<Record<string, unknown>> | undefined;
  if (diData && diData.length > 0) {
    for (const row of diData) {
      const newPeriodId = getNewId('periods', row.period_id as number);
      await trx('document_imports').insert({ ...row, id: undefined, period_id: newPeriodId });
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
  // Delete existing client (cascade handles related tables)
  await trx('clients').where('id', targetClientId).delete();

  const clientsData = tables['clients'] as Array<Record<string, unknown>> | undefined;
  if (!clientsData || clientsData.length === 0) return;

  const oldClientId = clientsData[0].id as number;
  const buildIdMap = (oldId: number, newId: number): IdMap => {
    const m: IdMap = new Map();
    m.set('clients', new Map([[oldId, newId]]));
    return m;
  };

  function remapClientId(row: Record<string, unknown>): Record<string, unknown> {
    if (row.client_id === oldClientId) return { ...row, client_id: targetClientId };
    return row;
  }

  // Insert client with target ID
  await trx('clients').insert({ ...clientsData[0], id: targetClientId });

  const periodIdMap = new Map<number, number>();
  const coaIdMap = new Map<number, number>();
  const jeIdMap = new Map<number, number>();
  const allIdMap = buildIdMap(oldClientId, targetClientId);
  allIdMap.set('periods', periodIdMap);
  allIdMap.set('chart_of_accounts', coaIdMap);
  allIdMap.set('journal_entries', jeIdMap);

  const periodsData = tables['periods'] as Array<Record<string, unknown>> | undefined;
  if (periodsData) {
    for (const row of periodsData) {
      const oldId = row.id as number;
      const [ins] = await trx('periods').insert(remapClientId({ ...row, id: undefined })).returning('id');
      periodIdMap.set(oldId, (ins as { id: number }).id);
    }
  }

  const coaData = tables['chart_of_accounts'] as Array<Record<string, unknown>> | undefined;
  if (coaData) {
    for (const row of coaData) {
      const oldId = row.id as number;
      const [ins] = await trx('chart_of_accounts').insert(remapClientId({ ...row, id: undefined })).returning('id');
      coaIdMap.set(oldId, (ins as { id: number }).id);
    }
  }

  const tbData = tables['trial_balance'] as Array<Record<string, unknown>> | undefined;
  if (tbData) {
    for (const row of tbData) {
      await trx('trial_balance').insert({
        ...row,
        id: undefined,
        period_id: periodIdMap.get(row.period_id as number) ?? row.period_id,
        account_id: coaIdMap.get(row.account_id as number) ?? row.account_id,
      });
    }
  }

  const jeData = tables['journal_entries'] as Array<Record<string, unknown>> | undefined;
  if (jeData) {
    for (const row of jeData) {
      const oldId = row.id as number;
      const [ins] = await trx('journal_entries').insert({
        ...row,
        id: undefined,
        period_id: periodIdMap.get(row.period_id as number) ?? row.period_id,
      }).returning('id');
      jeIdMap.set(oldId, (ins as { id: number }).id);
    }
  }

  const jelData = tables['journal_entry_lines'] as Array<Record<string, unknown>> | undefined;
  if (jelData) {
    for (const row of jelData) {
      await trx('journal_entry_lines').insert({
        ...row,
        id: undefined,
        journal_entry_id: jeIdMap.get(row.journal_entry_id as number) ?? row.journal_entry_id,
        account_id: coaIdMap.get(row.account_id as number) ?? row.account_id,
      });
    }
  }

  const btData = tables['bank_transactions'] as Array<Record<string, unknown>> | undefined;
  if (btData) {
    for (const row of btData) {
      await trx('bank_transactions').insert({
        ...row,
        id: undefined,
        client_id: targetClientId,
        account_id: row.account_id ? (coaIdMap.get(row.account_id as number) ?? row.account_id) : null,
      });
    }
  }

  const rulesData = tables['classification_rules'] as Array<Record<string, unknown>> | undefined;
  if (rulesData) {
    for (const row of rulesData) {
      const newAccountId = row.account_id ? (coaIdMap.get(row.account_id as number) ?? row.account_id) : null;
      await trx('classification_rules').insert(remapClientId({ ...row, id: undefined, account_id: newAccountId }));
    }
  }

  const vnData = tables['variance_notes'] as Array<Record<string, unknown>> | undefined;
  if (vnData) {
    for (const row of vnData) {
      await trx('variance_notes').insert({
        ...row,
        id: undefined,
        account_id: coaIdMap.get(row.account_id as number) ?? row.account_id,
        period_id: periodIdMap.get(row.period_id as number) ?? row.period_id,
      });
    }
  }

  const diData = tables['document_imports'] as Array<Record<string, unknown>> | undefined;
  if (diData) {
    for (const row of diData) {
      await trx('document_imports').insert({
        ...row,
        id: undefined,
        period_id: periodIdMap.get(row.period_id as number) ?? row.period_id,
      });
    }
  }
}

async function restoreSettings(tables: Record<string, unknown[]>, trx: Knex.Transaction): Promise<void> {
  // Tax codes: upsert by (return_form, activity_type, tax_code)
  const taxCodesData = tables['tax_codes'] as Array<Record<string, unknown>> | undefined;
  if (taxCodesData && taxCodesData.length > 0) {
    for (const row of taxCodesData) {
      await trx('tax_codes')
        .insert({ ...row })
        .onConflict(['return_form', 'activity_type', 'tax_code'])
        .merge();
    }
  }

  // Tax code software maps: upsert
  const mapsData = tables['tax_code_software_maps'] as Array<Record<string, unknown>> | undefined;
  if (mapsData && mapsData.length > 0) {
    for (const row of mapsData) {
      await trx('tax_code_software_maps').insert({ ...row }).onConflict(['tax_code_id', 'software']).merge();
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
    }
  }

  // Users: match by username, insert new ones (skip existing)
  const usersData = tables['app_users'] as Array<Record<string, unknown>> | undefined;
  if (usersData && usersData.length > 0) {
    for (const row of usersData) {
      const existing = await trx('app_users').where('username', row.username as string).first('id');
      if (!existing) {
        await trx('app_users').insert({ ...row, id: undefined });
      }
    }
  }
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
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ data: null, error: { code: 'BACKUP_ERROR', message } });
  }
});

// POST /api/v1/backup/settings
backupRouter.post('/settings', async (req: AuthRequest, res: Response): Promise<void> => {
  if (!requireAdmin(req, res)) return;
  try {
    const record = await createBackup('settings', { triggerType: 'manual' }, req.user!.userId);
    res.json({ data: record, error: null });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ data: null, error: { code: 'BACKUP_ERROR', message } });
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
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ data: null, error: { code: 'BACKUP_ERROR', message } });
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
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ data: null, error: { code: 'BACKUP_ERROR', message } });
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
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ data: null, error: { code: 'SERVER_ERROR', message } });
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
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ data: null, error: { code: 'SERVER_ERROR', message } });
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
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ data: null, error: { code: 'SERVER_ERROR', message } });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Restore routes
// ─────────────────────────────────────────────────────────────────────────────

const upload = multer({ dest: TEMP_DIR });

// POST /api/v1/restore/upload
restoreRouter.post(
  '/upload',
  (req: Request, res: Response, next: () => void) => {
    if ((req as AuthRequest).user?.role !== 'admin') {
      res.status(403).json({ data: null, error: { code: 'FORBIDDEN', message: 'Admin access required' } });
      return;
    }
    next();
  },
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

      // Verify checksum (stored in DB, not in archive itself since we add checksum after)
      // Just return manifest and temp path for preview

      res.json({
        data: {
          tempFile: path.basename(tbakPath),
          manifest,
        },
        error: null,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      res.status(500).json({ data: null, error: { code: 'UPLOAD_ERROR', message } });
    }
  },
);

// POST /api/v1/restore/execute
restoreRouter.post('/execute', async (req: AuthRequest, res: Response): Promise<void> => {
  if (!requireAdmin(req, res)) return;
  try {
    const { backupId, tempFile, mode, targetClientId } = req.body as {
      backupId?: number;
      tempFile?: string;
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
      filePath = path.join(TEMP_DIR, safeName);
    } else {
      res.status(400).json({ data: null, error: { code: 'VALIDATION_ERROR', message: 'backupId or tempFile required' } });
      return;
    }

    if (!fs.existsSync(filePath)) {
      res.status(404).json({ data: null, error: { code: 'FILE_NOT_FOUND', message: 'Backup file not found' } });
      return;
    }

    const tables = await readZipContents(filePath);
    let newClientId: number | null = null;
    let idMappings: Record<string, Record<number, number>> = {};

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
        await restoreSettings(tables, trx);
      } else {
        throw new Error(`Unknown restore mode: ${mode}`);
      }
    });

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
      },
      error: null,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    // Log failure
    try {
      await db('restore_history').insert({
        backup_id: null,
        restore_mode: (req.body as { mode?: string }).mode ?? 'unknown',
        status: 'failed',
        error_message: message,
        restored_by: (req as AuthRequest).user?.userId ?? null,
      });
    } catch (_e) { /* ignore */ }
    res.status(500).json({ data: null, error: { code: 'RESTORE_ERROR', message } });
  }
});

// GET /api/v1/restore/history
restoreRouter.get('/history', async (req: AuthRequest, res: Response): Promise<void> => {
  if (!requireAdmin(req, res)) return;
  try {
    const rows = await db('restore_history').select('*').orderBy('restored_at', 'desc').limit(100);
    res.json({ data: rows, error: null });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ data: null, error: { code: 'SERVER_ERROR', message } });
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
