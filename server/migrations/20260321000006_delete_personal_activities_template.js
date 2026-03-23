exports.up = async function(knex) {
  // Remove the Personal Activities system template (not applicable to business clients)
  await knex('coa_templates').where({ business_type: 'personal_activities', is_system: true }).delete();
};

exports.down = async function(knex) {
  // Re-insert is non-trivial; down migration is intentionally a no-op
};
