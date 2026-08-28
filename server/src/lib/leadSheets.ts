// Copyright 2025-2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Use is limited to qualifying small businesses. See LICENSE for terms.

/**
 * Lead sheets — the letter-coded groupings (A = Cash, B = Receivables, …) a
 * preparer works a file by, plus the rules that suggest one for an account.
 *
 * Pure: no `db` import, so the unit test needs no database.
 *
 * Ported from Vibe MyBooks' DEFAULT_LEADSHEETS, but the signals had to change.
 * MyBooks matches on account_type + detail_type, a nine-value controlled
 * vocabulary with `cogs`, `other_revenue` and `other_expense` as first-class
 * types. This app has `category` with only five values, and `subcategory` is
 * free text that is null on most accounts — so L (COGS), N (Other Income) and
 * O (Other Expenses) have no category signal at all here. They are recovered
 * from the account name and the account-number series instead.
 */

import crypto from 'crypto';

export type LeadSheetSource = 'manual' | 'auto';

export interface LeadSheetMatchInput {
  /** assets | liabilities | equity | revenue | expenses */
  category: string;
  subcategory: string | null;
  accountNumber: string;
  accountName: string;
}

export interface DefaultLeadSheet {
  code: string;
  name: string;
  /** Display / binder order. Seeded onto lead_sheets.sort_order. */
  sortOrder: number;
  /** Match order — LOWER runs FIRST. See the note below on why this is separate. */
  specificity: number;
  match: (a: NormalizedAccount) => boolean;
  /** Confidence reported to the preview UI when this rule wins. */
  confidence: number;
}

/** Pre-lowered fields plus the leading digit, computed once per account. */
interface NormalizedAccount {
  category: string;
  sub: string;
  name: string;
  /** First character of the trimmed account number, or '' when absent. */
  series: string;
}

/**
 * The account-number series, verified against both the system COA templates
 * (5-digit: 10100, 60100) and the demo seeds (4-digit: 1000, 6000):
 *
 *   1 assets · 2 liabilities · 3 equity · 4 revenue
 *   5 cost of sales · 6 operating expenses · 7 other / non-deductible
 *   8 other income (revenue) or uncategorised (expenses)
 *
 * Match on the LEADING DIGIT, never a numeric range — widths vary between
 * templates, seeds and real client charts, so `n >= 5000 && n < 6000` breaks
 * on a 4-digit chart.
 */
function normalize(a: LeadSheetMatchInput): NormalizedAccount {
  const num = (a.accountNumber ?? '').trim();
  return {
    category: (a.category ?? '').trim().toLowerCase(),
    sub: (a.subcategory ?? '').toLowerCase(),
    name: (a.accountName ?? '').toLowerCase(),
    series: num.length > 0 ? num[0] : '',
  };
}

// Confidence tiers, feeding the preview modal's existing colour thresholds
// (>= 0.9 green, >= 0.7 amber, below that muted).
const CONF_NAME = 0.95;   // category + an unambiguous name keyword
const CONF_SERIES = 0.75; // category + account-number series only
const CONF_CATCH = 0.5;   // category catch-all

/**
 * A–O, in LETTER order — this array's index drives `sortOrder`, i.e. the order
 * lead sheets are displayed and printed.
 *
 * `specificity` is a SEPARATE field and drives match order. In MyBooks one
 * array order could do both jobs, because its nine account types made K/L/M/N/O
 * mutually exclusive. Here K and N both live in `revenue`, and L, M and O all
 * live in `expenses`, so the catch-alls must be EVALUATED last while still
 * DISPLAYING at their letter position.
 */
export const DEFAULT_LEAD_SHEETS: readonly DefaultLeadSheet[] = [
  {
    code: 'A', name: 'Cash', sortOrder: 0, specificity: 10, confidence: CONF_NAME,
    match: (a) => a.category === 'assets'
      && /\bcash\b|checking|savings|money market|petty|bank|undeposited/.test(a.name),
  },
  {
    code: 'B', name: 'Accounts Receivable', sortOrder: 10, specificity: 20, confidence: CONF_NAME,
    match: (a) => a.category === 'assets'
      && /receivable|\ba\/?r\b|allowance for doubtful/.test(a.name),
  },
  {
    code: 'C', name: 'Inventory', sortOrder: 20, specificity: 30, confidence: CONF_NAME,
    match: (a) => a.category === 'assets'
      && /inventor|work in process|\bwip\b|raw material|finished goods/.test(a.name),
  },
  {
    code: 'D', name: 'Fixed Assets', sortOrder: 30, specificity: 40, confidence: CONF_NAME,
    // The assets guard is what keeps "Depreciation Expense" (category
    // `expenses`) out of Fixed Assets.
    match: (a) => a.category === 'assets'
      && (/fixed asset|accum|deprec|amortiz|equipment|furniture|vehicle|building|\bland\b|leasehold|machinery|property/.test(a.name)
        || /fixed asset/.test(a.sub)),
  },
  {
    code: 'E', name: 'Other Assets', sortOrder: 40, specificity: 900, confidence: CONF_CATCH,
    match: (a) => a.category === 'assets',
  },
  {
    code: 'F', name: 'Accounts Payable', sortOrder: 50, specificity: 50, confidence: CONF_NAME,
    match: (a) => a.category === 'liabilities'
      && /accounts? payable|trade payable|\ba\/?p\b/.test(a.name),
  },
  {
    code: 'G', name: 'Accrued Liabilities', sortOrder: 60, specificity: 60, confidence: CONF_NAME,
    // Scoped to liabilities so the expense-side twin ("Payroll Taxes",
    // category `expenses`) is unaffected and correctly lands in M.
    match: (a) => a.category === 'liabilities'
      && /accru|payroll|wages|withhold|\btax(es)?\b|deferred revenue|unearned/.test(a.name),
  },
  {
    code: 'H', name: 'Debt', sortOrder: 70, specificity: 70, confidence: CONF_NAME,
    match: (a) => a.category === 'liabilities'
      && /loan|note|mortgage|credit card|line of credit|\bloc\b|\bltd\b|long.?term|\bdebt\b|bond/.test(a.name),
  },
  {
    code: 'I', name: 'Other Liabilities', sortOrder: 80, specificity: 910, confidence: CONF_CATCH,
    match: (a) => a.category === 'liabilities',
  },
  {
    code: 'J', name: 'Equity', sortOrder: 90, specificity: 920, confidence: CONF_CATCH,
    match: (a) => a.category === 'equity',
  },
  {
    code: 'K', name: 'Revenue', sortOrder: 100, specificity: 930, confidence: CONF_CATCH,
    match: (a) => a.category === 'revenue',
  },
  {
    code: 'L', name: 'Cost of Goods Sold', sortOrder: 110, specificity: 80,
    confidence: CONF_NAME,
    match: (a) => a.category === 'expenses'
      && (/cost of goods|\bcogs\b|cost of sales|purchases|materials|freight|direct labor|subcontract|contract labor|resale/.test(a.name)
        || /cost.?of.?sales/.test(a.sub)
        || a.series === '5'),
  },
  {
    code: 'M', name: 'Operating Expenses', sortOrder: 120, specificity: 940, confidence: CONF_CATCH,
    match: (a) => a.category === 'expenses',
  },
  {
    code: 'N', name: 'Other Income', sortOrder: 130, specificity: 15, confidence: CONF_NAME,
    match: (a) => a.category === 'revenue'
      && (/interest|dividend|\bgain\b|other income|misc\w* income|non-?includible|rental income/.test(a.name)
        || a.series === '8'),
  },
  {
    code: 'O', name: 'Other Expenses', sortOrder: 140, specificity: 90, confidence: CONF_NAME,
    // Two traps here, both found against the real system COA templates:
    //
    // 1. This rule must NOT read `subcategory`. Hundreds of template accounts
    //    carry subcategory "Other Expenses" while being ordinary deductible
    //    operating expenses, so a subcategory test would empty M into O.
    // 2. The "other expenses" name test must be ANCHORED. "Car & Truck Other
    //    Expenses" (60380) is an operating expense; "Other Expenses" (61700) is
    //    not. An unanchored /other expense/ misfiles the former.
    match: (a) => a.category === 'expenses'
      && (/^other expenses?\b|^misc\w* expenses?\b|interest expense|non-?deductible|penalt|charitable|uncategorized|ask my accountant|loss on/.test(a.name)
        || a.series === '7' || a.series === '8'),
  },
];

// Sorted once at module load rather than per call.
const BY_SPECIFICITY = [...DEFAULT_LEAD_SHEETS].sort((x, y) => x.specificity - y.specificity);

export interface LeadSheetSuggestion {
  code: string;
  name: string;
  confidence: number;
}

/**
 * First match wins, in specificity order.
 *
 * Returns a CODE, not an id — the caller resolves it against the client's own
 * lead_sheets rows. That is what keeps the letters data rather than code: a
 * user may rename, reorder, delete or add codes and this file never changes.
 * An account whose suggested code no longer exists for that client simply
 * comes back with no target in the preview.
 */
export function suggestLeadSheet(input: LeadSheetMatchInput): LeadSheetSuggestion | null {
  const a = normalize(input);
  for (const def of BY_SPECIFICITY) {
    if (def.match(a)) {
      // A catch-all that fired only because the account number said so is
      // worth reporting at the lower series confidence.
      const isSeriesOnly = def.confidence === CONF_NAME
        && !def.match({ ...a, series: '' });
      return {
        code: def.code,
        name: def.name,
        confidence: isSeriesOnly ? CONF_SERIES : def.confidence,
      };
    }
  }
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Sign-off staleness
// ─────────────────────────────────────────────────────────────────────────────

/** The raw TB component amounts a lead sheet's subtotal is derived from. */
export interface StampRow {
  account_id: number;
  unadjusted_debit: number | string | null;
  unadjusted_credit: number | string | null;
  prior_year_debit: number | string | null;
  prior_year_credit: number | string | null;
  trans_adj_debit: number | string | null;
  trans_adj_credit: number | string | null;
  book_adj_debit: number | string | null;
  book_adj_credit: number | string | null;
  tax_adj_debit: number | string | null;
  tax_adj_credit: number | string | null;
}

const STAMP_FIELDS = [
  'unadjusted_debit', 'unadjusted_credit',
  'prior_year_debit', 'prior_year_credit',
  'trans_adj_debit', 'trans_adj_credit',
  'book_adj_debit', 'book_adj_credit',
  'tax_adj_debit', 'tax_adj_credit',
] as const;

/**
 * SHA-256 over a canonical serialization of the member accounts' raw amounts.
 *
 * A content hash rather than a timestamp, for three reasons:
 *   - journal_entry_lines has no timestamps, and DELETING a journal entry
 *     LOWERS max(updated_at), so a "stored < current" test would never fire —
 *     you could sign, delete the AJE that made it tie, and still read "signed".
 *   - roll-forward and backup restore rewrite updated_at wholesale, which would
 *     mark every restored engagement falsely stale.
 *   - account_id is part of each line, so changing a lead sheet's membership
 *     moves the stamp for free.
 *
 * Hashes the raw components only; the derived *_adjusted_* columns are a pure
 * function of them, so including them would add nothing.
 *
 * The 'v1' prefix lets a future change to this serialization deliberately
 * invalidate every stored stamp.
 */
export function leadSheetBalanceStamp(rows: StampRow[]): string {
  const lines = [...rows]
    .sort((x, y) => x.account_id - y.account_id)
    .map((r) => {
      const parts = STAMP_FIELDS.map((f) => String(Number(r[f] ?? 0)));
      return `${r.account_id}|${parts.join('|')}`;
    });
  return crypto.createHash('sha256').update(`v1\n${lines.join('\n')}`).digest('hex');
}

export type SignoffStatus = 'unsigned' | 'signed' | 'stale';

/** A signature is stale when the amounts moved after it was given. */
export function signoffStatus(
  signoff: { balance_stamp: string } | null | undefined,
  currentStamp: string,
): SignoffStatus {
  if (!signoff) return 'unsigned';
  return signoff.balance_stamp === currentStamp ? 'signed' : 'stale';
}
