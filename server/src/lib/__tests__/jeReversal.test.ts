import { test } from 'node:test';
import assert from 'node:assert/strict';
import { reversalLines, reversalDescription, REVERSAL_TAG } from '../jeReversal';

test('reversal swaps every line and keeps the accounts', () => {
  const lines = [
    { account_id: 7, debit: '118050', credit: '0' },
    { account_id: 4, debit: 0, credit: 118050 },
  ];
  assert.deepEqual(reversalLines(lines), [
    { account_id: 7, debit: 0, credit: 118050 },
    { account_id: 4, debit: 118050, credit: 0 },
  ]);
});

test('a reversal balances when the entry does', () => {
  const lines = [
    { account_id: 1, debit: 500, credit: 0 },
    { account_id: 2, debit: 250, credit: 0 },
    { account_id: 3, debit: 0, credit: 750 },
  ];
  const rev = reversalLines(lines);
  const dr = rev.reduce((s, l) => s + l.debit, 0);
  const cr = rev.reduce((s, l) => s + l.credit, 0);
  assert.equal(dr, 750);
  assert.equal(cr, 750);
});

test('reversal description names the entry', () => {
  assert.equal(reversalDescription('book', 3, 'Accrue December utilities'), 'Reversal of book AJE #3: Accrue December utilities');
  assert.equal(reversalDescription('tax', 1, null), 'Reversal of tax AJE #1');
  assert.equal(reversalDescription('tax', 1, ''), 'Reversal of tax AJE #1');
});

test('the tag fits journal_entries.source_tag (20)', () => {
  assert.ok(REVERSAL_TAG.length <= 20);
});
