// Copyright 2025-2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Use is limited to qualifying small businesses. See LICENSE for terms.

/**
 * PY tie-out arithmetic: what the tagged true-up entries do to the uploaded
 * prior year, and whether the result ties to the rolled prior year.
 *
 * A PY true-up has to be posted in the CURRENT year — the prior year is
 * closed — so on the trial balance it looks like any other AJE. The entries
 * carry `source_tag = 'py_tieout'`, and this module applies their lines to the
 * bookkeeper's uploaded balances so the preparer can see the prior year the
 * adjustments imply:
 *
 *   adjusted = uploaded + true-up      (per account, in net-debit terms)
 *   remaining = adjusted − rolled      (0 = this account ties)
 *
 * Two different questions, both worth answering, neither implying the other:
 *   - does the ADJUSTED prior year BALANCE?  Σ adjusted == 0
 *   - does it TIE to the rolled prior year?  every remaining == 0
 * A true-up whose offset went to Retained Earnings balances by construction
 * while leaving Retained Earnings itself off the rolled figure, which is
 * exactly the case a preparer needs to see rather than have hidden.
 *
 * Everything here is signed NET DEBIT cents: debit positive, credit negative.
 * That is the only representation in which balances add up; the debit/credit
 * split is a display choice applied at the edge (`splitNet`).
 */

/** One account's two prior-year balances, as the comparison screen shows them. */
export interface PyAccountBalances {
  accountId: number;
  rolledPyDebit: number;
  rolledPyCredit: number;
  uploadedPyDebit: number;
  uploadedPyCredit: number;
}

/** One tagged journal entry line. */
export interface TrueUpLine {
  accountId: number;
  debit: number;
  credit: number;
}

export interface PyTrueUpRow {
  accountId: number;
  /** Net effect of the tagged entries on this account, split for display. */
  trueUpDebit: number;
  trueUpCredit: number;
  /** uploaded + true-up. */
  adjustedPyDebit: number;
  adjustedPyCredit: number;
  /** adjusted − rolled, net debit. 0 = this account ties to the rolled prior year. */
  remainingVarianceCents: number;
}

export interface PyTieOutSummary {
  /** Tagged entries in the period. 0 = nothing to report; the screen hides the columns. */
  trueUpEntries: number;
  trueUpDebitCents: number;
  trueUpCreditCents: number;
  /** Σ net debit of the upload as it stands. 0 = the bookkeeper's file balances on its own. */
  uploadedNetCents: number;
  /** Σ net debit after the true-ups. 0 = the adjusted prior year balances. */
  adjustedNetCents: number;
  /** Σ net debit of this app's own prior year. Normally 0. */
  rolledNetCents: number;
  /** Accounts whose adjusted balance still differs from the rolled one. */
  accountsStillOff: number;
  /** Σ |adjusted − rolled|. Nets are not used: two opposite misses do not tie. */
  remainingAbsCents: number;
}

export interface PyTieOutResult {
  rows: Map<number, PyTrueUpRow>;
  summary: PyTieOutSummary;
}

/** Debit positive, credit negative — the only form in which balances add up. */
export function netDebit(debit: number, credit: number): number {
  return Number(debit) - Number(credit);
}

/** Signed net back to a debit/credit pair for display. */
export function splitNet(net: number): { debit: number; credit: number } {
  return net >= 0 ? { debit: net, credit: 0 } : { debit: 0, credit: -net };
}

/** Net effect per account of every tagged line. Lines on one account accumulate. */
export function sumTrueUpLines(lines: readonly TrueUpLine[]): Map<number, number> {
  const out = new Map<number, number>();
  for (const l of lines) {
    out.set(l.accountId, (out.get(l.accountId) ?? 0) + netDebit(l.debit, l.credit));
  }
  return out;
}

/**
 * Apply the tagged true-ups to the uploaded balances.
 *
 * `accounts` must already be the union the comparison screen shows. An account
 * touched only by a true-up (a Retained Earnings offset that carried no
 * variance of its own, say) still gets a row, because leaving it out would
 * hide the very plug the preparer is checking.
 */
export function reconcilePyTieOut(
  accounts: readonly PyAccountBalances[],
  trueUpByAccount: ReadonlyMap<number, number>,
  trueUpEntries: number,
): PyTieOutResult {
  const rows = new Map<number, PyTrueUpRow>();
  const summary: PyTieOutSummary = {
    trueUpEntries,
    trueUpDebitCents: 0,
    trueUpCreditCents: 0,
    uploadedNetCents: 0,
    adjustedNetCents: 0,
    rolledNetCents: 0,
    accountsStillOff: 0,
    remainingAbsCents: 0,
  };

  const seen = new Set<number>();
  const add = (accountId: number, rolled: number, uploaded: number): void => {
    seen.add(accountId);
    const trueUp = trueUpByAccount.get(accountId) ?? 0;
    const adjusted = uploaded + trueUp;
    const remaining = adjusted - rolled;

    const tu = splitNet(trueUp);
    const adj = splitNet(adjusted);
    rows.set(accountId, {
      accountId,
      trueUpDebit: tu.debit,
      trueUpCredit: tu.credit,
      adjustedPyDebit: adj.debit,
      adjustedPyCredit: adj.credit,
      remainingVarianceCents: remaining,
    });

    summary.trueUpDebitCents += tu.debit;
    summary.trueUpCreditCents += tu.credit;
    summary.uploadedNetCents += uploaded;
    summary.adjustedNetCents += adjusted;
    summary.rolledNetCents += rolled;
    if (remaining !== 0) {
      summary.accountsStillOff++;
      summary.remainingAbsCents += Math.abs(remaining);
    }
  };

  for (const a of accounts) {
    add(
      a.accountId,
      netDebit(a.rolledPyDebit, a.rolledPyCredit),
      netDebit(a.uploadedPyDebit, a.uploadedPyCredit),
    );
  }
  // An account the true-up touched that the comparison never listed: both
  // prior-year sides are zero, so the entry's effect IS the remaining variance.
  for (const accountId of trueUpByAccount.keys()) {
    if (!seen.has(accountId)) add(accountId, 0, 0);
  }

  return { rows, summary };
}
