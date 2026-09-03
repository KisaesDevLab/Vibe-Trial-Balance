import { test } from 'node:test';
import assert from 'node:assert/strict';
import { netDebit, reconcilePyTieOut, splitNet, sumTrueUpLines, type PyAccountBalances } from '../pyTieOut';

const acct = (
  accountId: number,
  rolled: [number, number],
  uploaded: [number, number],
): PyAccountBalances => ({
  accountId,
  rolledPyDebit: rolled[0],
  rolledPyCredit: rolled[1],
  uploadedPyDebit: uploaded[0],
  uploadedPyCredit: uploaded[1],
});

test('netDebit and splitNet round-trip, credit stays negative', () => {
  assert.equal(netDebit(500, 0), 500);
  assert.equal(netDebit(0, 500), -500);
  assert.deepEqual(splitNet(500), { debit: 500, credit: 0 });
  assert.deepEqual(splitNet(-500), { debit: 0, credit: 500 });
  assert.deepEqual(splitNet(0), { debit: 0, credit: 0 });
});

test('sumTrueUpLines accumulates several lines on one account', () => {
  const m = sumTrueUpLines([
    { accountId: 1, debit: 100, credit: 0 },
    { accountId: 1, debit: 0, credit: 30 },
    { accountId: 2, debit: 0, credit: 70 },
  ]);
  assert.equal(m.get(1), 70);
  assert.equal(m.get(2), -70);
});

test('a true-up that covers every variance makes the prior year tie', () => {
  // Uploaded is short 500 debit on account 1; the offset takes the other side.
  const accounts = [acct(1, [1500, 0], [1000, 0]), acct(9, [0, 1500], [0, 1000])];
  const trueUp = sumTrueUpLines([
    { accountId: 1, debit: 500, credit: 0 },
    { accountId: 9, debit: 0, credit: 500 },
  ]);
  const { rows, summary } = reconcilePyTieOut(accounts, trueUp, 1);

  assert.equal(rows.get(1)?.adjustedPyDebit, 1500);
  assert.equal(rows.get(1)?.remainingVarianceCents, 0);
  assert.equal(rows.get(9)?.adjustedPyCredit, 1500);
  assert.equal(summary.accountsStillOff, 0);
  assert.equal(summary.remainingAbsCents, 0);
  assert.equal(summary.adjustedNetCents, 0, 'adjusted prior year balances');
});

test('an account missing from the upload is trued up from zero — the case that used to 404', () => {
  // Rolled carries a credit of 242,668.57; the bookkeeper's file omits the account.
  const accounts = [acct(16016, [0, 24266857], [0, 0])];
  const trueUp = sumTrueUpLines([{ accountId: 16016, debit: 0, credit: 24266857 }]);
  const { rows, summary } = reconcilePyTieOut(accounts, trueUp, 1);
  assert.equal(rows.get(16016)?.adjustedPyCredit, 24266857);
  assert.equal(rows.get(16016)?.remainingVarianceCents, 0);
  assert.equal(summary.accountsStillOff, 0);
});

test('balancing and tying are different questions: an RE plug balances while leaving RE off the rolled figure', () => {
  // Account 1 is short 500; the offset goes to Retained Earnings (9), which
  // the rolled prior year does NOT carry. The entry balances; RE still differs.
  const accounts = [acct(1, [1500, 0], [1000, 0]), acct(9, [0, 1000], [0, 1000])];
  const trueUp = sumTrueUpLines([
    { accountId: 1, debit: 500, credit: 0 },
    { accountId: 9, debit: 0, credit: 500 },
  ]);
  const { summary, rows } = reconcilePyTieOut(accounts, trueUp, 1);
  assert.equal(rows.get(1)?.remainingVarianceCents, 0, 'the variance account ties');
  assert.equal(rows.get(9)?.remainingVarianceCents, -500, 'RE now carries the plug');
  assert.equal(summary.adjustedNetCents, 0, 'the adjusted prior year still balances');
  assert.equal(summary.accountsStillOff, 1, 'but it does not tie to the rolled prior year');
  assert.equal(summary.remainingAbsCents, 500);
});

test('opposite misses do not cancel: remainingAbs sums magnitudes', () => {
  const accounts = [acct(1, [1000, 0], [1500, 0]), acct(2, [1000, 0], [500, 0])];
  const { summary } = reconcilePyTieOut(accounts, new Map(), 0);
  assert.equal(summary.accountsStillOff, 2);
  assert.equal(summary.remainingAbsCents, 1000);
  assert.equal(summary.adjustedNetCents, 3000 - 1000 + 1000 - 3000 + 2000, 'net sum is not the tie-out measure');
});

test('an account touched only by a true-up still gets a row', () => {
  const trueUp = sumTrueUpLines([{ accountId: 42, debit: 250, credit: 0 }]);
  const { rows, summary } = reconcilePyTieOut([], trueUp, 1);
  const r = rows.get(42);
  assert.ok(r, 'the offset account must be visible, not silently dropped');
  assert.equal(r.trueUpDebit, 250);
  assert.equal(r.adjustedPyDebit, 250);
  assert.equal(r.remainingVarianceCents, 250);
  assert.equal(summary.accountsStillOff, 1);
});

test('no tagged entries: adjusted equals uploaded and the summary reports the upload as it stands', () => {
  const accounts = [acct(1, [1500, 0], [1000, 0])];
  const { rows, summary } = reconcilePyTieOut(accounts, new Map(), 0);
  assert.equal(rows.get(1)?.trueUpDebit, 0);
  assert.equal(rows.get(1)?.adjustedPyDebit, 1000);
  assert.equal(rows.get(1)?.remainingVarianceCents, -500);
  assert.equal(summary.trueUpEntries, 0);
  assert.equal(summary.uploadedNetCents, 1000);
  assert.equal(summary.adjustedNetCents, 1000);
});
