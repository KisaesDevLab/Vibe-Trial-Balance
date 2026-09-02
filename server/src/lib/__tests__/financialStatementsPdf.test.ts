// Copyright 2025-2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Use is limited to qualifying small businesses. See LICENSE for terms.

/**
 * Financial statement PDF knobs. The % column must agree with fmtPct on
 * FinancialStatementsPage.tsx — the PDF is that screen on paper.
 * Run: npx tsx --test src/lib/__tests__/financialStatementsPdf.test.ts
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fsChangePct, parseFsBasis, parseFsPriorYear } from '../../pdf/reportGenerators';

test('change % mirrors the screen: dash when both zero, N/A with no prior, parens when down', () => {
  assert.equal(fsChangePct(0, 0), '—');
  assert.equal(fsChangePct(500, 0), 'N/A');
  assert.equal(fsChangePct(150, 100), '50.0%');
  assert.equal(fsChangePct(75, 100), '(25.0%)');
  // Denominator is |prior|, so a prior-year loss turning into a profit reads as growth.
  assert.equal(fsChangePct(100, -100), '200.0%');
});

test('basis defaults to book and never trusts an unknown value', () => {
  assert.equal(parseFsBasis(undefined), 'book');
  assert.equal(parseFsBasis('tax'), 'tax');
  assert.equal(parseFsBasis('unadjusted'), 'unadjusted');
  assert.equal(parseFsBasis('prior-year'), 'book');
});

test('priorYear query: explicit on/off, otherwise automatic', () => {
  assert.equal(parseFsPriorYear('true'), true);
  assert.equal(parseFsPriorYear('1'), true);
  assert.equal(parseFsPriorYear('false'), false);
  assert.equal(parseFsPriorYear('0'), false);
  assert.equal(parseFsPriorYear(undefined), undefined);
  assert.equal(parseFsPriorYear('yes'), undefined);
});
