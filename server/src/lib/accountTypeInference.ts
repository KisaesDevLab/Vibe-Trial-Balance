// Copyright 2025-2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Use is limited to qualifying small businesses. See LICENSE for terms.

/**
 * Category + normal balance for an account the TB import is about to create.
 *
 * Used by BOTH the analyze and the confirm steps of the CSV and PDF imports,
 * and that is the point: the preview must show the type the confirm will
 * write. Before this existed the preview displayed a placeholder ("expenses")
 * while the confirm inferred its own answer from the account number, so a
 * row could read Expense on screen and land in the COA as an Asset.
 *
 * The number signal is the LEADING DIGIT, not a numeric range: templates are
 * 5-digit and seeds are 4-digit, and `10100 < 2000` is false while
 * `10100 >= 5000` would have called Cash an expense.
 */

export type AccountCategory = 'assets' | 'liabilities' | 'equity' | 'revenue' | 'expenses';
export type NormalBalance = 'debit' | 'credit';

export interface InferredAccountType {
  category: AccountCategory;
  normalBalance: NormalBalance;
}

export const CATEGORY_NORMAL_BALANCE: Record<AccountCategory, NormalBalance> = {
  assets: 'debit',
  liabilities: 'credit',
  equity: 'credit',
  revenue: 'credit',
  expenses: 'debit',
};

const LEADING_DIGIT_CATEGORY: Record<string, AccountCategory> = {
  '1': 'assets',
  '2': 'liabilities',
  '3': 'equity',
  '4': 'revenue',
  // 5–9 are all expense ranges in every common numbering scheme (COGS,
  // operating, other, taxes).
};

const NAME_RULES: Array<[RegExp, AccountCategory]> = [
  [/\b(cash|receivable|asset|equipment|inventory|prepaid|deposit|bank|checking|savings)\b/, 'assets'],
  [/\b(payable|liabilit(y|ies)|loan|debt|accrued|note payable|credit card)\b/, 'liabilities'],
  [/\b(equity|capital|retained|draw(s|ing|ings)?|distribution(s)?|member|partner|stock)\b/, 'equity'],
  [/\b(revenue|income|sales|fees? earned)\b/, 'revenue'],
];

function withBalance(category: AccountCategory): InferredAccountType {
  return { category, normalBalance: CATEGORY_NORMAL_BALANCE[category] };
}

/**
 * Which statement the file says the account belongs to, when it says.
 * 'pnl' = income statement (revenue / expenses), 'bs' = balance sheet
 * (assets / liabilities / equity). The Balances export's `p_n_l` column is
 * the one source today.
 */
export type StatementHint = 'pnl' | 'bs';

const PNL_CATEGORIES: ReadonlySet<AccountCategory> = new Set(['revenue', 'expenses']);

function onStatement(category: AccountCategory, hint: StatementHint): boolean {
  return PNL_CATEGORIES.has(category) === (hint === 'pnl');
}

function byName(accountName: string | null | undefined): AccountCategory | null {
  const name = (accountName ?? '').toLowerCase();
  for (const [re, category] of NAME_RULES) {
    if (re.test(name)) return category;
  }
  return null;
}

/**
 * The leading digit decides when there is one, otherwise a name keyword,
 * otherwise expenses. A statement hint, when the file gives one, is a
 * constraint on top: an answer on the wrong statement is discarded and the
 * next signal tried within the right one — so "3999 P & L Summary" flagged N
 * stays equity, "9999 Rounding Account" flagged Y is an expense, and a
 * "4xxx" account the file flags as a balance sheet item is not called
 * revenue just because of its number. The hint never overrides a category
 * that already sits on its statement.
 */
export function inferAccountType(
  accountNumber: string | null | undefined,
  accountName: string | null | undefined,
  hint: StatementHint | null = null,
): InferredAccountType {
  const fits = (c: AccountCategory | null | undefined): c is AccountCategory =>
    !!c && (hint === null || onStatement(c, hint));

  const digits = (accountNumber ?? '').replace(/\D/g, '');
  if (digits.length > 0) {
    const byDigit = LEADING_DIGIT_CATEGORY[digits[0]] ?? 'expenses';
    if (fits(byDigit)) return withBalance(byDigit);
  }

  const named = byName(accountName);
  if (fits(named)) return withBalance(named);

  return withBalance(hint === 'bs' ? 'assets' : 'expenses');
}

/**
 * Fill `newCategory` / `newNormalBalance` on an import match row that does
 * not carry them yet. Applied to EVERY row of an analysis, matched or not,
 * because the user can flip a matched row to "create new" in the preview and
 * the dropdown must then show a real answer rather than a placeholder. A
 * value the model or the user already set is never overwritten.
 */
export function fillNewAccountType<T extends {
  newCategory?: AccountCategory;
  newNormalBalance?: NormalBalance;
  /** Category detected by the PDF extractor, when one was. */
  category?: string;
}>(
  row: T,
  accountNumber: string | null | undefined,
  accountName: string | null | undefined,
  hint: StatementHint | null = null,
): T & { newCategory: AccountCategory; newNormalBalance: NormalBalance } {
  if (row.newCategory === undefined) {
    const detected = row.category && isCategory(row.category) ? row.category : null;
    row.newCategory = detected ?? inferAccountType(accountNumber, accountName, hint).category;
  }
  if (row.newNormalBalance === undefined) {
    row.newNormalBalance = CATEGORY_NORMAL_BALANCE[row.newCategory];
  }
  return row as T & { newCategory: AccountCategory; newNormalBalance: NormalBalance };
}

export function isCategory(value: string): value is AccountCategory {
  return value in CATEGORY_NORMAL_BALANCE;
}
