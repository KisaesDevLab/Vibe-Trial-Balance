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

export function inferAccountType(accountNumber: string | null | undefined, accountName: string | null | undefined): InferredAccountType {
  const digits = (accountNumber ?? '').replace(/\D/g, '');
  if (digits.length > 0) {
    const byDigit = LEADING_DIGIT_CATEGORY[digits[0]];
    return withBalance(byDigit ?? 'expenses');
  }

  const name = (accountName ?? '').toLowerCase();
  for (const [re, category] of NAME_RULES) {
    if (re.test(name)) return withBalance(category);
  }
  return withBalance('expenses');
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
}>(row: T, accountNumber: string | null | undefined, accountName: string | null | undefined): T & { newCategory: AccountCategory; newNormalBalance: NormalBalance } {
  if (row.newCategory === undefined) {
    const detected = row.category && isCategory(row.category) ? row.category : null;
    row.newCategory = detected ?? inferAccountType(accountNumber, accountName).category;
  }
  if (row.newNormalBalance === undefined) {
    row.newNormalBalance = CATEGORY_NORMAL_BALANCE[row.newCategory];
  }
  return row as T & { newCategory: AccountCategory; newNormalBalance: NormalBalance };
}

export function isCategory(value: string): value is AccountCategory {
  return value in CATEGORY_NORMAL_BALANCE;
}
