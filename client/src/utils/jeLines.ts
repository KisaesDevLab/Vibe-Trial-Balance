// Copyright 2025-2026 Kisaes LLC
// Licensed under the PolyForm Internal Use License 1.0.0.
// You may not distribute this software. See LICENSE for terms.

import { evalAmountExpr } from './evalAmountExpr';

// Shared validation for the journal-entry line editors. The invariants here
// must match the server's posting rules (journalEntries.ts lineSchema):
//  - amounts are non-negative integer cents, one side per line
//  - the balance check runs on EXACTLY the set of lines that will be posted
//    (a row with an amount but no account blocks submit instead of being
//    silently dropped)
//  - an accounting-negative amount ("(100)" or "-100") in one column is
//    normalized to a positive amount in the opposite column

export interface JeLineInput {
  accountId: number | '';
  debit: string;
  credit: string;
}

export interface PostableJeLine {
  accountId: number;
  debit: number;
  credit: number;
}

export interface JeLinesStatus {
  totalDebit: number;
  totalCredit: number;
  /** true when postable lines balance, are non-empty, and there are no blockers */
  canSubmit: boolean;
  balanced: boolean;
  /** human-readable reasons submit is blocked (excluding imbalance) */
  blockers: string[];
  lines: PostableJeLine[];
}

/** Integer cents, or NaN when the input is not a valid amount/expression. */
export function parseJeCents(val: string): number {
  const evaled = evalAmountExpr(val);
  const cleaned = evaled.replace(/[$,\s]/g, '');
  if (cleaned === '') return 0;
  const paren = /^\((.*)\)$/.exec(cleaned);
  const body = paren ? paren[1] : cleaned;
  const sign = paren ? -1 : 1;
  if (!/^[+-]?\d+(\.\d+)?$/.test(body)) return NaN;
  return sign * Math.round(parseFloat(body) * 100);
}

export function validateJeLines(rawLines: JeLineInput[]): JeLinesStatus {
  const blockers: string[] = [];
  const lines: PostableJeLine[] = [];
  let totalDebit = 0;
  let totalCredit = 0;

  rawLines.forEach((l, i) => {
    const rowNo = i + 1;
    let d = l.debit.trim() === '' ? 0 : parseJeCents(l.debit);
    let c = l.credit.trim() === '' ? 0 : parseJeCents(l.credit);
    if (Number.isNaN(d) || Number.isNaN(c)) {
      blockers.push(`Line ${rowNo}: amount is not a valid number.`);
      return;
    }
    // Normalize accounting negatives to the opposite side.
    if (d < 0) { c += -d; d = 0; }
    if (c < 0) { d += -c; c = 0; }
    if (d === 0 && c === 0) return; // blank row — ignored
    if (d > 0 && c > 0) {
      blockers.push(`Line ${rowNo}: a line cannot carry both a debit and a credit.`);
      return;
    }
    if (l.accountId === '') {
      blockers.push(`Line ${rowNo}: amount entered but no account selected.`);
      return;
    }
    totalDebit += d;
    totalCredit += c;
    lines.push({ accountId: l.accountId, debit: d, credit: c });
  });

  const balanced = totalDebit === totalCredit && totalDebit > 0;
  return {
    totalDebit,
    totalCredit,
    balanced,
    blockers,
    canSubmit: balanced && blockers.length === 0 && lines.length >= 2,
    lines,
  };
}
