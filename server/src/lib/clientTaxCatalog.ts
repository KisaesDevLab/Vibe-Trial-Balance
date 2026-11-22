// Copyright 2025-2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Use is limited to qualifying small businesses. See LICENSE for terms.
/**
 * A client's tax code catalog: the active codes of its own return form and
 * activity, plus the `common`/`common` ones. `tax_codes` is unique per
 * (return_form, activity_type, tax_code), so the same text (`88888`, a line
 * number) is a different code on another return; anything that resolves a
 * code by its text, or carries one between clients, resolves it here
 * (Q134: the COA import looked it up among every return's codes, and copying
 * from another client kept that client's code whatever its return).
 */
import type { Knex } from 'knex';

/** Return form by `clients.entity_type`. */
export const ENTITY_TO_RETURN_FORM: Record<string, string> = {
  '1040_C': '1040',
  '1065': '1065',
  '1120': '1120',
  '1120S': '1120S',
};

export interface CatalogCode {
  id: number;
  tax_code: string;
  description: string | null;
  return_form: string;
  activity_type: string;
  sort_order: number | null;
}

/** The client's return form and activity, as auto-assign resolves them. */
export function clientTaxScope(client: { entity_type?: string | null; activity_type?: string | null }): { returnForm: string; activityType: string } {
  return {
    returnForm: ENTITY_TO_RETURN_FORM[client.entity_type ?? '1065'] ?? 'common',
    activityType: client.activity_type ?? 'business',
  };
}

/** The catalog of a client (empty for an unknown client). */
export async function clientTaxCatalog(q: Knex | Knex.Transaction, clientId: number): Promise<CatalogCode[]> {
  const client = await q('clients').where({ id: clientId }).first('entity_type', 'activity_type');
  if (!client) return [];
  return catalogFor(q, clientTaxScope(client));
}

export async function catalogFor(q: Knex | Knex.Transaction, scope: { returnForm: string; activityType: string }): Promise<CatalogCode[]> {
  return (await q('tax_codes')
    .where('is_active', true)
    .where(function () {
      this.where(function () {
        this.where('return_form', scope.returnForm).where('activity_type', scope.activityType);
      }).orWhere(function () {
        this.where('return_form', 'common').where('activity_type', 'common');
      });
    })
    .orderBy([{ column: 'sort_order', order: 'asc' }, { column: 'tax_code', order: 'asc' }])
    .select('id', 'tax_code', 'description', 'return_form', 'activity_type', 'sort_order')) as CatalogCode[];
}

/**
 * Code text → id within a catalog. Where the client's own return and the
 * common set both have a text, the client's own wins.
 */
export function codeLookup(catalog: CatalogCode[]): Map<string, number> {
  const out = new Map<string, number>();
  for (const c of catalog) if (c.return_form === 'common') out.set(c.tax_code, c.id);
  for (const c of catalog) if (c.return_form !== 'common') out.set(c.tax_code, c.id);
  return out;
}
