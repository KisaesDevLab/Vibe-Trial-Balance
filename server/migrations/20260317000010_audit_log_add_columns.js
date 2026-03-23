/**
 * Migration: Add missing columns to audit_log
 *
 * The initial schema created audit_log with (user_id, action, table_name, record_id,
 * old_values, new_values, created_at). Later code expects period_id, entity_type,
 * entity_id, and description. Add them if not present.
 */
exports.up = async function (knex) {
  const hasPeriodId   = await knex.schema.hasColumn('audit_log', 'period_id');
  const hasEntityType = await knex.schema.hasColumn('audit_log', 'entity_type');
  const hasEntityId   = await knex.schema.hasColumn('audit_log', 'entity_id');
  const hasDescription = await knex.schema.hasColumn('audit_log', 'description');

  await knex.schema.table('audit_log', (t) => {
    if (!hasPeriodId) {
      t.integer('period_id').unsigned().nullable().references('id').inTable('periods').onDelete('CASCADE');
    }
    if (!hasEntityType) {
      t.string('entity_type', 50).nullable();
    }
    if (!hasEntityId) {
      t.integer('entity_id').nullable();
    }
    if (!hasDescription) {
      t.text('description').nullable();
    }
  });

  if (!hasPeriodId) {
    await knex.schema.table('audit_log', (t) => {
      t.index(['period_id', 'created_at']);
    });
  }
};

exports.down = async function (knex) {
  await knex.schema.table('audit_log', (t) => {
    t.dropColumn('period_id');
    t.dropColumn('entity_type');
    t.dropColumn('entity_id');
    t.dropColumn('description');
  });
};
