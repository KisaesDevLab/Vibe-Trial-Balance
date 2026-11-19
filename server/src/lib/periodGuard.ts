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
      // expose: a route that does not map PERIOD_LOCKED answers 409, not 500.
      { code: 'PERIOD_LOCKED', status: 409, expose: true },
    );
  }
}

/**
 * Refuses (409 PERIOD_LOCKED) a write into any of these periods that is
 * closed, for writes that name their periods through their rows (bank rows,
 * tasks, notes, tickmarks, reconciliations, attachments). Takes each period
 * row FOR UPDATE, in id order, inside the write's transaction, so a lock
 * cannot land between the check and the write. Null ids (rows that belong
 * to no period) and periods that do not exist are skipped: the write itself
 * answers for those. Owner 2026-11-19: a closed period is read-only for
 * every period write, sign-offs and Statement Writer excepted.
 */
export async function assertPeriodsOpen(
  trx: Knex.Transaction,
  periodIds: Iterable<number | string | null | undefined>,
): Promise<void> {
  for (const id of periodIdList(periodIds)) {
    const row = await trx('periods').where({ id }).forUpdate().first('id', 'locked_at');
    if (row?.locked_at) {
      throw Object.assign(
        new Error('This period is locked and cannot be modified. Unlock it first.'),
        { code: 'PERIOD_LOCKED', status: 409, expose: true },
      );
    }
  }
}

/**
 * For writes that should SKIP rows of a closed period instead of refusing
 * the batch (AI suggestions): locks the periods, as `assertPeriodsOpen`, and
 * returns the ids that are closed.
 */
export async function lockAndListClosed(trx: Knex.Transaction, periodIds: Iterable<number | string | null | undefined>): Promise<Set<number>> {
  const closed = new Set<number>();
  for (const id of periodIdList(periodIds)) {
    const row = await trx('periods').where({ id }).forUpdate().first('id', 'locked_at');
    if (row?.locked_at) closed.add(id);
  }
  return closed;
}

function periodIdList(periodIds: Iterable<number | string | null | undefined>): number[] {
  return [...new Set([...periodIds].map((v) => Number(v)).filter((n) => Number.isInteger(n) && n > 0))].sort((a, b) => a - b);
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
