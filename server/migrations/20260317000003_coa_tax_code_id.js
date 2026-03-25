/**
 * Phase 4: Tax Code Management System
 * Adds tax_code_id FK, tax_line_source, and tax_line_confidence to chart_of_accounts.
 * Keeps existing tax_line column for backward compatibility.
 */
exports.up = (knex) => knex.schema.table('chart_of_accounts', (t) => {
  t.integer('tax_code_id').nullable().references('id').inTable('tax_codes').onDelete('SET NULL');
  t.string('tax_line_source', 20).nullable(); // manual, ai, pattern, prior_year
  t.decimal('tax_line_confidence', 4, 2).nullable();
  t.index(['tax_code_id']);
});

exports.down = (knex) => knex.schema.table('chart_of_accounts', (t) => {
  t.dropIndex(['tax_code_id']);
  t.dropColumn('tax_code_id');
  t.dropColumn('tax_line_source');
  t.dropColumn('tax_line_confidence');
});
