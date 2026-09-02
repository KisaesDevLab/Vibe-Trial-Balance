// Copyright 2025-2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Use is limited to qualifying small businesses. See LICENSE for terms.

/**
 * Lexical shortlist of tax codes for one account — the `likely` hints handed
 * to the AI auto-assign step, and the per-batch catalog trim when a client's
 * catalog is larger than we want in one prompt.
 *
 * This is deliberately a HINT, never a decision: every score here comes from
 * token overlap between the account name and the tax line's label, plus a
 * bias for the statement the account's category lives on (Sch L for balance
 * sheet accounts, page 1 / Sch K / Sch F for income and expense). The model
 * still sees the whole catalog and may pick anything in it. Pure — no DB.
 */

export interface ShortlistCode {
  id: number;
  tax_code: string;
  description: string;
}

export interface ShortlistAccount {
  account_name: string;
  category: string;
}

/** Which statement a tax line's description says it sits on. */
export type CodeStatement = 'bs' | 'pnl' | 'm' | 'other';

/** Label wording the crosswalk abbreviates, folded to the word an account name uses. */
const SYNONYMS: Record<string, string> = {
  salary: 'wage', salaries: 'wage', wages: 'wage', payroll: 'wage', compensation: 'wage',
  auto: 'vehicle', automobile: 'vehicle', truck: 'vehicle', car: 'vehicle', vehicles: 'vehicle',
  depr: 'depreciation', deprec: 'depreciation', accum: 'accumulated', amort: 'amortization',
  mortg: 'loan', mtg: 'loan', mort: 'loan', mortgage: 'loan',
  pay: 'payable', ap: 'payable', ar: 'receivable', rec: 'receivable',
  inc: 'income', revenue: 'income', sales: 'sale', receipts: 'sale',
  ins: 'insurance', shs: 'shareholder', stockholder: 'shareholder', shareholders: 'shareholder',
  donation: 'contribution', charitable: 'contribution',
  maintenance: 'repair', rental: 'rent', lease: 'rent', license: 'tax', licenses: 'tax',
  checking: 'cash', savings: 'cash',
  note: 'loan', notes: 'loan', bond: 'loan', bonds: 'loan',
  draw: 'distribution', draws: 'distribution',
  marketing: 'advertising', promotion: 'advertising',
  equipment: 'fixedasset', furniture: 'fixedasset', machinery: 'fixedasset', fixture: 'fixedasset',
  building: 'fixedasset', buildings: 'fixedasset', improvement: 'fixedasset',
  earning: 'retained', earnings: 'retained',
};

/** Words that carry no signal in either an account name or a line label. */
const STOPWORDS = new Set([
  'and', 'or', 'of', 'the', 'a', 'an', 'to', 'for', 'on', 'in', 'not', 'any', 'etc', 'var',
  'other', 'less', 'net', 'book', 'total', 'page', 'sch', 'schedule', 'account', 'acct', 'accounts',
  'general', 'misc', 'miscellaneous', 'than', 'per', 'yr', 'year',
  // Every expense line is an "expense" or a "deduction"; the words rank nothing.
  'expense', 'exp', 'exps', 'deduction', 'ded',
]);

function stem(word: string): string {
  if (word.length <= 3) return word;
  if (word.endsWith('ies')) return word.slice(0, -3) + 'y';
  if (/(ss|us|is)$/.test(word)) return word;
  if (word.endsWith('ses')) return word.slice(0, -1); // expenses, licenses, purchases
  if (/(xes|ches|shes)$/.test(word)) return word.slice(0, -2);
  if (word.endsWith('s')) return word.slice(0, -1);
  return word;
}

/**
 * Lower-case, split on anything that is not a letter or digit, drop line
 * references (`L01a`, `1120S`, `1125-A`) and stopwords, fold synonyms, stem.
 */
export function tokenizeForMatch(text: string): string[] {
  const out = new Set<string>();
  for (const raw of text.toLowerCase().split(/[^a-z0-9]+/)) {
    if (raw.length < 2) continue;
    if (/^l\d/.test(raw) || /^\d/.test(raw)) continue;
    const syn = SYNONYMS[raw] ?? raw;
    const s = SYNONYMS[stem(syn)] ?? stem(syn);
    if (STOPWORDS.has(s) || STOPWORDS.has(raw)) continue;
    out.add(s);
  }
  return [...out];
}

/** Sørensen–Dice over two token sets. */
export function diceSimilarity(a: readonly string[], b: readonly string[]): number {
  if (a.length === 0 || b.length === 0) return 0;
  const bs = new Set(b);
  let shared = 0;
  for (const t of new Set(a)) if (bs.has(t)) shared++;
  return (2 * shared) / (new Set(a).size + bs.size);
}

/** Read the statement off the crosswalk's `<form>; <line> - <label>` prefix. */
export function codeStatement(description: string): CodeStatement {
  const prefix = description.split(';')[0].trim().toLowerCase();
  if (prefix.startsWith('sch l')) return 'bs';
  if (/^sch m|^r\/e wrk/.test(prefix)) return 'm';
  if (/reporting only|informational only/.test(description.toLowerCase())) return 'other';
  return 'pnl';
}

/** The part of the description that names the line (after the last ` - `). */
export function codeLabel(description: string): string {
  const idx = description.indexOf(' - ');
  return idx >= 0 ? description.slice(idx + 3) : description;
}

/** How well a code's statement suits an account's category: a weight, not a filter. */
export function statementWeight(category: string, statement: CodeStatement): number {
  switch (category) {
    case 'assets':
    case 'liabilities':
      return statement === 'bs' ? 1 : statement === 'm' ? 0.5 : 0.3;
    case 'equity':
      return statement === 'bs' || statement === 'm' ? 1 : 0.3;
    case 'revenue':
    case 'expenses':
      return statement === 'pnl' ? 1 : statement === 'm' ? 0.7 : 0.3;
    default:
      return 0.7;
  }
}

export function scoreCodeForAccount(account: ShortlistAccount, code: ShortlistCode): number {
  const sim = diceSimilarity(tokenizeForMatch(account.account_name), tokenizeForMatch(codeLabel(code.description)));
  if (sim === 0) return 0;
  return sim * statementWeight(account.category, codeStatement(code.description));
}

/** The `limit` best lexical matches for one account, best first; only codes with some overlap. */
export function shortlistCodes(account: ShortlistAccount, codes: readonly ShortlistCode[], limit = 5): ShortlistCode[] {
  const scored: Array<{ code: ShortlistCode; score: number }> = [];
  for (const code of codes) {
    const score = scoreCodeForAccount(account, code);
    if (score > 0) scored.push({ code, score });
  }
  scored.sort((a, b) => b.score - a.score || a.code.tax_code.localeCompare(b.code.tax_code));
  return scored.slice(0, limit).map((s) => s.code);
}

/**
 * The catalog one AI batch is shown. A client's whole catalog when it fits
 * under `cap` (the seeded sets are ~100–135 codes, so this is the normal
 * case); otherwise every account's shortlist plus the head of the catalog in
 * its own order, up to `cap`. Order is preserved so the prompt reads like the
 * crosswalk. Never silently drops a code an account's hint points at.
 */
export function selectCatalogForBatch<T extends ShortlistCode>(
  accounts: readonly ShortlistAccount[],
  codes: readonly T[],
  cap: number,
  perAccount = 8,
): T[] {
  if (codes.length <= cap) return [...codes];
  const keep = new Set<number>();
  for (const account of accounts) {
    for (const c of shortlistCodes(account, codes, perAccount)) keep.add(c.id);
  }
  for (const c of codes) {
    if (keep.size >= cap) break;
    keep.add(c.id);
  }
  return codes.filter((c) => keep.has(c.id));
}
