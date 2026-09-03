// Copyright 2025-2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Use is limited to qualifying small businesses. See LICENSE for terms.

/**
 * Turn a Postgres foreign-key violation into something a user can act on.
 *
 * A delete that trips a child table's FK used to surface as "An internal error
 * occurred" with the real reason only in the server log. The `pg` driver puts
 * the violating table and constraint on the error, which is enough to say
 * WHAT is still attached — so a future table that forgets `onDelete` produces
 * a readable 409 instead of a 500.
 */

/** SQLSTATE 23503 */
export const PG_FOREIGN_KEY_VIOLATION = '23503';

export interface PgErrorShape {
  code?: string;
  table?: string;
  constraint?: string;
  detail?: string;
}

export function isForeignKeyViolation(err: unknown): err is PgErrorShape {
  return typeof err === 'object' && err !== null && (err as PgErrorShape).code === PG_FOREIGN_KEY_VIOLATION;
}

/** SQLSTATE P0001 — a PL/pgSQL `RAISE EXCEPTION` with no explicit code, i.e. one of our own triggers refusing. */
export const PG_RAISE_EXCEPTION = 'P0001';

export function isRaisedException(err: unknown): err is PgErrorShape & { message: string } {
  return typeof err === 'object' && err !== null
    && (err as PgErrorShape).code === PG_RAISE_EXCEPTION
    && typeof (err as { message?: unknown }).message === 'string';
}

/** Human labels for the tables most likely to hold on to a parent row. */
const TABLE_LABELS: Record<string, string> = {
  bank_transactions: 'bank transactions',
  bank_reconciliations: 'bank reconciliations',
  reconciliation_items: 'reconciliation items',
  document_imports: 'import history',
  variance_notes: 'variance notes',
  trial_balance: 'trial balance rows',
  journal_entries: 'journal entries',
  journal_entry_lines: 'journal entry lines',
  py_comparison_data: 'prior-year tie-out data',
  engagement_tasks: 'engagement checklist items',
  m1_adjustments: 'M-1 adjustments',
  tb_tickmarks: 'tickmarks',
  lead_sheet_signoffs: 'lead sheet sign-offs',
  lead_sheet_attachments: 'lead sheet attachments',
  lead_sheet_notes: 'lead schedule notes',
  client_documents: 'documents',
  backup_history: 'backup history',
  periods: 'a period rolled forward from it',
  chart_of_accounts: 'chart of accounts rows',
  classification_rules: 'classification rules',
  audit_log: 'audit log entries',
};

/** "bank transactions" from the error's table, or a cleaned-up table name. */
export function describeBlockingTable(err: PgErrorShape): string {
  const table = err.table ?? constraintTable(err.constraint);
  if (!table) return 'related records';
  return TABLE_LABELS[table] ?? table.replace(/_/g, ' ');
}

/** knex names FKs `<table>_<column>_foreign`; recover the table when `table` is absent. */
function constraintTable(constraint: string | undefined): string | null {
  if (!constraint || !constraint.endsWith('_foreign')) return null;
  // Longest known table prefix wins: "bank_transactions_period_id_foreign".
  const known = Object.keys(TABLE_LABELS)
    .filter((t) => constraint.startsWith(`${t}_`))
    .sort((a, b) => b.length - a.length)[0];
  return known ?? null;
}

/**
 * "Cannot delete this period: it still has bank transactions attached."
 * `subject` is the thing being deleted ("this period", "the client").
 */
export function foreignKeyBlockMessage(err: PgErrorShape, subject: string): string {
  return `Cannot delete ${subject}: it still has ${describeBlockingTable(err)} attached. Remove those first, or contact an administrator.`;
}
