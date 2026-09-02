// Copyright 2025-2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Use is limited to qualifying small businesses. See LICENSE for terms.

/**
 * PY tie-out date range for the QuickBooks import.
 * Run: npx tsx --test src/lib/__tests__/qboPriorRange.test.ts
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { priorYearRange, shiftBackOneYear } from '../qbo/priorRange';

test('shiftBackOneYear: plain dates, leap day lands on the 28th, month-end stays month-end', () => {
  assert.equal(shiftBackOneYear('2025-01-01'), '2024-01-01');
  assert.equal(shiftBackOneYear('2025-12-31'), '2024-12-31');
  assert.equal(shiftBackOneYear('2024-02-29'), '2023-02-28');
  assert.equal(shiftBackOneYear('2025-02-28'), '2024-02-28'); // never "promoted" to the 29th
  assert.equal(shiftBackOneYear('2025-07-31'), '2024-07-31');
  assert.throws(() => shiftBackOneYear('2025-1-1'));
});

test('an adjacent period in the app supplies the range — including a short year', () => {
  const r = priorYearRange('2025-01-01', '2025-12-31', [
    { id: 7, period_name: 'FY2023', start_date: '2023-01-01', end_date: '2023-12-31' },
    { id: 9, period_name: 'Stub 2024', start_date: '2024-07-01', end_date: '2024-12-31' },
  ]);
  assert.deepEqual(r, { startDate: '2024-07-01', endDate: '2024-12-31', source: 'period', priorPeriodId: 9, priorPeriodName: 'Stub 2024' });
});

test('no adjacent period: both dates slide back one year', () => {
  const r = priorYearRange('2025-01-01', '2025-12-31', [
    { id: 7, period_name: 'FY2023', start_date: '2023-01-01', end_date: '2023-12-31' }, // not adjacent
  ]);
  assert.deepEqual(r, { startDate: '2024-01-01', endDate: '2024-12-31', source: 'derived', priorPeriodId: null, priorPeriodName: null });
});

test('fiscal year ending 30 June derives 1 Jul – 30 Jun of the year before', () => {
  const r = priorYearRange('2024-07-01', '2025-06-30', []);
  assert.equal(r.startDate, '2023-07-01');
  assert.equal(r.endDate, '2024-06-30');
});

test('timestamps on candidate rows are tolerated; a tie goes to the lowest id', () => {
  const r = priorYearRange('2025-01-01', '2025-12-31', [
    { id: 12, period_name: 'Dup', start_date: '2024-01-01T00:00:00.000Z', end_date: '2024-12-31T00:00:00.000Z' },
    { id: 4, period_name: 'FY2024', start_date: '2024-01-01T00:00:00.000Z', end_date: '2024-12-31T00:00:00.000Z' },
  ]);
  assert.equal(r.priorPeriodId, 4);
  assert.equal(r.startDate, '2024-01-01');
});
