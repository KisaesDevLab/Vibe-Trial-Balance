import { Knex } from 'knex';
import { db } from '../db';

/** Throws a 409-coded error if the period is locked. Pass a transaction or the global db. */
export async function assertPeriodUnlocked(periodId: number, trx?: Knex.Transaction): Promise<void> {
  const q = trx ?? db;
  const period = await q('periods').where({ id: periodId }).first('locked_at');
  if (period?.locked_at) {
    throw Object.assign(
      new Error('This period is locked and cannot be modified. Unlock it first.'),
      { code: 'PERIOD_LOCKED', status: 409 },
    );
  }
}

interface AuditEntry {
  userId: number | null;
  periodId: number | null;
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
    if (trx) {
      await trx.raw('SAVEPOINT audit_savepoint');
    }
    await q('audit_log').insert({
      user_id: entry.userId ?? null,
      period_id: entry.periodId ?? null,
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
