/**
 * Migration: Create Form 1120 (C-Corporation) tax codes from 1120S template.
 *
 * Copies all 1120S system rows (all activity types including common) to 1120,
 * updating descriptions so "1120S" references become "1120".
 * Software mappings are copied from the 1120S source rows — a subsequent
 * migration will correct these to the proper 1120-specific codes once
 * the per-software crosswalk research is complete.
 */

const ACTIVITY_TYPES = ['business', 'rental', 'farm', 'farm_rental', 'common'];

function updateDescription(desc) {
  // Replace form-name references in descriptions
  return desc
    .replace(/^1120S;/, '1120;')
    .replace(/^1120S /, '1120 ');
}

exports.up = async function(knex) {
  // 1. Load all 1120S system codes
  const source1120S = await knex('tax_codes')
    .where({ return_form: '1120S', is_system: true })
    .whereIn('activity_type', ACTIVITY_TYPES)
    .select('*');

  if (source1120S.length === 0) {
    console.log('No 1120S system codes found — skipping.');
    return;
  }

  // 2. Build 1120 rows
  const newRows = source1120S.map(r => ({
    return_form:      '1120',
    activity_type:    r.activity_type,
    tax_code:         r.tax_code,
    description:      updateDescription(r.description),
    sort_order:       r.sort_order,
    is_system:        true,
    is_active:        true,
    is_m1_adjustment: r.is_m1_adjustment,
    notes:            r.notes,
  }));

  // 3. Insert in chunks of 100
  for (let i = 0; i < newRows.length; i += 100) {
    await knex('tax_codes').insert(newRows.slice(i, i + 100));
  }

  // 4. Fetch the inserted IDs (keyed by activity_type + tax_code)
  const inserted = await knex('tax_codes')
    .where({ return_form: '1120', is_system: true })
    .select('id', 'activity_type', 'tax_code');

  const insertedMap = new Map(inserted.map(r => [`${r.activity_type}|${r.tax_code}`, r.id]));

  // 5. Build a lookup from 1120S source id → (activity_type, tax_code)
  const sourceIdToKey = new Map(source1120S.map(r => [r.id, `${r.activity_type}|${r.tax_code}`]));

  // 6. Fetch software maps from 1120S source rows
  const sourceIds = source1120S.map(r => r.id);
  const sourceMaps = await knex('tax_code_software_maps')
    .whereIn('tax_code_id', sourceIds)
    .where({ is_active: true })
    .select('*');

  // 7. Remap to new 1120 IDs
  const mapRows = sourceMaps
    .map(m => {
      const key   = sourceIdToKey.get(m.tax_code_id);
      const newId = key ? insertedMap.get(key) : null;
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

  // 8. Insert software maps in chunks
  for (let i = 0; i < mapRows.length; i += 100) {
    await knex('tax_code_software_maps').insert(mapRows.slice(i, i + 100));
  }

  console.log(`Form 1120: inserted ${newRows.length} codes, ${mapRows.length} software maps (copied from 1120S — pending software-specific corrections).`);
};

exports.down = async function(knex) {
  await knex('tax_codes')
    .where({ return_form: '1120', is_system: true })
    .delete();
};
