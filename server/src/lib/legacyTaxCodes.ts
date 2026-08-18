// Copyright 2025-2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Use is limited to qualifying small businesses. See LICENSE for terms.

/**
 * Legacy alpha system tax codes (GROSS_RECEIPTS, S_BAD_DEBTS, REPORTING_ONLY, …).
 *
 * System tax codes are numeric only (UltraTax-style crosswalk). The old alpha
 * canonical set was re-inserted by seed files that have since been deleted,
 * leaving a duplicate row for every tax line on installs that ran them.
 * Migration 20260817000002 removes them automatically on deploy; this module
 * exposes the same cleanup on demand (Settings → admin "Remove legacy tax
 * codes" button) so an install can be cleaned without waiting for a release.
 *
 * KEEP IN SYNC with server/migrations/20260817000002_remove_legacy_alpha_tax_codes.js
 * — the migration is plain JS and cannot import this file.
 */

import type { Knex } from 'knex';

const CONTROL_CODES = new Set(['REPORTING_ONLY', 'DONOTMAP', 'MEMO', 'INTERCOMPANY', 'SUSPENSE', 'PRIOR_YEAR_ADJUSTMENT']);
const REPORTING_ONLY_CODE = '88888';
const ENTITY_TO_FORM: Record<string, string> = { '1040_C': '1040', '1065': '1065', '1120': '1120', '1120S': '1120S' };
const NUMERIC_RE = /^[0-9]+$/;

interface TaxCodeRow {
  id: number;
  return_form: string;
  activity_type: string;
  tax_code: string;
  description: string;
}

export interface LegacyTaxCodePreview {
  /** Legacy alpha system codes present. 0 means there is nothing to remove. */
  legacyCodes: number;
  /** Software-map rows that go with them (cascade). */
  softwareMaps: number;
  /** Chart-of-accounts rows currently pointing at a legacy code. */
  accountsReferencing: number;
  templateRowsReferencing: number;
  consolidationRowsReferencing: number;
  /** A few example codes for the confirmation UI. */
  sample: Array<{ returnForm: string; activityType: string; taxCode: string; description: string }>;
}

export interface LegacyTaxCodePurgeResult {
  deletedCodes: number;
  accountsRemapped: number;
  accountsCleared: number;
  templateRowsRemapped: number;
  templateRowsCleared: number;
  consolidationRowsRemapped: number;
  consolidationRowsDeleted: number;
}

function normalize(desc: string | null | undefined): string {
  // Crosswalk descriptions carry a "1065; L01a - " prefix; legacy ones don't.
  return String(desc ?? '')
    .replace(/^[^-]*-\s*/, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

async function loadLegacy(q: Knex | Knex.Transaction): Promise<TaxCodeRow[]> {
  return q('tax_codes')
    .where('is_system', true)
    .whereRaw("tax_code !~ '^[0-9]+$'")
    .select('id', 'return_form', 'activity_type', 'tax_code', 'description')
    .orderBy(['return_form', 'activity_type', 'sort_order']);
}

export async function previewLegacyTaxCodes(q: Knex | Knex.Transaction): Promise<LegacyTaxCodePreview> {
  const legacy = await loadLegacy(q);
  const ids = legacy.map((r) => r.id);
  const empty: LegacyTaxCodePreview = {
    legacyCodes: 0, softwareMaps: 0, accountsReferencing: 0,
    templateRowsReferencing: 0, consolidationRowsReferencing: 0, sample: [],
  };
  if (ids.length === 0) return empty;

  const count = async (table: string, col = 'tax_code_id'): Promise<number> => {
    if (!(await q.schema.hasTable(table))) return 0;
    const row = await q(table).whereIn(col, ids).count<{ n: string }[]>({ n: '*' }).first();
    return Number(row?.n ?? 0);
  };

  return {
    legacyCodes: ids.length,
    softwareMaps: await count('tax_code_software_maps'),
    accountsReferencing: await count('chart_of_accounts'),
    templateRowsReferencing: await count('coa_template_tax_codes'),
    consolidationRowsReferencing: await count('export_consolidation_settings'),
    sample: legacy.slice(0, 5).map((r) => ({
      returnForm: r.return_form, activityType: r.activity_type, taxCode: r.tax_code, description: r.description,
    })),
  };
}

/**
 * Delete every legacy alpha system code, preserving references where the
 * numeric target is unambiguous (see the migration header for the rules).
 * Must be called inside a transaction.
 */
export async function purgeLegacyTaxCodes(trx: Knex.Transaction): Promise<LegacyTaxCodePurgeResult> {
  const result: LegacyTaxCodePurgeResult = {
    deletedCodes: 0, accountsRemapped: 0, accountsCleared: 0,
    templateRowsRemapped: 0, templateRowsCleared: 0,
    consolidationRowsRemapped: 0, consolidationRowsDeleted: 0,
  };

  const legacy = await loadLegacy(trx);
  if (legacy.length === 0) return result;
  const legacyIds = legacy.map((r) => r.id);
  const legacyById = new Map(legacy.map((r) => [r.id, r]));

  const numeric: TaxCodeRow[] = await trx('tax_codes')
    .whereRaw("tax_code ~ '^[0-9]+$'")
    .select('id', 'return_form', 'activity_type', 'tax_code', 'description');
  const numericById = new Map(numeric.map((n) => [n.id, n]));

  const byDesc = new Map<string, number[]>();
  const reportingOnlyByScope = new Map<string, number>();
  for (const n of numeric) {
    const scope = `${n.return_form}|${n.activity_type}`;
    const key = `${scope}|${normalize(n.description)}`;
    const list = byDesc.get(key) ?? [];
    list.push(n.id);
    byDesc.set(key, list);
    if (n.tax_code === REPORTING_ONLY_CODE) reportingOnlyByScope.set(scope, n.id);
  }

  const remap = new Map<number, number>();
  for (const l of legacy) {
    if (CONTROL_CODES.has(l.tax_code)) continue;
    const cands = byDesc.get(`${l.return_form}|${l.activity_type}|${normalize(l.description)}`) ?? [];
    if (cands.length === 1) remap.set(l.id, cands[0]);
  }

  const resolve = (legacyId: number, returnForm: string, activityType: string): number | null => {
    const l = legacyById.get(legacyId);
    if (!l) return null;
    if (CONTROL_CODES.has(l.tax_code)) return reportingOnlyByScope.get(`${returnForm}|${activityType}`) ?? null;
    return remap.get(legacyId) ?? null;
  };

  // chart_of_accounts
  const accounts: Array<{ id: number; tax_code_id: number; entity_type: string; activity_type: string | null }> =
    await trx('chart_of_accounts as a')
      .join('clients as c', 'c.id', 'a.client_id')
      .whereIn('a.tax_code_id', legacyIds)
      .select('a.id', 'a.tax_code_id', 'c.entity_type', 'c.activity_type');
  for (const a of accounts) {
    const form = ENTITY_TO_FORM[a.entity_type] ?? 'common';
    const newId = resolve(a.tax_code_id, form, a.activity_type ?? 'business');
    if (newId) {
      await trx('chart_of_accounts').where('id', a.id).update({
        tax_code_id: newId,
        tax_line: numericById.get(newId)?.tax_code ?? null,
        updated_at: trx.fn.now(),
      });
      result.accountsRemapped++;
    } else {
      await trx('chart_of_accounts').where('id', a.id).update({
        tax_code_id: null,
        tax_line: null,
        updated_at: trx.fn.now(),
      });
      result.accountsCleared++;
    }
  }

  // coa_template_tax_codes (nullable FK, NO ACTION)
  if (await trx.schema.hasTable('coa_template_tax_codes')) {
    const rows: Array<{ id: number; tax_code_id: number; return_form: string; activity_type: string }> =
      await trx('coa_template_tax_codes')
        .whereIn('tax_code_id', legacyIds)
        .select('id', 'tax_code_id', 'return_form', 'activity_type');
    for (const t of rows) {
      const newId = resolve(t.tax_code_id, t.return_form, t.activity_type);
      await trx('coa_template_tax_codes').where('id', t.id).update({ tax_code_id: newId });
      if (newId) result.templateRowsRemapped++; else result.templateRowsCleared++;
    }
  }

  // export_consolidation_settings (NOT NULL FK, NO ACTION)
  if (await trx.schema.hasTable('export_consolidation_settings')) {
    const rows: Array<{ id: number; client_id: number; tax_code_id: number; tax_software: string; entity_type: string; activity_type: string | null }> =
      await trx('export_consolidation_settings as e')
        .join('clients as c', 'c.id', 'e.client_id')
        .whereIn('e.tax_code_id', legacyIds)
        .select('e.id', 'e.client_id', 'e.tax_code_id', 'e.tax_software', 'c.entity_type', 'c.activity_type');
    for (const e of rows) {
      const form = ENTITY_TO_FORM[e.entity_type] ?? 'common';
      const newId = resolve(e.tax_code_id, form, e.activity_type ?? 'business');
      const clash = newId
        ? await trx('export_consolidation_settings')
            .where({ client_id: e.client_id, tax_code_id: newId, tax_software: e.tax_software })
            .first('id')
        : null;
      if (newId && !clash) {
        await trx('export_consolidation_settings').where('id', e.id).update({ tax_code_id: newId });
        result.consolidationRowsRemapped++;
      } else {
        await trx('export_consolidation_settings').where('id', e.id).delete();
        result.consolidationRowsDeleted++;
      }
    }
  }

  // Delete the codes themselves (software maps cascade).
  result.deletedCodes = await trx('tax_codes').whereIn('id', legacyIds).delete();
  return result;
}

export const isNumericTaxCode = (code: string): boolean => NUMERIC_RE.test(code);
