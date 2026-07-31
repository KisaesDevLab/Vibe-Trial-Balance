/**
 * Replace-mode restore deletes the target client and re-inserts it from the
 * archive. Three FKs into clients/periods were left at NO ACTION, so that
 * delete raised a foreign-key violation and the whole restore rolled back:
 *
 *   backup_history.client_id
 *   backup_history.period_id
 *   coa_templates.created_from_client_id
 *
 * `replace` always takes a pre-restore backup of the target client first, which
 * inserts a backup_history row pointing at that very client — so the delete was
 * guaranteed to fail. Replace mode could never succeed against a client that had
 * ever been backed up.
 *
 * These are history/provenance rows that should outlive the client but must not
 * block its removal. SET NULL keeps the record: backup_history already carries
 * denormalized `client_name` / `period_name` columns, so a nulled row still reads
 * correctly, and coa_templates.created_from_client_id is only provenance.
 */
exports.up = async function (knex) {
  await knex.schema.alterTable('backup_history', (t) => {
    t.dropForeign(['client_id']);
    t.dropForeign(['period_id']);
    t.foreign('client_id').references('id').inTable('clients').onDelete('SET NULL');
    t.foreign('period_id').references('id').inTable('periods').onDelete('SET NULL');
  });

  await knex.schema.alterTable('coa_templates', (t) => {
    t.dropForeign(['created_from_client_id']);
    t.foreign('created_from_client_id').references('id').inTable('clients').onDelete('SET NULL');
  });
};

exports.down = async function (knex) {
  await knex.schema.alterTable('backup_history', (t) => {
    t.dropForeign(['client_id']);
    t.dropForeign(['period_id']);
    t.foreign('client_id').references('id').inTable('clients');
    t.foreign('period_id').references('id').inTable('periods');
  });

  await knex.schema.alterTable('coa_templates', (t) => {
    t.dropForeign(['created_from_client_id']);
    t.foreign('created_from_client_id').references('id').inTable('clients');
  });
};
