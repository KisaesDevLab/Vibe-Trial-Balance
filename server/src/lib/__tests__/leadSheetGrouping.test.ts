// Copyright 2025-2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Use is limited to qualifying small businesses. See LICENSE for terms.

/**
 * Lead sheet grouping for the statements.
 * Run: npx tsx --test src/lib/__tests__/leadSheetGrouping.test.ts
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { groupByLeadSheet, hasLeadSheetMapping, type LeadSheetGroupableRow } from '../leadSheetGrouping';

const row = (
  account_number: string,
  ls?: { id: number; code: string; name: string; sort: number },
): LeadSheetGroupableRow => ({
  account_number,
  lead_sheet_id: ls?.id ?? null,
  lead_sheet_code: ls?.code ?? null,
  lead_sheet_name: ls?.name ?? null,
  lead_sheet_sort: ls?.sort ?? null,
});

const A = { id: 1, code: 'A', name: 'Cash', sort: 1 };
const M = { id: 2, code: 'M', name: 'Operating Expenses', sort: 13 };
const K = { id: 3, code: 'K', name: 'Revenue', sort: 11 };

test('an unmapped chart of accounts is not offered grouping', () => {
  assert.equal(hasLeadSheetMapping([row('1000'), row('2000')]), false);
  assert.equal(hasLeadSheetMapping([row('1000'), row('2000', A)]), true);
  assert.equal(hasLeadSheetMapping([]), false);
});

test('with nothing mapped, rows come back as one unlabelled group', () => {
  const groups = groupByLeadSheet([row('2000'), row('1000')]);
  assert.equal(groups.length, 1);
  assert.equal(groups[0].label, '', 'no header to render');
  assert.deepEqual(groups[0].rows.map((r) => r.account_number), ['1000', '2000']);
});

test('no rows, no groups', () => {
  assert.deepEqual(groupByLeadSheet([]), []);
});

test('rows are grouped and labelled by lead sheet', () => {
  const groups = groupByLeadSheet([row('6000', M), row('1000', A)]);
  assert.deepEqual(groups.map((g) => g.label), ['A — Cash', 'M — Operating Expenses']);
});

test('groups follow the lead sheet sort order, not the account number', () => {
  const groups = groupByLeadSheet([row('6000', M), row('4000', K), row('1000', A)]);
  assert.deepEqual(groups.map((g) => g.label), ['A — Cash', 'K — Revenue', 'M — Operating Expenses']);
});

test('ties on sort order fall back to the code', () => {
  const X = { id: 4, code: 'X', name: 'Ex', sort: 5 };
  const B = { id: 5, code: 'B', name: 'Bee', sort: 5 };
  const groups = groupByLeadSheet([row('1', X), row('2', B)]);
  assert.deepEqual(groups.map((g) => g.label), ['B — Bee', 'X — Ex']);
});

test('accounts sort numerically inside a group', () => {
  const groups = groupByLeadSheet([row('10100', A), row('1000', A), row('1050', A)]);
  assert.deepEqual(groups[0].rows.map((r) => r.account_number), ['1000', '1050', '10100']);
});

test('unassigned accounts collect into a trailing bucket', () => {
  const groups = groupByLeadSheet([row('9000'), row('1000', A), row('6000', M)]);
  assert.deepEqual(groups.map((g) => g.label), ['A — Cash', 'M — Operating Expenses', 'Unassigned']);
  assert.deepEqual(groups[2].rows.map((r) => r.account_number), ['9000']);
});

test('unassigned stays last even when it sorts first by every other rule', () => {
  const late = { id: 9, code: 'Z', name: 'Zed', sort: 99 };
  const groups = groupByLeadSheet([row('1000'), row('2000', late)]);
  assert.deepEqual(groups.map((g) => g.label), ['Z — Zed', 'Unassigned']);
});

test('a lead sheet with no code is still labelled by its name', () => {
  const noCode = { id: 7, code: '', name: 'Intercompany', sort: 2 };
  assert.equal(groupByLeadSheet([row('1000', noCode)])[0].label, 'Intercompany');
});

test('a lead sheet with neither code nor name still gets a label', () => {
  const bare = { id: 8, code: '', name: '', sort: 2 };
  assert.equal(groupByLeadSheet([row('1000', bare)])[0].label, 'Lead sheet');
});

test('every input row lands in exactly one group', () => {
  const rows = [row('1000', A), row('1010', A), row('6000', M), row('9000'), row('9010')];
  const groups = groupByLeadSheet(rows);
  assert.equal(groups.reduce((n, g) => n + g.rows.length, 0), rows.length);
});
