/**
 * Add optional override fields to tax_code_software_maps for consolidated export lines.
 * When consolidating multiple accounts into one export row per tax code,
 * these fields provide custom account number and description overrides.
 * Falls back to software_code / software_description when NULL.
 */
exports.up = async function (knex) {
  await knex.schema.alterTable('tax_code_software_maps', (t) => {
    t.string('export_account_number', 100).nullable();
    t.string('export_description', 255).nullable();
  });
};

exports.down = async function (knex) {
  await knex.schema.alterTable('tax_code_software_maps', (t) => {
    t.dropColumn('export_account_number');
    t.dropColumn('export_description');
  });
};
