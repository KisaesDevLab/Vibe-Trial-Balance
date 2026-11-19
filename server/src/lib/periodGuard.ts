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
export async function assertPeriodUnlocked(
  periodId: number,
  trx?: Knex.Transaction,
  opts: {
    /**
     * Desktop sync S4's merge, writing for the device that holds this
     * check-out: the one caller a checked-out period lets through.
     */
    syncCheckoutId?: number;
  } = {},
): Promise<void> {
  const q = trx ?? db;
  let query = q('periods').where({ id: periodId });
  if (trx) {
    query = query.forUpdate();
  }
  const period = await query.first('id', 'locked_at', 'is_reference');
  if (!period) {
    throw Object.assign(
      new Error('Period not found.'),
      { code: 'PERIOD_NOT_FOUND', status: 404 },
    );
  }
  if (period.is_reference) {
    // PERIOD_LOCKED, so every route that maps a locked period (about twenty)
    // answers 409 with this message rather than a 500; `reference` tells why.
    throw Object.assign(
      new Error('This period came along only as a reference for another period: it holds no data here and cannot be changed.'),
      { code: 'PERIOD_LOCKED', status: 409, reference: true },
    );
  }
  if (period.locked_at) {
    throw Object.assign(
      new Error('This period is locked and cannot be modified. Unlock it first.'),
      { code: 'PERIOD_LOCKED', status: 409 },
    );
  }
  // Desktop sync (S3): a period a desktop has checked out is that desktop's
  // until it sends it back or an admin releases it. `expose` lets the code
  // and message through `sendServerError`, so a route that only maps
  // PERIOD_LOCKED still answers 409 PERIOD_CHECKED_OUT.
  const out = await checkedOutBy(q, periodId);
  if (out && out.id !== opts.syncCheckoutId) {
    throw Object.assign(
      new Error(`This period is checked out to ${out.user} on "${out.device}" since ${out.since.toISOString().slice(0, 10)}. It can be changed once they send it back, or an admin releases it.`),
      { code: 'PERIOD_CHECKED_OUT', status: 409, expose: true, checkout: out },
    );
  }
}

export interface PeriodCheckoutHolder {
  id: number;
  user: string;
  device: string;
  deviceId: number;
  since: Date;
}

/** The live check-out of a period, if any (desktop sync S3). */
export async function checkedOutBy(q: Knex | Knex.Transaction, periodId: number): Promise<PeriodCheckoutHolder | null> {
  const row = await q('period_checkouts as c')
    .join('sync_devices as d', 'd.id', 'c.device_id')
    .join('app_users as u', 'u.id', 'c.user_id')
    .where('c.period_id', periodId)
    .whereNull('c.released_at')
    .first('c.id', 'c.created_at', 'd.id as device_id', 'd.name as device', 'u.display_name', 'u.username');
  if (!row) return null;
  return { id: row.id, user: row.display_name ?? row.username, device: row.device, deviceId: row.device_id, since: new Date(row.created_at) };
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
