// Copyright 2025-2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Use is limited to qualifying small businesses. See LICENSE for terms.

import { Knex } from 'knex';
import { db } from '../db';

/** Throws a 409-coded error if the period is locked, or a 404 if the period doesn't exist.
 *
 *  When called with a transaction, takes a row-level FOR UPDATE lock on the `periods` row
 *  so the caller's subsequent writes cannot race a concurrent lock/unlock. This closes a
 *  TOCTOU window where another transaction would mark the period locked between our check
 *  and our write. Callers performing mutations MUST pass a trx.
 *
 *  When called without a trx, performs a plain read — acceptable only for read-only paths
 *  (reports / comparisons) where a stale answer is fine.
 */
export async function assertPeriodUnlocked(periodId: number, trx?: Knex.Transaction): Promise<void> {
  const q = trx ?? db;
  let query = q('periods').where({ id: periodId });
  if (trx) {
    query = query.forUpdate();
  }
  const period = await query.first('id', 'locked_at');
  if (!period) {
    throw Object.assign(
      new Error('Period not found.'),
      { code: 'PERIOD_NOT_FOUND', status: 404 },
    );
  }
  if (period.locked_at) {
    throw Object.assign(
      new Error('This period is locked and cannot be modified. Unlock it first.'),
      { code: 'PERIOD_LOCKED', status: 409 },
    );
  }
}

interface AuditEntry {
  userId: number | null;
  periodId: number | null;
  /** Optional client_id. If not set and periodId is, it will be resolved automatically. */
  clientId?: number | null;
  entityType: string;
  entityId?: number | null;
  action: string;
  description?: string;
  tableName?: string;
}

/** Insert a row into audit_log. Fire-and-forget safe — errors are silently swallowed.
 *  When called within a transaction, uses a SAVEPOINT so that audit insert failures
 *  do not poison the parent transaction (PostgreSQL aborts the entire txn on any error). */
export async function logAudit(entry: AuditEntry, trx?: Knex.Transaction): Promise<void> {
  const q = trx ?? db;
  try {
    // If the caller didn't supply clientId but did supply periodId, resolve
    // it now so the audit row survives downstream period/client remapping.
    let clientId = entry.clientId ?? null;
    if (clientId === null && entry.periodId !== null) {
      try {
        const row = await q('periods').where({ id: entry.periodId }).first('client_id');
        clientId = (row?.client_id as number | undefined) ?? null;
      } catch {
        clientId = null;
      }
    }

    if (trx) {
      await trx.raw('SAVEPOINT audit_savepoint');
    }
    await q('audit_log').insert({
      user_id: entry.userId ?? null,
      period_id: entry.periodId ?? null,
      client_id: clientId,
      entity_type: entry.entityType,
      entity_id: entry.entityId ?? null,
      action: entry.action,
      description: entry.description ?? null,
      table_name: entry.tableName ?? entry.entityType,
    });
    if (trx) {
      await trx.raw('RELEASE SAVEPOINT audit_savepoint');
    }
  } catch {
    if (trx) {
      await trx.raw('ROLLBACK TO SAVEPOINT audit_savepoint').catch(() => {});
    }
    // Audit failures must never block the main operation
  }
}
