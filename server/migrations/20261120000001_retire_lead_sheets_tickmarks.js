/**
 * A lead sheet or a client tickmark that has history in a closed (locked)
 * period is retired instead of deleted: hidden from lists and pickers, its
 * sign-offs, notes, attachments and placed tickmarks in closed periods kept.
 */
exports.up = async function (knex) {
  for (const table of ['lead_sheets', 'tickmark_library']) {
    if (!(await knex.schema.hasColumn(table, 'retired_at'))) {
      await knex.schema.alterTable(table, (t) => {
        t.timestamp('retired_at', { useTz: true }).nullable();
      });
    }
  }
};

exports.down = async function (knex) {
  for (const table of ['lead_sheets', 'tickmark_library']) {
    if (await knex.schema.hasColumn(table, 'retired_at')) {
      await knex.schema.alterTable(table, (t) => {
        t.dropColumn('retired_at');
      });
    }
  }
};
