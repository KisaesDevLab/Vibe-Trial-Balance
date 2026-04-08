/**
 * Migration: Add client_id to audit_log.
 *
 * The audit log records period_id and entity_type/entity_id, but to answer
 * "who touched client X this week?" you currently have to walk through
 * periods.client_id — and that join breaks after an as_new restore remaps ids.
 * Denormalizing client_id onto the audit row makes the audit log stable
 * across restores.
 */
exports.up = async function (knex) {
  const hasClientId = await knex.schema.hasColumn('audit_log', 'client_id');
  if (!hasClientId) {
    await knex.schema.table('audit_log', (t) => {
      t.integer('client_id').unsigned().nullable().references('id').inTable('clients').onDelete('SET NULL');
    });
    await knex.schema.table('audit_log', (t) => {
      t.index(['client_id', 'created_at']);
    });
  }
};

exports.down = async function (knex) {
  await knex.schema.table('audit_log', (t) => {
    t.dropColumn('client_id');
  });
};
