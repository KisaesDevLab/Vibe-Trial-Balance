/**
 * Phase 4: Tax Code Management System
 * Adds activity_type column to clients table
 */
exports.up = (knex) => knex.schema.table('clients', (t) => {
  t.string('activity_type', 20).defaultTo('business');
});

exports.down = (knex) => knex.schema.table('clients', (t) => {
  t.dropColumn('activity_type');
});
