/**
 * Migration: Seed system_tickmarks with standard firm-wide defaults.
 *
 * These can be applied to any client's tickmark library from the Tickmarks page
 * (Admin > Default Tickmarks, or "Load Defaults" button on the per-client page).
 */
const DEFAULTS = [
  { symbol: '✓',  description: 'Verified and agreed',                    color: 'gray',   sort_order: 1 },
  { symbol: 'A',  description: 'Agreed to bank statement',               color: 'green',  sort_order: 2 },
  { symbol: 'B',  description: 'Agreed to prior year tax return',        color: 'blue',   sort_order: 3 },
  { symbol: 'C',  description: 'Agreed to client-provided schedule',     color: 'blue',   sort_order: 4 },
  { symbol: 'D',  description: 'Agreed to depreciation schedule',        color: 'blue',   sort_order: 5 },
  { symbol: 'F',  description: 'Footed / cross-footed',                  color: 'gray',   sort_order: 6 },
  { symbol: 'G',  description: 'Agreed to general ledger',               color: 'green',  sort_order: 7 },
  { symbol: 'P',  description: 'Agreed to prior year workpapers',        color: 'purple', sort_order: 8 },
  { symbol: 'R',  description: 'Reviewed by preparer',                   color: 'purple', sort_order: 9 },
  { symbol: 'T',  description: 'Traced to supporting schedule',          color: 'purple', sort_order: 10 },
  { symbol: 'N',  description: 'See preparer note',                      color: 'amber',  sort_order: 11 },
  { symbol: '†',  description: 'See footnote / explanation required',    color: 'red',    sort_order: 12 },
];

exports.up = async function (knex) {
  // Skip any symbols already present (idempotent)
  const existing = await knex('system_tickmarks').select('symbol');
  const existingSet = new Set(existing.map((r) => r.symbol));
  const toInsert = DEFAULTS.filter((d) => !existingSet.has(d.symbol));
  if (toInsert.length > 0) {
    await knex('system_tickmarks').insert(toInsert);
  }
};

exports.down = async function (knex) {
  const symbols = DEFAULTS.map((d) => d.symbol);
  await knex('system_tickmarks').whereIn('symbol', symbols).delete();
};
