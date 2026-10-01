// Copyright 2025-2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Use is limited to qualifying small businesses. See LICENSE for terms.

/**
 * The Statement Writer outline editor's tree operations.
 * Run from the repo root: npm run test:fstree
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildDefaultLayout, type FsNode } from '../../../lib/fsEngine';
import {
  allNodes, combineLines, deleteNodeFromStatement, effectiveScheduleLines, findNode, findParentId, moveLine, moveNode, splitLine,
} from '../fsTreeOps';

const bs = () => buildDefaultLayout('corporation').statements.find((s) => s.kind === 'balance_sheet')!;
const is = () => buildDefaultLayout('corporation').statements.find((s) => s.kind === 'income_statement')!;
const ids = (nodes: FsNode[]) => allNodes(nodes).map((x) => x.node.id);

test('a lead sheet line moves into another section, once', () => {
  const next = moveNode(bs().body, 'bs_inventory', 'bs_ppe', 'inside');
  assert.equal(findParentId(next, 'bs_inventory'), 'bs_ppe');
  assert.equal(ids(next).filter((i) => i === 'bs_inventory').length, 1);
});

test('reorders before / after', () => {
  const next = moveNode(bs().body, 'bs_ar', 'bs_cash', 'before');
  const cur = (findNode(next, 'bs_current_assets') as Extract<FsNode, { type: 'section' }>).children.map((c) => c.id);
  assert.deepEqual(cur, ['bs_ar', 'bs_cash', 'bs_inventory']);
});

test('a section cannot be dropped into its own subtree', () => {
  const body = bs().body;
  assert.equal(moveNode(body, 'bs_assets', 'bs_cash', 'after'), body);
});

test('deleting a line scrubs the totals and rounding plugs that named it', () => {
  const st = deleteNodeFromStatement({ ...is(), plugs: { is_net_income: 'is_cogs', is_gross_profit: 'is_revenue' } }, 'is_cogs');
  const gp = findNode(st.body, 'is_gross_profit') as Extract<FsNode, { type: 'total' }>;
  assert.deepEqual(gp.terms.map((t) => t.nodeId), ['is_revenue']);
  assert.deepEqual(st.plugs, { is_gross_profit: 'is_revenue' });
});

test('schedule lines: explicit first, the rest by account order; combine, move, split', () => {
  const order = (a: string, b: string) => a.localeCompare(b);
  let lines = effectiveScheduleLines(undefined, ['30', '10', '20'], order);
  assert.deepEqual(lines.map((l) => l.accountRefs[0]!.accountId), ['10', '20', '30']);
  lines = combineLines(lines, [0, 2], 'Ten and thirty');
  assert.deepEqual(lines.map((l) => l.caption ?? l.accountRefs[0]!.accountId), ['Ten and thirty', '20']);
  assert.deepEqual(lines[0]!.accountRefs.map((r) => r.accountId), ['10', '30']);
  lines = moveLine(lines, 1, -1);
  assert.equal(lines[0]!.accountRefs[0]!.accountId, '20');
  lines = splitLine(lines, 1);
  assert.equal(lines.length, 3);
});

test('an explicit schedule line survives only for accounts still on the lead sheet', () => {
  const order = (a: string, b: string) => a.localeCompare(b);
  const again = effectiveScheduleLines([{ id: 'x', caption: 'X', accountRefs: [{ accountId: '99' }] }], ['10'], order);
  assert.deepEqual(again.map((l) => l.accountRefs[0]!.accountId), ['10']);
  // …and an account can sit on one line only.
  const dup = effectiveScheduleLines(
    [{ id: 'a', accountRefs: [{ accountId: '10' }] }, { id: 'b', caption: 'Again', accountRefs: [{ accountId: '10' }, { accountId: '20' }] }],
    ['10', '20'], order,
  );
  assert.deepEqual(dup.map((l) => l.accountRefs.map((r) => r.accountId)), [['10'], ['20']]);
});
