/**
 * Migration: Fix Form 1120 (C-Corp) tax code descriptions and software mappings.
 *
 * Form 1120 (C-Corp) differs from 1120S (S-Corp) in key structural ways:
 *  - No Schedule K pass-through items (K-1 items don't exist for C-corps)
 *  - Schedule M-2 tracks retained earnings, NOT AAA/OAA accounts
 *  - M-1 line references differ slightly
 *  - Interest/dividend income go on main form lines, not Sch K
 *
 * This migration:
 *  1. Updates descriptions on 1120 codes that still reference 1120S structure
 *  2. Clears incorrect software codes (Lacerte/GoSystem/CCH) for items where
 *     the 1120S codes definitively don't apply to 1120
 *  3. Applies correct software codes where known
 *
 * Software code patterns for Form 1120:
 *   UltraTax CS  – same numeric codes as 1120S for equivalent line items
 *   Lacerte      – uses line-number codes; main-form items same as 1120S where
 *                  lines match; Sch K codes (K04, K10, etc.) are 1120S-only
 *   GoSystem RS  – 30-xxx/31-xxx income, 40-xxx/41-xxx deductions (same ranges
 *                  as 1120S for main-form items); 34-xxx Sch K codes don't apply
 *   CCH Axcess   – 1120 uses 20xxx.xxxx range vs 1120S 10xxx.xxxx range
 *                  Balance-sheet items (10100–10165) are shared across both forms
 */

// Description corrections: maps tax_code → new description for 1120
// Applies to all activity types within return_form = '1120'
const DESC_CORRECTIONS = {
  // ── Sch K pass-through items → 1120 main-form equivalents ──────────────────
  '150':  '1120; L5 - Interest income (non-U.S.)',
  '151':  '1120; L5 - Interest on U.S. obligations',
  '153':  'Sch C; Other portfolio income (loss)',
  '154':  '1120; L10 - Other income',
  '155':  '1120; L10 - Mining exploration costs recapture',
  '156':  'Sch C; L01 - Ordinary dividends',
  '225':  '1120; L19 - Charitable contributions (60% limit)',
  '226':  '1120; L19 - Charitable contributions (30% limit)',
  '228':  '1120; L26 - Section 179 expense deduction',
  '230':  '1120; L26 - Other deductions',
  '231':  '1120; L18 - Interest expense (investment)',
  '234':  '1120; L26 - Other deductions (Sec 59(e) expenditures)',
  '237':  '1120; L26 - Other deductions (preproductive period)',
  '238':  '1120; L26 - Other deductions (early withdrawal penalty)',
  '242':  '1120; L10 - Sec 951(a) income inclusions',
  '245':  '1120; L26 - Other portfolio deductions',
  '246':  '1120; L26 - Other deductions (reforestation)',
  '390':  '1120; L19 - Charitable contributions (noncash)',

  // ── Sch M-2: AAA/OAA/UTI → retained-earnings analysis ─────────────────────
  '490':  'Sch M-2; L03 - Other increases to retained earnings',
  '491':  'Sch M-2; L03 - Other increases to retained earnings',
  '492':  'Sch M-2; L05 - Distributions (cash)',
  '493':  'Sch M-2; L05 - Distributions (property)',
  '494':  'Sch M-2; L05 - Other decreases',
  '495':  'Sch M-2; L05 - Other decreases',
  '496':  'Sch M-2; L05 - Other decreases',
  '497':  'Sch M-2; L05 - Nondividend distributions',
  '498':  'Sch M-2; L05 - Dividend distributions',

  // ── Sch L equity: S-corp shareholder accounts → C-corp equivalents ─────────
  '467':  'Sch L; L24 - Retained earnings - unappropriated',
  '468':  'Sch L; L24 - Retained earnings (timing differences)',
  '469':  'Sch L; L24 - Other retained earnings adjustments',
  '470':  'Sch L; L24 - Retained earnings (other)',
  '839':  'Sch L; L24 - Retained earnings - timing differences',

  // ── Sch M-1: remove "Sch K" references (not applicable to C-corp) ──────────
  '481':  'Sch M-1; L02 - Income on return not recorded on books',
  '482':  'Sch M-1; L03 - Expenses on books not deducted on return',
  '485':  'Sch M-1; L05 - Income on books not included on return',
  '486':  'Sch M-1; L05 - Tax-exempt interest',
  '487':  'Sch M-1; L05 - Cash surrender value increase',
  '489':  'Sch M-1; L06 - Deductions on return not charged to books',
};

// Software codes to clear (set to NULL) for Sch K pass-through codes
// because 1120S "K-xx" Lacerte / "34-xxx" GoSystem codes don't exist in 1120.
// UltraTax numeric code is kept as-is (it's the universal identifier).
// CCH 10xxx codes are 1120S-specific for Sch K items.
const CLEAR_NON_ULTRATAX_FOR = new Set([
  '150','151','153','154','155','156',
  '225','226','228','230','231','234','237','238','242','245','246','390',
  '490','491','492','493','494','495','496','497','498',
  '481','485',
]);

// ── Corrected software codes for 1120 Sch K → 1120 main-form equivalents ────
// Format: tax_code → { lacerte?, gosystem?, cch? }
// Sources: IRS Form 1120 instructions cross-referenced with known software patterns.
//   Lacerte 1120: line-number codes matching 1120 form lines
//   GoSystem RS 1120: 30-xxx/31-xxx income, 33-xxx Sch C, 41-xxx deductions
//   CCH ProSystem/Axcess 1120: 20xxx.0000 range (vs 1120S 10xxx.0000)
const SOFTWARE_CORRECTIONS = {
  '150': { lacerte: '5',     gosystem: '31-500', cch: '20218.0000', lacerte_desc: 'Interest income',               gosystem_desc: 'Interest Income',                     cch_desc: 'Interest income' },
  '151': { lacerte: '5.01',  gosystem: '31-510', cch: '20219.0000', lacerte_desc: 'U.S. government interest',      gosystem_desc: 'Interest on U.S. Obligations',        cch_desc: 'U.S. interest income' },
  '153': { lacerte: '10',    gosystem: '31-900', cch: '20281.0000', lacerte_desc: 'Other income',                  gosystem_desc: 'Other Income',                        cch_desc: 'Other income' },
  '154': { lacerte: '10',    gosystem: '31-900', cch: '20290.0000', lacerte_desc: 'Other income',                  gosystem_desc: 'Other Income',                        cch_desc: 'Other income' },
  '155': { lacerte: '10',    gosystem: '31-900', cch: '20290.0000', lacerte_desc: 'Other income',                  gosystem_desc: 'Other Income',                        cch_desc: 'Other income' },
  '156': { lacerte: 'C01',   gosystem: '33-100', cch: '20224.0000', lacerte_desc: 'Dividends',                     gosystem_desc: 'Schedule C: Dividends',               cch_desc: 'Dividends' },
  '225': { lacerte: '29',    gosystem: '41-440', cch: '20330.0000', lacerte_desc: 'Charitable contributions (60%)',gosystem_desc: 'Charitable Contributions (60%)',       cch_desc: 'Charitable contributions' },
  '226': { lacerte: '29',    gosystem: '41-450', cch: '20330.0000', lacerte_desc: 'Charitable contributions (30%)',gosystem_desc: 'Charitable Contributions (30%)',       cch_desc: 'Charitable contributions' },
  '228': { lacerte: '21',    gosystem: '41-380', cch: '20339.0000', lacerte_desc: 'Special deductions - Sec 179', gosystem_desc: 'Section 179 Expense Deduction',        cch_desc: 'Section 179 expense' },
  '230': { lacerte: '26',    gosystem: '41-900', cch: '20360.0000', lacerte_desc: 'Other deductions',              gosystem_desc: 'Other Deductions',                    cch_desc: 'Other deductions' },
  '231': { lacerte: '18',    gosystem: '41-500', cch: '20381.0000', lacerte_desc: 'Interest',                      gosystem_desc: 'Interest Expense',                    cch_desc: 'Interest expense' },
  '234': { lacerte: '26',    gosystem: '41-900', cch: '20382.0000', lacerte_desc: 'Other deductions',              gosystem_desc: 'Other Deductions',                    cch_desc: 'Other deductions' },
  '237': { lacerte: '26',    gosystem: '41-900', cch: '20360.0000', lacerte_desc: 'Other deductions',              gosystem_desc: 'Other Deductions',                    cch_desc: 'Other deductions' },
  '238': { lacerte: '26',    gosystem: '41-900', cch: '20360.0000', lacerte_desc: 'Other deductions',              gosystem_desc: 'Other Deductions',                    cch_desc: 'Other deductions' },
  '242': { lacerte: '10',    gosystem: '31-900', cch: '20290.0000', lacerte_desc: 'Other income',                  gosystem_desc: 'Other Income',                        cch_desc: 'Other income' },
  '245': { lacerte: '26',    gosystem: '41-900', cch: '20354.0000', lacerte_desc: 'Other deductions',              gosystem_desc: 'Other Deductions',                    cch_desc: 'Other portfolio deductions' },
  '246': { lacerte: '26',    gosystem: '41-900', cch: '20360.0000', lacerte_desc: 'Other deductions',              gosystem_desc: 'Other Deductions',                    cch_desc: 'Other deductions' },
  '390': { lacerte: '29',    gosystem: '41-460', cch: '20330.0000', lacerte_desc: 'Charitable contributions',      gosystem_desc: 'Charitable Contributions (noncash)',   cch_desc: 'Charitable contributions (noncash)' },

  // M-2 retained earnings
  '490': { lacerte: 'M203',  gosystem: '62-300', cch: '20750.0000', lacerte_desc: 'Other increases',               gosystem_desc: 'Other Increases',                     cch_desc: 'Other increases' },
  '491': { lacerte: 'M203',  gosystem: '62-300', cch: '20750.0000', lacerte_desc: 'Other increases',               gosystem_desc: 'Other Increases',                     cch_desc: 'Other increases' },
  '492': { lacerte: 'M205',  gosystem: '62-302', cch: '20760.0000', lacerte_desc: 'Distributions (cash)',           gosystem_desc: 'Distributions: Cash',                 cch_desc: 'Distributions (cash)' },
  '493': { lacerte: 'M205',  gosystem: '62-302', cch: '20762.0000', lacerte_desc: 'Distributions (property)',       gosystem_desc: 'Distributions: Property',             cch_desc: 'Distributions (property)' },
  '494': { lacerte: 'M207',  gosystem: '62-302', cch: '20755.0000', lacerte_desc: 'Other decreases',               gosystem_desc: 'Other Decreases',                     cch_desc: 'Other decreases' },
  '495': { lacerte: 'M207',  gosystem: '62-302', cch: '20755.0000', lacerte_desc: 'Other decreases',               gosystem_desc: 'Other Decreases',                     cch_desc: 'Other decreases' },
  '496': { lacerte: 'M207',  gosystem: '62-302', cch: '20755.0000', lacerte_desc: 'Other decreases',               gosystem_desc: 'Other Decreases',                     cch_desc: 'Other decreases' },
};

// ── CCH code prefix correction: 1120S uses 10xxx, 1120 uses 20xxx ─────────────
// For all non-Sch-K codes that have CCH codes starting with '10', remap to '20'.
// Balance sheet items (10100-10165) are shared and kept as-is.
// This covers main-form P&L items.
const CCH_SHARED_PREFIXES = new Set([
  '10100','10103','10106','10109','10112','10113','10115',
  '10118','10121','10124','10127','10130','10133','10136',
  '10139','10142','10145','10148','10150','10153','10156',
  '10159','10162','10165','10171','10174','10192','10193','10195',
]);

exports.up = async function(knex) {
  const ACTIVITY_TYPES = ['business', 'rental', 'farm', 'farm_rental', 'common'];

  // ── 1. Apply description corrections ────────────────────────────────────────
  for (const [taxCode, newDesc] of Object.entries(DESC_CORRECTIONS)) {
    await knex('tax_codes')
      .where({ return_form: '1120', tax_code: taxCode, is_system: true })
      .whereIn('activity_type', ACTIVITY_TYPES)
      .update({ description: newDesc });
  }

  // ── 2. Apply software code corrections for Sch-K-equivalent items ───────────
  for (const [taxCode, sw] of Object.entries(SOFTWARE_CORRECTIONS)) {
    // Fetch all 1120 rows for this tax_code
    const rows = await knex('tax_codes')
      .where({ return_form: '1120', tax_code: taxCode, is_system: true })
      .whereIn('activity_type', ACTIVITY_TYPES)
      .select('id');

    for (const row of rows) {
      const id = row.id;

      // Delete the old non-ultratax maps for this code
      await knex('tax_code_software_maps')
        .where({ tax_code_id: id })
        .whereIn('tax_software', ['lacerte', 'gosystem', 'cch'])
        .delete();

      // Insert corrected maps
      const toInsert = [];
      if (sw.lacerte)  toInsert.push({ tax_code_id: id, tax_software: 'lacerte',  software_code: sw.lacerte,  software_description: sw.lacerte_desc  ?? null, is_active: true });
      if (sw.gosystem) toInsert.push({ tax_code_id: id, tax_software: 'gosystem', software_code: sw.gosystem, software_description: sw.gosystem_desc ?? null, is_active: true });
      if (sw.cch)      toInsert.push({ tax_code_id: id, tax_software: 'cch',      software_code: sw.cch,      software_description: sw.cch_desc      ?? null, is_active: true });

      if (toInsert.length > 0) {
        await knex('tax_code_software_maps').insert(toInsert);
      }
    }
  }

  // ── 3. For remaining Sch-K-only items with no known 1120 equivalent:
  //       clear Lacerte/GoSystem/CCH maps (keep UltraTax numeric code) ─────────
  for (const taxCode of CLEAR_NON_ULTRATAX_FOR) {
    if (SOFTWARE_CORRECTIONS[taxCode]) continue; // already handled above

    const rows = await knex('tax_codes')
      .where({ return_form: '1120', tax_code: taxCode, is_system: true })
      .whereIn('activity_type', ACTIVITY_TYPES)
      .select('id');

    const ids = rows.map(r => r.id);
    if (ids.length > 0) {
      await knex('tax_code_software_maps')
        .whereIn('tax_code_id', ids)
        .whereIn('tax_software', ['lacerte', 'gosystem', 'cch'])
        .delete();
    }
  }

  // ── 4. CCH prefix remap: 10xxx → 20xxx for non-balance-sheet P&L items ──────
  // Fetch all 1120 code IDs
  const all1120 = await knex('tax_codes')
    .where({ return_form: '1120', is_system: true })
    .whereIn('activity_type', ACTIVITY_TYPES)
    .select('id');
  const all1120Ids = all1120.map(r => r.id);

  // Fetch their CCH maps
  const cchMaps = await knex('tax_code_software_maps')
    .whereIn('tax_code_id', all1120Ids)
    .where({ tax_software: 'cch', is_active: true })
    .select('id', 'software_code');

  for (const m of cchMaps) {
    const code = m.software_code ?? '';
    const prefix = code.split('.')[0]; // e.g. "10200" from "10200.0000"

    // Skip balance-sheet codes that are shared between 1120S and 1120
    if (CCH_SHARED_PREFIXES.has(prefix)) continue;

    // Remap 10xxx → 20xxx
    if (prefix.startsWith('10')) {
      const newCode = '2' + code.slice(1); // "10200.0000" → "20200.0000"
      await knex('tax_code_software_maps').where({ id: m.id }).update({ software_code: newCode });
    }
  }

  console.log('Form 1120: description corrections and software mappings applied.');
};

exports.down = async function(knex) {
  // Re-running migration 20260321000009 (copy from 1120S) would restore originals.
  // No automated rollback implemented.
};
