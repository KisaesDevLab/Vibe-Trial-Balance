/**
 * Migration: Period locking + audit log
 */
exports.up = async function (knex) {
  // Add lock columns to periods (guard in case already applied)
  const hasLockedAt = await knex.schema.hasColumn('periods', 'locked_at');
  if (!hasLockedAt) {
    await knex.schema.table('periods', (t) => {
      t.timestamp('locked_at', { useTz: true }).nullable();
      t.integer('locked_by').unsigned().nullable().references('id').inTable('app_users').onDelete('SET NULL');
    });
  }

  // Audit log table (guard in case already exists)
  const hasAuditLog = await knex.schema.hasTable('audit_log');
  if (!hasAuditLog) {
    await knex.schema.createTable('audit_log', (t) => {
      t.increments('id').primary();
      t.integer('user_id').unsigned().nullable().references('id').inTable('app_users').onDelete('SET NULL');
      t.integer('period_id').unsigned().nullable().references('id').inTable('periods').onDelete('CASCADE');
      t.string('entity_type', 50).notNullable(); // 'journal_entry', 'bank_transaction', 'period'
      t.integer('entity_id').nullable();
      t.string('action', 30).notNullable();       // 'create', 'update', 'delete', 'lock', 'unlock', 'import', 'classify'
      t.text('description').nullable();
      t.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());
      t.index(['period_id', 'created_at']);
    });
  }
};

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('audit_log');
  await knex.schema.table('periods', (t) => {
    t.dropColumn('locked_at');
    t.dropColumn('locked_by');
  });
};
