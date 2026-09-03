// Copyright 2025-2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Use is limited to qualifying small businesses. See LICENSE for terms.

/**
 * Apply the user's preview decisions to the server-computed match rows. Pure.
 *
 * The browser only ever says WHERE a row goes (match to account X, create a
 * new account, skip). The amounts always come from the stored report rows,
 * re-derived on confirm — a decision payload carrying cents is ignored.
 */
import { CATEGORY_NORMAL_BALANCE, isCategory, type AccountCategory, type NormalBalance } from '../accountTypeInference';
import { type MatchedRow } from './matcher';

export type DecisionAction = 'match' | 'create_new' | 'skip';

export interface ImportDecision {
  rowKey: string;
  action: DecisionAction;
  matchedAccountId?: number | null;
  newAccountNumber?: string | null;
  newAccountName?: string | null;
  newCategory?: string | null;
  newNormalBalance?: string | null;
}

export interface FinalRow {
  rowKey: string;
  qboAccountId: string | null;
  qboFullName: string;
  debitCents: number;
  creditCents: number;
  action: DecisionAction;
  matchedAccountId: number | null;
  newAccountNumber: string | null;
  newAccountName: string | null;
  newCategory: AccountCategory | null;
  newNormalBalance: NormalBalance | null;
}

export class DecisionError extends Error {
  readonly rowKey: string;
  constructor(rowKey: string, message: string) {
    super(message);
    this.name = 'DecisionError';
    this.rowKey = rowKey;
  }
}

function isNormalBalance(v: unknown): v is NormalBalance {
  return v === 'debit' || v === 'credit';
}

export function applyDecisions(rows: MatchedRow[], decisions: ImportDecision[]): FinalRow[] {
  const byKey = new Map<string, ImportDecision>();
  for (const d of decisions) byKey.set(d.rowKey, d);

  return rows.map((row): FinalRow => {
    const d = byKey.get(row.rowKey);
    const base: FinalRow = {
      rowKey: row.rowKey,
      qboAccountId: row.qboAccountId,
      qboFullName: row.qboFullName,
      debitCents: row.debitCents,
      creditCents: row.creditCents,
      action: 'skip',
      matchedAccountId: null,
      newAccountNumber: null,
      newAccountName: null,
      newCategory: null,
      newNormalBalance: null,
    };

    // No decision: the computed action stands; an exception has nowhere to go.
    const action: DecisionAction = d ? d.action : row.action === 'exception' ? 'skip' : row.action;

    if (action === 'skip') return base;

    if (action === 'match') {
      const id = d?.matchedAccountId ?? row.matchedAccountId;
      if (typeof id !== 'number' || !Number.isInteger(id) || id <= 0) {
        throw new DecisionError(row.rowKey, `Row ${row.rowKey} (${row.qboFullName}) is marked as a match but names no account.`);
      }
      return { ...base, action: 'match', matchedAccountId: id };
    }

    // No placeholder: a number the reviewer never saw would land on the chart
    // of accounts as if they had chosen it.
    const number = (d?.newAccountNumber ?? '').trim() || row.newAccountNumber;
    if (!number) {
      throw new DecisionError(row.rowKey, `Row ${row.rowKey} (${row.qboFullName}) is a new account but has no account number.`);
    }
    const decidedCategory = d?.newCategory;
    const category: AccountCategory | null =
      typeof decidedCategory === 'string' && isCategory(decidedCategory) ? decidedCategory : row.newCategory;
    const decidedNormal = d?.newNormalBalance;
    const normal: NormalBalance | null = isNormalBalance(decidedNormal)
      ? decidedNormal
      : category
        ? CATEGORY_NORMAL_BALANCE[category]
        : row.newNormalBalance;
    return {
      ...base,
      action: 'create_new',
      newAccountNumber: number,
      newAccountName: ((d?.newAccountName ?? '').trim() || row.newAccountName || row.qboFullName).slice(0, 255),
      newCategory: category,
      newNormalBalance: normal,
    };
  });
}
