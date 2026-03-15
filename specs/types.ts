// ============================================================
// Shared types for Trial Balance Application
// Used by both client/ and server/
// ============================================================

// ---- Enums & Constants ----

export const ENTITY_TYPES = ['1065', '1120', '1120S', '1040_C'] as const;
export type EntityType = (typeof ENTITY_TYPES)[number];

export const TAX_SOFTWARE_OPTIONS = ['ultratax', 'cch', 'lacerte', 'drake'] as const;
export type TaxSoftware = (typeof TAX_SOFTWARE_OPTIONS)[number];

export const ACCOUNT_CATEGORIES = ['assets', 'liabilities', 'equity', 'revenue', 'expenses'] as const;
export type AccountCategory = (typeof ACCOUNT_CATEGORIES)[number];

export const NORMAL_BALANCES = ['debit', 'credit'] as const;
export type NormalBalance = (typeof NORMAL_BALANCES)[number];

export const JE_TYPES = ['book', 'tax'] as const;
export type JournalEntryType = (typeof JE_TYPES)[number];

export const CLASSIFICATION_STATUSES = ['unclassified', 'ai_suggested', 'confirmed', 'manual'] as const;
export type ClassificationStatus = (typeof CLASSIFICATION_STATUSES)[number];

export const USER_ROLES = ['admin', 'preparer', 'reviewer'] as const;
export type UserRole = (typeof USER_ROLES)[number];

// Category display order for trial balance grid
export const CATEGORY_SORT_ORDER: Record<AccountCategory, number> = {
  assets: 1,
  liabilities: 2,
  equity: 3,
  revenue: 4,
  expenses: 5,
};

// Entity type display labels
export const ENTITY_TYPE_LABELS: Record<EntityType, string> = {
  '1065': '1065 Partnership',
  '1120': '1120 C-Corp',
  '1120S': '1120S S-Corp',
  '1040_C': '1040 Sch C',
};

// ---- Data Types ----

export interface AppUser {
  id: number;
  username: string;
  displayName: string;
  role: UserRole;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Client {
  id: number;
  name: string;
  entityType: EntityType;
  taxYearEnd: string | null;
  defaultTaxSoftware: TaxSoftware | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Period {
  id: number;
  clientId: number;
  periodName: string;
  startDate: string | null;
  endDate: string | null;
  isCurrent: boolean;
  rolledForwardFrom: number | null;
  createdAt: string;
}

export interface Account {
  id: number;
  clientId: number;
  accountNumber: string;
  accountName: string;
  category: AccountCategory;
  subcategory: string | null;
  normalBalance: NormalBalance;
  taxLine: string | null;
  workpaperRef: string | null;
  preparerNotes: string | null;
  reviewerNotes: string | null;
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

/**
 * A single row in the adjusted trial balance.
 * All monetary fields are BIGINT cents from the database.
 * Frontend converts to display dollars: value / 100.
 */
export interface TrialBalanceRow {
  periodId: number;
  accountId: number;
  accountNumber: string;
  accountName: string;
  category: AccountCategory;
  subcategory: string | null;
  normalBalance: NormalBalance;
  taxLine: string | null;
  workpaperRef: string | null;
  preparerNotes: string | null;
  reviewerNotes: string | null;
  sortOrder: number;
  isActive: boolean;

  // All values in cents (BIGINT from DB, number in JS)
  unadjustedDebit: number;
  unadjustedCredit: number;
  bookAdjDebit: number;
  bookAdjCredit: number;
  taxAdjDebit: number;
  taxAdjCredit: number;
  bookAdjustedDebit: number;
  bookAdjustedCredit: number;
  taxAdjustedDebit: number;
  taxAdjustedCredit: number;
}

export interface TrialBalanceValidation {
  isBalanced: boolean;
  unadjustedDifference: number;   // cents — should be 0
  bookAdjustedDifference: number; // cents — should be 0
  taxAdjustedDifference: number;  // cents — should be 0
}

export interface JournalEntry {
  id: number;
  periodId: number;
  entryNumber: number;
  entryType: JournalEntryType;
  entryDate: string;
  description: string | null;
  isRecurring: boolean;
  createdBy: number | null;
  createdAt: string;
  updatedAt: string;
  lines: JournalEntryLine[];
}

export interface JournalEntryLine {
  id: number;
  journalEntryId: number;
  accountId: number;
  accountNumber?: string;   // joined from COA for display
  accountName?: string;     // joined from COA for display
  debit: number;            // cents
  credit: number;           // cents
}

export interface BankTransaction {
  id: number;
  clientId: number;
  periodId: number | null;
  transactionDate: string;
  description: string | null;
  amount: number;             // cents
  checkNumber: string | null;
  accountId: number | null;
  aiSuggestedAccountId: number | null;
  aiConfidence: number | null;
  classificationStatus: ClassificationStatus;
  classifiedBy: number | null;
  importedAt: string;
  // Joined fields for display
  accountName?: string;
  aiSuggestedAccountName?: string;
}

export interface ClassificationRule {
  id: number;
  clientId: number;
  payeePattern: string;
  accountId: number;
  timesConfirmed: number;
  accountName?: string;       // joined for display
}

export interface ClientDocument {
  id: number;
  clientId: number;
  filename: string;
  filePath: string;
  fileSize: number | null;
  fileType: string | null;
  linkedAccountId: number | null;
  linkedJournalEntryId: number | null;
  uploadedBy: number | null;
  uploadedAt: string;
}

export interface TaxLineReference {
  id: number;
  entityType: EntityType;
  taxSoftware: TaxSoftware;
  taxLineCode: string;
  taxLineDescription: string;
  formSection: string;
  sortOrder: number;
}

export interface VarianceNote {
  id: number;
  accountId: number;
  periodId: number;
  comparePeriodId: number;
  note: string;
  createdBy: number | null;
  createdAt: string;
}

// ---- AI Feature Types ----

export interface AIClassificationSuggestion {
  transactionId: number;
  suggestedAccountId: number;
  suggestedAccountNumber: string;
  suggestedAccountName: string;
  confidence: number;         // 0-1
  reasoning: string;
}

export interface AIDiagnosticWarning {
  severity: 'info' | 'warning' | 'error';
  category: string;           // e.g. 'unusual_balance', 'tax_error', 'unmapped'
  accountId: number | null;
  accountNumber: string | null;
  message: string;
  recommendation: string;
}

// ---- API Response Types ----

export interface ApiResponse<T> {
  data: T;
  error: null;
  meta?: Record<string, unknown>;
}

export interface ApiError {
  data: null;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export type ApiResult<T> = ApiResponse<T> | ApiError;

// ---- Multi-Period Comparison ----

export interface PeriodComparisonRow {
  accountId: number;
  accountNumber: string;
  accountName: string;
  category: AccountCategory;
  periods: {
    periodId: number;
    periodName: string;
    taxAdjustedDebit: number;
    taxAdjustedCredit: number;
    netBalance: number;       // debit accounts: DR - CR, credit accounts: CR - DR
  }[];
  dollarVariance: number;     // cents — latest vs. prior
  percentVariance: number | null; // null if prior is 0
  isSignificant: boolean;     // exceeds configured threshold
  varianceNote: string | null;
}

// ---- Utility ----

/**
 * Convert cents (BIGINT) to display dollars string.
 * Example: 123456 → "1,234.56"
 */
export function centsToDisplay(cents: number): string {
  const dollars = cents / 100;
  return dollars.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/**
 * Convert a display dollar string or number to cents.
 * Example: "1,234.56" → 123456
 * Example: 1234.56 → 123456
 */
export function displayToCents(value: string | number): number {
  if (typeof value === 'number') {
    return Math.round(value * 100);
  }
  const cleaned = value.replace(/[^0-9.-]/g, '');
  return Math.round(parseFloat(cleaned) * 100);
}
