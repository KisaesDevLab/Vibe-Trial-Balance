// Copyright 2025-2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Use is limited to qualifying small businesses. See LICENSE for terms.

/**
 * Import aliases: the alternative names a file has used for an account.
 *
 * An alias is a CLAIM — "this text means this account" — and it can only be
 * true of one account at a time. Before this module every import path kept its
 * own copy of the logic (five separate `parseAliases`, two different ideas
 * about case) and all of them only ever APPENDED, so:
 *
 *   - the same text could sit on two accounts, and the matcher, scanning in
 *     account-number order, silently gave the row to the lowest number;
 *   - re-pointing a row in the import preview wrote the alias onto the account
 *     the user corrected TO, while the account they corrected away from kept
 *     it, so the next import repeated the mistake the user had just fixed;
 *   - the CSV and PDF paths de-duplicated case-sensitively while matching is
 *     case-insensitive, so "Cash" and "cash" both got stored and neither could
 *     ever be told from the other at match time.
 *
 * So a claim MOVES: `planAliasClaims` grants the alias to its new owner and
 * strips it from whoever held it. The precedent is `qbo_account_id` in
 * qboImport.ts, which clears the id off any other account when it assigns it —
 * same kind of claim, same rule.
 *
 * The decision is a pure function over rows so it can be tested without a
 * database; `applyAliasClaims` is the thin part that reads and writes.
 */

import type { Knex } from 'knex';

/** The jsonb column is `string[]`, but tolerate a JSON string and junk. */
export function parseAliases(val: unknown): string[] {
  if (Array.isArray(val)) return val.filter((v): v is string => typeof v === 'string');
  if (typeof val === 'string') {
    try {
      const parsed = JSON.parse(val);
      return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === 'string') : [];
    } catch {
      return [];
    }
  }
  return [];
}

/**
 * The form two alias strings are compared in. Matching has always been
 * case-insensitive, so storage has to de-duplicate the same way or it keeps
 * pairs that can never be distinguished when it matters.
 */
export function normalizeAlias(raw: string): string {
  return raw.trim().toLowerCase();
}

export interface AliasAccountRow {
  id: number;
  account_name: string;
  import_aliases: unknown;
}

export interface AliasClaim {
  accountId: number;
  /** The name as it appeared in the imported file. */
  name: string;
}

/** An account whose alias list must be rewritten, and what it becomes. */
export interface AliasUpdate {
  accountId: number;
  aliases: string[];
}

/**
 * Work out the alias lists after granting each claim to its account.
 *
 * Rules, in order:
 *  - a blank name, or one that equals the account's own name, is not an alias;
 *  - the claim is added to its account if not already there (case-insensitive);
 *  - the same text is removed from every OTHER account in `rows`, so one text
 *    means one account;
 *  - accounts whose list does not change are not returned, so a re-import that
 *    teaches nothing new writes nothing.
 *
 * `rows` must cover every account that could hold the text — i.e. the client's
 * whole chart of accounts — or a stale duplicate elsewhere survives.
 */
export function planAliasClaims(rows: AliasAccountRow[], claims: AliasClaim[]): AliasUpdate[] {
  const before = new Map<number, string[]>();
  const working = new Map<number, string[]>();
  const nameOf = new Map<number, string>();
  for (const r of rows) {
    const list = parseAliases(r.import_aliases);
    before.set(r.id, list);
    working.set(r.id, [...list]);
    nameOf.set(r.id, r.account_name);
  }

  for (const claim of claims) {
    const name = claim.name.trim();
    if (name === '') continue;
    if (!working.has(claim.accountId)) continue; // not part of this client's rows
    const key = normalizeAlias(name);
    if (key === normalizeAlias(nameOf.get(claim.accountId) ?? '')) continue;

    // Grant.
    const mine = working.get(claim.accountId)!;
    if (!mine.some((a) => normalizeAlias(a) === key)) mine.push(name);

    // Revoke everywhere else — including duplicates already sitting on the
    // winning account under a different case.
    for (const [id, list] of working) {
      if (id === claim.accountId) continue;
      const kept = list.filter((a) => normalizeAlias(a) !== key);
      if (kept.length !== list.length) working.set(id, kept);
    }
  }

  const updates: AliasUpdate[] = [];
  for (const [id, list] of working) {
    const original = before.get(id) ?? [];
    if (list.length !== original.length || list.some((a, i) => a !== original[i])) {
      updates.push({ accountId: id, aliases: list });
    }
  }
  return updates;
}

/**
 * Apply alias claims for one client, moving each alias to its new owner.
 *
 * Reads the client's whole chart of accounts, because revoking a claim means
 * touching accounts the caller never mentioned. Inactive accounts are included:
 * they are skipped by the matchers but come back on reactivation, and a stale
 * alias that reappears then is exactly the bug this prevents.
 */
export async function applyAliasClaims(
  trx: Knex.Transaction,
  clientId: number,
  claims: AliasClaim[],
): Promise<number> {
  if (claims.length === 0) return 0;
  const rows = (await trx('chart_of_accounts')
    .where({ client_id: clientId })
    .select('id', 'account_name', 'import_aliases')) as AliasAccountRow[];

  const updates = planAliasClaims(rows, claims);
  for (const u of updates) {
    await trx('chart_of_accounts')
      .where({ id: u.accountId })
      .update({ import_aliases: JSON.stringify(u.aliases), updated_at: trx.fn.now() });
  }
  return updates.length;
}
