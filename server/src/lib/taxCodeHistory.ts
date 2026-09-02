// Copyright 2025-2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Use is limited to qualifying small businesses. See LICENSE for terms.

/**
 * Firm-history tax code matching — the deterministic stage of the auto-assign
 * waterfall that sits between the exact cross-client match and the AI call.
 *
 * The firm's confirmed mappings (every COA row anywhere with a tax code, same
 * entity type) are bucketed by a NORMALIZED account name, so "Advertising",
 * "Advertising Expense" and "6100 · Advertising Exp." all land in one bucket,
 * and a new account is matched against those buckets by token-set similarity.
 * It never calls the AI and never leaves the firm's own data. Pure — no DB;
 * the route loads the rows and hands them in.
 */

/** Words that distinguish nothing between two account names. */
const FILLER = new Set([
  'expense', 'exp', 'expenses', 'account', 'acct', 'accounts', 'other', 'misc',
  'miscellaneous', 'general', 'and', 'or', 'of', 'the', 'a', 'an', 'for', 'to',
]);

function singular(word: string): string {
  if (word.length <= 3) return word;
  if (word.endsWith('ies')) return word.slice(0, -3) + 'y';
  if (/(ss|us|is)$/.test(word)) return word;
  if (word.endsWith('ses')) return word.slice(0, -1); // expenses, licenses, purchases
  if (/(xes|ches|shes)$/.test(word)) return word.slice(0, -2);
  if (word.endsWith('s')) return word.slice(0, -1);
  return word;
}

/**
 * The tokens an account name is compared on: lower-cased, a leading account
 * number dropped (`6100 · Advertising`, `6100-Advertising`, `6100 Advertising`),
 * punctuation gone, filler words removed, plurals collapsed, de-duplicated.
 */
export function historyTokens(name: string): string[] {
  let text = name.toLowerCase().trim();
  // A leading number (with dots/dashes) and whatever separator follows it.
  text = text.replace(/^\d[\d.\-/]*(?=\s|[·:\-–—]|$)\s*[·:\-–—.]?\s*/, '');
  const out = new Set<string>();
  for (const raw of text.split(/[^a-z0-9]+/)) {
    if (!raw) continue;
    const w = singular(raw);
    if (FILLER.has(raw) || FILLER.has(w)) continue;
    out.add(w);
  }
  return [...out];
}

/** The bucket key: `historyTokens` joined, or '' when nothing survives. */
export function normalizeAccountName(name: string): string {
  return historyTokens(name).join(' ');
}

/** Sørensen–Dice over two token sets. */
export function tokenSetSimilarity(a: readonly string[], b: readonly string[]): number {
  if (a.length === 0 || b.length === 0) return 0;
  const bs = new Set(b);
  let shared = 0;
  for (const t of new Set(a)) if (bs.has(t)) shared++;
  return (2 * shared) / (new Set(a).size + bs.size);
}

/** One grouped row from the firm: an account name → tax code, with its footprint. */
export interface HistoryRow {
  account_name: string;
  tax_code_id: number;
  /** Number of COA rows carrying this name → code. */
  count: number;
  /** The clients those rows belong to. */
  client_ids: readonly number[];
}

interface CodeStat {
  count: number;
  clients: Set<number>;
}

/** Normalized name → tax_code_id → footprint. */
export type HistoryBuckets = Map<string, Map<number, CodeStat>>;

/** Group raw rows by normalized name (several raw names fold into one bucket). */
export function buildHistoryBuckets(rows: readonly HistoryRow[]): HistoryBuckets {
  const buckets: HistoryBuckets = new Map();
  for (const row of rows) {
    const key = normalizeAccountName(row.account_name);
    if (!key) continue;
    let byCode = buckets.get(key);
    if (!byCode) { byCode = new Map(); buckets.set(key, byCode); }
    let stat = byCode.get(row.tax_code_id);
    if (!stat) { stat = { count: 0, clients: new Set() }; byCode.set(row.tax_code_id, stat); }
    stat.count += row.count;
    for (const c of row.client_ids) stat.clients.add(c);
  }
  return buckets;
}

export interface HistoryMatch {
  taxCodeId: number;
  /** Similarity of the best-matching bucket that voted for this code. */
  similarity: number;
  /** COA rows behind the vote. */
  count: number;
  /** Distinct clients behind the vote. */
  clientCount: number;
  /** similarity × n/(n+1) over distinct clients, so one client's habit never reads as certainty. */
  confidence: number;
  /** The normalized bucket name that matched best. */
  matchedName: string;
}

export interface RankOptions {
  /** Buckets below this Dice similarity do not vote. */
  minSimilarity?: number;
  /** Only these codes may be suggested (the client's catalog); others are ignored. */
  allowedTaxCodeIds?: ReadonlySet<number>;
}

/**
 * The best firm-history match for one account name, or null. Every bucket at
 * or above `minSimilarity` votes for each of its codes with weight
 * similarity × row count; the code with the most weight wins.
 */
export function rankHistoryMatches(
  accountName: string,
  buckets: HistoryBuckets,
  opts: RankOptions = {},
): HistoryMatch | null {
  const minSimilarity = opts.minSimilarity ?? 0.8;
  const tokens = historyTokens(accountName);
  if (tokens.length === 0) return null;

  interface Vote { weight: number; count: number; clients: Set<number>; bestSim: number; bestName: string }
  const votes = new Map<number, Vote>();
  for (const [name, byCode] of buckets) {
    const sim = tokenSetSimilarity(tokens, name.split(' '));
    if (sim < minSimilarity) continue;
    for (const [codeId, stat] of byCode) {
      if (opts.allowedTaxCodeIds && !opts.allowedTaxCodeIds.has(codeId)) continue;
      let v = votes.get(codeId);
      if (!v) { v = { weight: 0, count: 0, clients: new Set(), bestSim: 0, bestName: name }; votes.set(codeId, v); }
      v.weight += sim * stat.count;
      v.count += stat.count;
      for (const c of stat.clients) v.clients.add(c);
      if (sim > v.bestSim) { v.bestSim = sim; v.bestName = name; }
    }
  }
  if (votes.size === 0) return null;

  let taxCodeId = -1;
  let v: Vote | null = null;
  for (const [codeId, vote] of votes) {
    if (!v || vote.weight > v.weight) { v = vote; taxCodeId = codeId; }
  }
  if (!v) return null;
  const n = v.clients.size;
  return {
    taxCodeId,
    similarity: v.bestSim,
    count: v.count,
    clientCount: n,
    confidence: Math.round(v.bestSim * (n / (n + 1)) * 100) / 100,
    matchedName: v.bestName,
  };
}
