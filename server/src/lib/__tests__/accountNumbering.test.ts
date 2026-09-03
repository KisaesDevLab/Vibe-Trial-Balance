import { test } from 'node:test';
import assert from 'node:assert/strict';
import { assignSequentialNumbers, dominantWidth } from '../accountNumbering';

const coa = (...pairs: Array<[string, 'assets' | 'liabilities' | 'equity' | 'revenue' | 'expenses' | null]>) =>
  pairs.map(([number, category]) => ({ number, category }));

test('dominantWidth: the most common digit count wins, 4 when there is nothing numeric', () => {
  assert.equal(dominantWidth([]), 4);
  assert.equal(dominantWidth(['1000', '2000', '10100']), 4);
  assert.equal(dominantWidth(['10100', '20100', '60100', '1000']), 5);
  assert.equal(dominantWidth(['CASH', 'AR']), 4);
});

test('continues the client\'s own sequence in steps of ten, per band', () => {
  const existing = coa(['1000', 'assets'], ['1010', 'assets'], ['1025', 'assets'], ['6000', 'expenses'], ['6100', 'expenses']);
  const out = assignSequentialNumbers(
    [
      { key: 'a', name: 'Petty Cash', category: 'assets' },
      { key: 'b', name: 'Office Supplies', category: 'expenses' },
      { key: 'c', name: 'Postage', category: 'expenses' },
    ],
    existing,
  );
  assert.deepEqual(out.map((o) => [o.key, o.number]), [['a', '1030'], ['b', '6110'], ['c', '6120']]);
});

test('an empty band starts at its base', () => {
  const out = assignSequentialNumbers(
    [{ key: 'x', name: 'Loan Payable', category: 'liabilities' }, { key: 'y', name: 'Sales', category: 'revenue' }],
    coa(['1000', 'assets']),
  );
  assert.deepEqual(out.map((o) => o.number), ['2000', '4000']);
});

test('follows the client\'s expense digit when they use 5xxx instead of 6xxx', () => {
  const out = assignSequentialNumbers(
    [{ key: 'e', name: 'Rent', category: 'expenses' }],
    coa(['5000', 'expenses'], ['5100', 'expenses'], ['5200', 'expenses']),
  );
  assert.equal(out[0]?.number, '5210');
});

test('matches the client\'s width: a 5-digit chart gets 5-digit numbers', () => {
  const out = assignSequentialNumbers(
    [{ key: 'e', name: 'Rent', category: 'expenses' }, { key: 'a', name: 'Cash', category: 'assets' }],
    coa(['10100', 'assets'], ['20100', 'liabilities'], ['60100', 'expenses']),
  );
  assert.deepEqual(out.map((o) => o.number), ['60110', '10110']);
});

test('never hands out an existing, reserved or just-assigned number', () => {
  const out = assignSequentialNumbers(
    [{ key: 'a', name: 'A', category: 'assets' }, { key: 'b', name: 'B', category: 'assets' }],
    coa(['1000', 'assets']),
    ['1010', '1020'],
  );
  assert.deepEqual(out.map((o) => o.number), ['1030', '1040']);
});

test('a row with no category is typed from its name and never gets a QB placeholder', () => {
  const out = assignSequentialNumbers(
    [{ key: 'r', name: 'Consulting Income', category: null }, { key: 'l', name: 'Accounts Payable', category: null }],
    coa(['4000', 'revenue'], ['2000', 'liabilities']),
  );
  assert.equal(out[0]?.category, 'revenue');
  assert.equal(out[0]?.normalBalance, 'credit');
  assert.equal(out[0]?.number, '4010');
  assert.equal(out[1]?.category, 'liabilities');
  assert.equal(out[1]?.number, '2010');
  for (const o of out) assert.doesNotMatch(o.number, /^QB/i);
});

test('a full band steps by one past its top rather than giving up', () => {
  const existing = coa(['3990', 'equity']);
  const out = assignSequentialNumbers(
    [{ key: 'a', name: 'A', category: 'equity' }, { key: 'b', name: 'B', category: 'equity' }],
    existing,
    ['4000'],
  );
  // 3990 → next step is 4000 (reserved) → past the band, so +1.
  assert.deepEqual(out.map((o) => o.number), ['4001', '4002']);
});
