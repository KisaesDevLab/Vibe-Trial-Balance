// Copyright 2025-2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Use is limited to qualifying small businesses. See LICENSE for terms.

// Run with: npm run test:jelines (from the repo root)

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { balancingPlug, centsToAmountInput, validateJeLines } from '../jeLines';

const L = (accountId: number | '', debit = '', credit = '') => ({ accountId, debit, credit });

test('debits exceed credits → plug goes in the credit column', () => {
  const lines = [L(1, '100.00'), L(2, '')];
  assert.deepEqual(balancingPlug(lines, 1), { side: 'credit', cents: 10000 });
});

test('credits exceed debits → plug goes in the debit column', () => {
  const lines = [L(1, '', '250.50'), L(2, '')];
  assert.deepEqual(balancingPlug(lines, 1), { side: 'debit', cents: 25050 });
});

test('multi-line: plug nets the rows above', () => {
  const lines = [L(1, '33943.61'), L(2, '10168.32'), L(3, '')];
  assert.deepEqual(balancingPlug(lines, 2), { side: 'credit', cents: 4411193 });
  assert.equal(centsToAmountInput(4411193), '44111.93');
});

test('applying the plug twice is idempotent, and the entry foots', () => {
  const lines = [L(1, '100.00'), L(2, '', '25.00')];
  const first = balancingPlug(lines, 1)!;
  assert.deepEqual(first, { side: 'credit', cents: 10000 });
  const after = [L(1, '100.00'), L(2, '', centsToAmountInput(first.cents))];
  assert.equal(validateJeLines(after).balanced, true);
  // Second click computes the same figure rather than doubling it.
  assert.deepEqual(balancingPlug(after, 1), first);
});

test('plug lands on the wrong side when the target already holds a debit', () => {
  // last row currently a debit, but the entry needs a credit there
  const lines = [L(1, '100.00'), L(2, '40.00')];
  assert.deepEqual(balancingPlug(lines, 1), { side: 'credit', cents: 10000 });
});

test('null means the last row is itself the imbalance — clear it', () => {
  // Rows above already foot; the stray 50.00 on the last row is the whole diff.
  const lines = [L(1, '100.00'), L(2, '', '100.00'), L(3, '50.00')];
  assert.equal(validateJeLines(lines).balanced, false);
  assert.equal(balancingPlug(lines, 2), null);
  const cleared = [L(1, '100.00'), L(2, '', '100.00'), L(3, '')];
  assert.equal(validateJeLines(cleared).balanced, true);
});

test('accounting negative in the debit column is honoured', () => {
  // "(60.00)" in debit normalises to a 60.00 credit
  const lines = [L(1, '(60.00)'), L(2, '')];
  assert.deepEqual(balancingPlug(lines, 1), { side: 'debit', cents: 6000 });
});

test('rows with an amount but no account are excluded, matching the on-screen figure', () => {
  const lines = [L(1, '100.00'), L('', '30.00'), L(2, '')];
  const st = validateJeLines(lines);
  assert.equal(st.totalDebit - st.totalCredit, 10000);
  assert.deepEqual(balancingPlug(lines, 2), { side: 'credit', cents: 10000 });
});
