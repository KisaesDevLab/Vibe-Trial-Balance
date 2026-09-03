/**
 * DELETE /periods/:id runs a bare `DELETE FROM periods` and relies on every
 * child table cascading. Five references were created with no delete action
 * (Postgres default NO ACTION), so deleting any period that had ever been used
 * failed with a foreign-key violation, which the route reported as a 500:
 *
 *   bank_transactions.period_id       — bank activity imported or keyed in
 *   document_imports.period_id        — every CSV / PDF / QBO import, even cancelled
 *   variance_notes.period_id          — TB Report / flux notes
 *   variance_notes.compare_period_id  — the other side of a flux note
 *   bank_reconciliations.period_id    — reconciliations (items cascade from them)
 *   periods.rolled_forward_from       — a later period rolled from this one
 *
 * The client-delete path (`deleteClientData` in routes/backup.ts) already clears
 * each of these explicitly before removing periods, which is why deleting a whole
 * client worked while deleting one period did not. CASCADE here mirrors that
 * behaviour for the period-scoped rows. The roll-forward pointer is provenance,
 * not ownership, so it goes to SET NULL: the later period survives with its link
 * cleared, the same treatment backup_history got in 20260731000001.
 */
exports.up = async function (knex) {
  await knex.schema.alterTable('bank_transactions', (t) => {
    t.dropForeign(['period_id']);
    t.foreign('period_id').references('id').inTable('periods').onDelete('CASCADE');
  });
  await knex.schema.alterTable('document_imports', (t) => {
    t.dropForeign(['period_id']);
    t.foreign('period_id').references('id').inTable('periods').onDelete('CASCADE');
  });
  await knex.schema.alterTable('variance_notes', (t) => {
    t.dropForeign(['period_id']);
    t.dropForeign(['compare_period_id']);
    t.foreign('period_id').references('id').inTable('periods').onDelete('CASCADE');
    t.foreign('compare_period_id').references('id').inTable('periods').onDelete('CASCADE');
  });
  await knex.schema.alterTable('bank_reconciliations', (t) => {
    t.dropForeign(['period_id']);
    t.foreign('period_id').references('id').inTable('periods').onDelete('CASCADE');
  });
  await knex.schema.alterTable('periods', (t) => {
    t.dropForeign(['rolled_forward_from']);
    t.foreign('rolled_forward_from').references('id').inTable('periods').onDelete('SET NULL');
  });
};

exports.down = async function (knex) {
  await knex.schema.alterTable('bank_transactions', (t) => {
    t.dropForeign(['period_id']);
    t.foreign('period_id').references('id').inTable('periods');
  });
  await knex.schema.alterTable('document_imports', (t) => {
    t.dropForeign(['period_id']);
    t.foreign('period_id').references('id').inTable('periods');
  });
  await knex.schema.alterTable('variance_notes', (t) => {
    t.dropForeign(['period_id']);
    t.dropForeign(['compare_period_id']);
    t.foreign('period_id').references('id').inTable('periods');
    t.foreign('compare_period_id').references('id').inTable('periods');
  });
  await knex.schema.alterTable('bank_reconciliations', (t) => {
    t.dropForeign(['period_id']);
    t.foreign('period_id').references('id').inTable('periods');
  });
  await knex.schema.alterTable('periods', (t) => {
    t.dropForeign(['rolled_forward_from']);
    t.foreign('rolled_forward_from').references('id').inTable('periods');
  });
};
