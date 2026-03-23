/**
 * Migration: Add activity_type = 'common' for each return form.
 *
 * For each return_form (1040, 1065, 1120S), collect all unique tax_code numbers
 * across all activity types (business, rental, farm, farm_rental) and create a
 * 'common' entry for each.  When the same numeric code appears in multiple
 * activities, the description is taken from the highest-priority activity type
 * (business > rental > farm > farm_rental).  Software mappings are copied from
 * that same source row.
 */

const FORMS = ['1040', '1065', '1120S'];
const PRIORITY = ['business', 'rental', 'farm', 'farm_rental'];

exports.up = async function(knex) {
  for (const form of FORMS) {
    // 1. Load all system codes for this form (all non-common activities)
    const allCodes = await knex('tax_codes')
      .where({ return_form: form, is_system: true })
      .whereIn('activity_type', PRIORITY)
      .select('*');

    // 2. For each unique tax_code, pick the highest-priority activity's row
    const bestByCode = new Map();
    for (const code of allCodes) {
      const existing = bestByCode.get(code.tax_code);
      if (!existing) {
        bestByCode.set(code.tax_code, code);
      } else {
        if (PRIORITY.indexOf(code.activity_type) < PRIORITY.indexOf(existing.activity_type)) {
          bestByCode.set(code.tax_code, code);
        }
      }
    }

    // 3. Build common rows
    const commonRows = [...bestByCode.values()].map(c => ({
      return_form:       form,
      activity_type:     'common',
      tax_code:          c.tax_code,
      description:       c.description,
      sort_order:        c.sort_order,
      is_system:         true,
      is_active:         true,
      is_m1_adjustment:  c.is_m1_adjustment,
      notes:             null,
    }));

    if (commonRows.length === 0) continue;

    // 4. Insert in chunks of 100
    for (let i = 0; i < commonRows.length; i += 100) {
      await knex('tax_codes').insert(commonRows.slice(i, i + 100));
    }

    // 5. Fetch the newly inserted common code IDs
    const inserted = await knex('tax_codes')
      .where({ return_form: form, activity_type: 'common', is_system: true })
      .select('id', 'tax_code');
    const insertedIdMap = new Map(inserted.map(r => [r.tax_code, r.id]));

    // 6. Fetch software maps from the original best-match rows
    const sourceIds = [...bestByCode.values()].map(c => c.id);
    const sourceMaps = await knex('tax_code_software_maps')
      .whereIn('tax_code_id', sourceIds)
      .where({ is_active: true })
      .select('*');

    const sourceIdToCode = new Map([...bestByCode.values()].map(c => [c.id, c.tax_code]));

    const mapRows = sourceMaps
      .map(m => {
        const codeStr = sourceIdToCode.get(m.tax_code_id);
        const newId   = insertedIdMap.get(codeStr);
        if (!newId) return null;
        return {
          tax_code_id:          newId,
          tax_software:         m.tax_software,
          software_code:        m.software_code,
          software_description: m.software_description,
          is_active:            true,
        };
      })
      .filter(Boolean);

    // 7. Insert software maps in chunks
    for (let i = 0; i < mapRows.length; i += 100) {
      await knex('tax_code_software_maps').insert(mapRows.slice(i, i + 100));
    }

    console.log(`${form}/common: ${commonRows.length} codes, ${mapRows.length} software maps`);
  }
};

exports.down = async function(knex) {
  await knex('tax_codes')
    .where({ activity_type: 'common', is_system: true })
    .whereIn('return_form', FORMS)
    .delete();
};
