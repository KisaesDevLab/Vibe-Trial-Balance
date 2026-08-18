/**
 * Remove the legacy alpha system tax codes (GROSS_RECEIPTS, BS_CASH,
 * REPORTING_ONLY, ...).
 *
 * Migration 20260321000007 replaced every system tax code with the numeric
 * crosswalk set, but seed files 004/005/006 (now deleted) kept re-inserting
 * the old alpha canonical codes — the Docker entrypoint runs `knex seed:run`
 * after migrations on a fresh database, and `npm run seed` did the same on
 * existing ones. The result was two rows per tax line in every dropdown
 * (e.g. "100 - Gross receipts or sales" and "GROSS_RECEIPTS - Gross Receipts
 * or Sales"). System tax codes are numeric only.
 *
 * Existing references are preserved where the target is unambiguous:
 *   - chart_of_accounts.tax_code_id / tax_line
 *   - coa_template_tax_codes.tax_code_id
 *   - export_consolidation_settings.tax_code_id
 * A legacy code is remapped to the numeric code in the same return_form +
 * activity_type whose description matches (after normalisation) exactly one
 * row. The six "control" codes (REPORTING_ONLY, DONOTMAP, MEMO, INTERCOMPANY,
 * SUSPENSE, PRIOR_YEAR_ADJUSTMENT) all mean "exclude from the return" and map
 * to the crosswalk's 88888 "reporting only no mapping" for the owner's
 * form/activity. Anything else is cleared (tax_code_id + tax_line -> NULL) so
 * the account shows as unmapped rather than exporting an alpha code no tax
 * software understands. Counts are logged.
 */

const CONTROL_CODES = new Set(['REPORTING_ONLY', 'DONOTMAP', 'MEMO', 'INTERCOMPANY', 'SUSPENSE', 'PRIOR_YEAR_ADJUSTMENT']);
const REPORTING_ONLY_CODE = '88888';
const ENTITY_TO_FORM = { '1040_C': '1040', '1065': '1065', '1120': '1120', '1120S': '1120S' };

function normalize(desc) {
  // Crosswalk descriptions carry a "1065; L01a - " prefix; legacy ones don't.
  return String(desc || '')
    .replace(/^[^-]*-\s*/, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

exports.up = async function (knex) {
  const legacy = await knex('tax_codes')
    .where('is_system', true)
    .whereRaw("tax_code !~ '^[0-9]+$'")
    .select('id', 'return_form', 'activity_type', 'tax_code', 'description');
  if (legacy.length === 0) {
    console.log('[alpha tax codes] none found - nothing to do');
    return;
  }
  const legacyIds = legacy.map((r) => r.id);
  const legacyById = new Map(legacy.map((r) => [r.id, r]));

  const numeric = await knex('tax_codes')
    .whereRaw("tax_code ~ '^[0-9]+$'")
    .select('id', 'return_form', 'activity_type', 'tax_code', 'description');
  const numericById = new Map(numeric.map((n) => [n.id, n]));

  // "form|activity|normalizedDesc" -> [ids]
  const byDesc = new Map();
  // "form|activity" -> id of 88888
  const reportingOnlyByScope = new Map();
  for (const n of numeric) {
    const scope = n.return_form + '|' + n.activity_type;
    const key = scope + '|' + normalize(n.description);
    if (!byDesc.has(key)) byDesc.set(key, []);
    byDesc.get(key).push(n.id);
    if (n.tax_code === REPORTING_ONLY_CODE) reportingOnlyByScope.set(scope, n.id);
  }

  // Static remap for the per-form legacy codes (unique description match).
  const remap = new Map(); // legacyId -> numericId
  for (const l of legacy) {
    if (CONTROL_CODES.has(l.tax_code)) continue;
    const cands = byDesc.get(l.return_form + '|' + l.activity_type + '|' + normalize(l.description)) || [];
    if (cands.length === 1) remap.set(l.id, cands[0]);
  }

  /** Replacement id for a legacy code, given the owner's form/activity scope. */
  function resolve(legacyId, returnForm, activityType) {
    const l = legacyById.get(legacyId);
    if (!l) return null;
    if (CONTROL_CODES.has(l.tax_code)) {
      return reportingOnlyByScope.get(returnForm + '|' + activityType) || null;
    }
    return remap.get(legacyId) || null;
  }

  // -- chart_of_accounts ------------------------------------------------------
  const accounts = await knex('chart_of_accounts as a')
    .join('clients as c', 'c.id', 'a.client_id')
    .whereIn('a.tax_code_id', legacyIds)
    .select('a.id', 'a.tax_code_id', 'c.entity_type', 'c.activity_type');
  let acctRemapped = 0;
  let acctCleared = 0;
  for (const a of accounts) {
    const form = ENTITY_TO_FORM[a.entity_type] || 'common';
    const newId = resolve(a.tax_code_id, form, a.activity_type || 'business');
    if (newId) {
      const tc = numericById.get(newId);
      await knex('chart_of_accounts').where('id', a.id).update({
        tax_code_id: newId,
        tax_line: tc ? tc.tax_code : null,
        updated_at: knex.fn.now(),
      });
      acctRemapped++;
    } else {
      await knex('chart_of_accounts').where('id', a.id).update({
        tax_code_id: null,
        tax_line: null,
        updated_at: knex.fn.now(),
      });
      acctCleared++;
    }
  }

  // -- coa_template_tax_codes (nullable FK, NO ACTION) -------------------------
  let tplRemapped = 0;
  let tplCleared = 0;
  if (await knex.schema.hasTable('coa_template_tax_codes')) {
    const tplRows = await knex('coa_template_tax_codes')
      .whereIn('tax_code_id', legacyIds)
      .select('id', 'tax_code_id', 'return_form', 'activity_type');
    for (const t of tplRows) {
      const newId = resolve(t.tax_code_id, t.return_form, t.activity_type);
      await knex('coa_template_tax_codes').where('id', t.id).update({ tax_code_id: newId });
      if (newId) tplRemapped++; else tplCleared++;
    }
  }

  // -- export_consolidation_settings (NOT NULL FK, NO ACTION) ------------------
  let ecsRemapped = 0;
  let ecsDeleted = 0;
  if (await knex.schema.hasTable('export_consolidation_settings')) {
    const ecsRows = await knex('export_consolidation_settings as e')
      .join('clients as c', 'c.id', 'e.client_id')
      .whereIn('e.tax_code_id', legacyIds)
      .select('e.id', 'e.client_id', 'e.tax_code_id', 'e.tax_software', 'c.entity_type', 'c.activity_type');
    for (const e of ecsRows) {
      const form = ENTITY_TO_FORM[e.entity_type] || 'common';
      const newId = resolve(e.tax_code_id, form, e.activity_type || 'business');
      const clash = newId
        ? await knex('export_consolidation_settings')
            .where({ client_id: e.client_id, tax_code_id: newId, tax_software: e.tax_software })
            .first('id')
        : null;
      if (newId && !clash) {
        await knex('export_consolidation_settings').where('id', e.id).update({ tax_code_id: newId });
        ecsRemapped++;
      } else {
        await knex('export_consolidation_settings').where('id', e.id).delete();
        ecsDeleted++;
      }
    }
  }

  // -- delete the legacy codes (software maps cascade) -------------------------
  const deleted = await knex('tax_codes').whereIn('id', legacyIds).delete();

  console.log(
    '[alpha tax codes] deleted ' + deleted + ' legacy system codes; ' +
    'accounts remapped ' + acctRemapped + ', cleared ' + acctCleared + '; ' +
    'template rows remapped ' + tplRemapped + ', cleared ' + tplCleared + '; ' +
    'consolidation rows remapped ' + ecsRemapped + ', deleted ' + ecsDeleted,
  );
};

exports.down = async function () {
  // Irreversible by design: the legacy alpha codes were duplicates of the
  // numeric crosswalk and are intentionally gone. Nothing to restore.
};
