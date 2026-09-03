// Copyright 2025-2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Use is limited to qualifying small businesses. See LICENSE for terms.

/**
 * Deterministic QBO account → COA row matching. Pure.
 *
 * Order: the row's stored `qbo_account_id` (a previous import bound it), then
 * the QBO account's own AcctNum against `chart_of_accounts.account_number`,
 * then — in a second pass, so a name can never steal a row an id or number
 * claims — an EXACT name match, else create-new typed from QBO's
 * `Classification`.
 *
 * The name pass exists because a QuickBooks company that never turned on
 * account numbers has no AcctNum at all, and without it every one of its
 * accounts came back as "Create new" with a `QB<Id>` placeholder. It is
 * equality after `normalizeName()` (case, whitespace), tried on the
 * fully-qualified name and then the leaf, and only when exactly ONE unclaimed
 * COA row carries that name whose category does not contradict QBO's
 * Classification. There is still no fuzzy matching: "Bank Charges" vs "Bank
 * Service Charges" is exactly the kind of guess that lands a balance in the
 * wrong account. That is what the opt-in AI suggestion pass and the preview's
 * dropdown are for, and the preview badges a name match "by name" so the
 * reviewer looks at it.
 */
import { CATEGORY_NORMAL_BALANCE, type AccountCategory, type NormalBalance } from '../accountTypeInference';
import type { QboReportRow } from './reportParser';

export interface CoaRowForMatch {
  id: number;
  account_number: string;
  account_name: string;
  qbo_account_id: string | null;
  /** When present, a name match is refused if it contradicts QBO's Classification. */
  category?: string | null;
  /** The QBO display name a TB CSV import recorded for this account (may carry QBO numbers). */
  qbo_account_name?: string | null;
}

/** The subset of QBO `Account` the matcher and the confirm need; stored with the import. */
export interface QboAccountLite {
  Id: string;
  Name: string;
  FullyQualifiedName: string;
  AcctNum: string | null;
  Classification: string | null;
  AccountType: string | null;
  Active: boolean;
}

export type MatchAction = 'match' | 'create_new' | 'exception';
export type MatchType = 'qbo_id' | 'acct_num' | 'qbo_name' | 'name';
export type ExceptionReason = 'NO_ACCOUNT_ID' | 'ACCT_NUM_BOUND_ELSEWHERE' | 'DUPLICATE_ACCT_NUM';

export interface MatchedRow {
  /** Stable per-import key: the row's index in the flattened report. */
  rowKey: string;
  qboAccountId: string | null;
  /** Leaf name as printed on the report. */
  qboName: string;
  /** `Parent:Child` from the Account record, else the report path joined. */
  qboFullName: string;
  qboAcctNum: string | null;
  classification: string | null;
  debitCents: number;
  creditCents: number;
  action: MatchAction;
  matchType: MatchType | null;
  matchedAccountId: number | null;
  matchedAccountNumber: string | null;
  matchedAccountName: string | null;
  /** The matched COA row has no qbo_account_id yet; confirm stamps it. */
  writeQboId: boolean;
  newAccountNumber: string | null;
  newAccountName: string | null;
  newCategory: AccountCategory | null;
  newNormalBalance: NormalBalance | null;
  exceptionReason: ExceptionReason | null;
}

const CLASSIFICATION_MAP: Record<string, AccountCategory> = {
  asset: 'assets',
  liability: 'liabilities',
  equity: 'equity',
  revenue: 'revenue',
  expense: 'expenses',
};

/** QBO `Classification` → this app's five categories; null when unknown so the caller can fall back. */
export function classificationToCategory(
  cls: string | null | undefined,
): { category: AccountCategory; normalBalance: NormalBalance } | null {
  const category = CLASSIFICATION_MAP[(cls ?? '').trim().toLowerCase()];
  if (!category) return null;
  return { category, normalBalance: CATEGORY_NORMAL_BALANCE[category] };
}

/** Case- and whitespace-insensitive key for the exact-name pass. */
export function normalizeName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, ' ');
}

/**
 * Key for comparing a QBO display name recorded by another tool against the
 * API's `FullyQualifiedName`. The Balances export writes the name WITH the
 * QBO account number on each level ("60400 Bank Service Charges:60450
 * Overdraft Fees") while the API's fully-qualified name has none ("Bank
 * Service Charges:Overdraft Fees"), so a leading numeric token is dropped
 * from every `:` segment before the case/whitespace fold. Only a leading
 * token that is all digits goes — "2nd Floor Rent" keeps its "2nd".
 */
export function normalizeQboDisplayName(name: string): string {
  return name
    .split(':')
    .map((seg) => normalizeName(seg.replace(/^\s*\d+(?:[.\-]\d+)*\s+/, '')))
    .filter((seg) => seg.length > 0)
    .join(':');
}

// There is deliberately NO placeholder number for a QBO account without an
// AcctNum. `newAccountNumber` stays null and the preview will not confirm
// until the reviewer types one or takes a suggestion (AI or in-sequence via
// POST /import/qbo/suggest-numbers). A `QB<Id>` stand-in used to be minted
// here; it leaked into charts of accounts as a real number.

export function matchRows(rows: QboReportRow[], coa: CoaRowForMatch[], qboAccounts: QboAccountLite[]): MatchedRow[] {
  const coaByQboId = new Map<string, CoaRowForMatch>();
  const coaByNumber = new Map<string, CoaRowForMatch>();
  for (const c of coa) {
    if (c.qbo_account_id) coaByQboId.set(c.qbo_account_id, c);
    coaByNumber.set(c.account_number.trim(), c);
  }
  const qboById = new Map<string, QboAccountLite>();
  for (const a of qboAccounts) qboById.set(a.Id, a);

  const claimedCoaIds = new Set<number>();
  const claimedNewNumbers = new Set<string>();

  const results = rows.map((row, index): MatchedRow => {
    const acct = row.qboAccountId ? qboById.get(row.qboAccountId) ?? null : null;
    const acctNum = acct?.AcctNum?.trim() || null;
    const base: MatchedRow = {
      rowKey: String(index),
      qboAccountId: row.qboAccountId,
      qboName: row.name,
      qboFullName: acct?.FullyQualifiedName || [...row.path, row.name].join(':'),
      qboAcctNum: acctNum,
      classification: acct?.Classification ?? null,
      debitCents: row.debitCents,
      creditCents: row.creditCents,
      action: 'exception',
      matchType: null,
      matchedAccountId: null,
      matchedAccountNumber: null,
      matchedAccountName: null,
      writeQboId: false,
      newAccountNumber: null,
      newAccountName: null,
      newCategory: null,
      newNormalBalance: null,
      exceptionReason: null,
    };

    if (!row.qboAccountId) return { ...base, exceptionReason: 'NO_ACCOUNT_ID' };

    const matched = (c: CoaRowForMatch, matchType: MatchType, writeQboId: boolean): MatchedRow => {
      if (claimedCoaIds.has(c.id)) return { ...base, exceptionReason: 'DUPLICATE_ACCT_NUM' };
      claimedCoaIds.add(c.id);
      return {
        ...base,
        action: 'match',
        matchType,
        matchedAccountId: c.id,
        matchedAccountNumber: c.account_number,
        matchedAccountName: c.account_name,
        writeQboId,
      };
    };

    const byId = coaByQboId.get(row.qboAccountId);
    if (byId) return matched(byId, 'qbo_id', false);

    if (acctNum) {
      const byNum = coaByNumber.get(acctNum);
      if (byNum) {
        // A COA row already bound to a DIFFERENT QBO account cannot also be
        // this one; the user decides in the preview rather than us re-binding.
        if (byNum.qbo_account_id && byNum.qbo_account_id !== row.qboAccountId) {
          return { ...base, exceptionReason: 'ACCT_NUM_BOUND_ELSEWHERE' };
        }
        return matched(byNum, 'acct_num', true);
      }
    }

    const newNumber = acctNum ?? null;
    if (newNumber !== null) {
      if (claimedNewNumbers.has(newNumber) || coaByNumber.has(newNumber)) {
        return { ...base, exceptionReason: 'DUPLICATE_ACCT_NUM' };
      }
      claimedNewNumbers.add(newNumber);
    }
    const typed = classificationToCategory(acct?.Classification);
    return {
      ...base,
      action: 'create_new',
      newAccountNumber: newNumber,
      newAccountName: (acct?.FullyQualifiedName || base.qboFullName).slice(0, 255),
      newCategory: typed?.category ?? null,
      newNormalBalance: typed?.normalBalance ?? null,
    };
  });

  // ── Second pass: the QBO name another tool recorded on the COA row ────────
  // A TB CSV import (Balances export) stores the QuickBooks description of
  // each account; it identifies the QBO account as surely as a number does
  // once the numbers are stripped, so it is tried before the looser match on
  // the COA's own name — still only when exactly one row carries it.
  const coaByQboName = new Map<string, CoaRowForMatch[]>();
  for (const c of coa) {
    if (!c.qbo_account_name) continue;
    const key = normalizeQboDisplayName(c.qbo_account_name);
    if (!key) continue;
    const list = coaByQboName.get(key);
    if (list) list.push(c);
    else coaByQboName.set(key, [c]);
  }
  const takeByName = (i: number, c: CoaRowForMatch, matchType: MatchType): void => {
    claimedCoaIds.add(c.id);
    results[i] = {
      ...results[i],
      action: 'match',
      matchType,
      matchedAccountId: c.id,
      matchedAccountNumber: c.account_number,
      matchedAccountName: c.account_name,
      writeQboId: true,
      newAccountNumber: null,
      newAccountName: null,
      newCategory: null,
      newNormalBalance: null,
    };
  };
  const acceptable = (c: CoaRowForMatch, row: MatchedRow): boolean => {
    if (claimedCoaIds.has(c.id)) return false;
    // Already the twin of a different QBO account — leave it alone.
    if (c.qbo_account_id && c.qbo_account_id !== row.qboAccountId) return false;
    const typed = classificationToCategory(row.classification);
    if (typed && c.category && c.category !== typed.category) return false;
    return true;
  };
  if (coaByQboName.size > 0) {
    for (let i = 0; i < results.length; i++) {
      const r = results[i];
      if (r.action !== 'create_new' || !r.qboAccountId) continue;
      const list = coaByQboName.get(normalizeQboDisplayName(r.qboFullName));
      if (!list || list.length !== 1 || !acceptable(list[0], r)) continue;
      takeByName(i, list[0], 'qbo_name');
    }
  }

  // ── Third pass: exact names, for the rows nothing stronger claimed ────────
  const coaByName = new Map<string, CoaRowForMatch[]>();
  for (const c of coa) {
    const key = normalizeName(c.account_name);
    if (!key) continue;
    const list = coaByName.get(key);
    if (list) list.push(c);
    else coaByName.set(key, [c]);
  }
  const uniqueUnclaimed = (name: string, row: MatchedRow): CoaRowForMatch | null => {
    const list = coaByName.get(normalizeName(name));
    if (!list || list.length !== 1) return null;
    return acceptable(list[0], row) ? list[0] : null;
  };
  for (let i = 0; i < results.length; i++) {
    const r = results[i];
    if (r.action !== 'create_new' || !r.qboAccountId) continue;
    const leaf = r.qboFullName.includes(':') ? r.qboFullName.slice(r.qboFullName.lastIndexOf(':') + 1) : null;
    const c = uniqueUnclaimed(r.qboFullName, r) ?? (leaf ? uniqueUnclaimed(leaf, r) : null);
    if (!c) continue;
    takeByName(i, c, 'name');
  }
  return results;
}

export interface TbRowForAbsence {
  account_id: number;
  account_number: string;
  account_name: string;
  unadjusted_debit: number | string;
  unadjusted_credit: number | string;
}

export interface AbsentAccount {
  accountId: number;
  accountNumber: string;
  accountName: string;
  debitCents: number;
  creditCents: number;
}

/**
 * Vibe accounts carrying a nonzero unadjusted balance that the QBO report did
 * not mention. QBO omits zero-balance accounts, so an account that WAS in an
 * earlier import and has since been zeroed in QuickBooks simply disappears;
 * left alone, the stale balance would survive the import.
 */
export function findAbsentNonzeroAccounts(tbRows: TbRowForAbsence[], matchedAccountIds: Set<number>): AbsentAccount[] {
  const out: AbsentAccount[] = [];
  for (const r of tbRows) {
    if (matchedAccountIds.has(r.account_id)) continue;
    const debitCents = Number(r.unadjusted_debit) || 0;
    const creditCents = Number(r.unadjusted_credit) || 0;
    if (debitCents === 0 && creditCents === 0) continue;
    out.push({ accountId: r.account_id, accountNumber: r.account_number, accountName: r.account_name, debitCents, creditCents });
  }
  return out;
}
