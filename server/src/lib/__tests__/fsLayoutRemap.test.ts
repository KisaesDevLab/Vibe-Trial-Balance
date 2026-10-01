// Copyright 2025-2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Use is limited to qualifying small businesses. See LICENSE for terms.

/**
 * Remapping the ids inside a statement layout on restore.
 * Run: npx tsx --test src/lib/__tests__/fsLayoutRemap.test.ts
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { remapFsLayoutIds } from '../fs/fsLayoutRemap';
import { bindLayout, buildDefaultLayout, fsClientLayoutSchema, type FsLayout, type FsNode } from '../fs/engine';

// Old ids 1..15 are lead sheets A..O; the restore renumbers everything +1000.
const groupings = 'ABCDEFGHIJKLMNO'.split('').map((code, i) => ({ id: String(i + 1), code, name: code }));
const plus1000 = { account: (id: number) => id + 1000, leadSheet: (id: number) => id + 1000 };

function layout(): FsLayout {
  const l = bindLayout(buildDefaultLayout('corporation'), groupings).layout;
  const is = l.statements.find((s) => s.kind === 'income_statement')!;
  const opex = is.body.find((n) => n.id === 'is_opex') as Extract<FsNode, { type: 'leadsheet' }>;
  opex.scheduleLines = [{ id: 'occ', caption: 'Occupancy', accountRefs: [{ accountId: '60' }, { accountId: '61' }] }];
  is.body.push({ type: 'account', id: 'rent_line', refs: [{ accountId: '60' }], caption: 'Rent' });
  const net = is.body.find((n) => n.id === 'is_net_income') as Extract<FsNode, { type: 'total' }>;
  net.terms.push({ nodeId: 'rent_line', sign: -1 });
  is.plugs = { is_net_income: 'rent_line' };
  const eq = l.statements.find((s) => s.kind === 'equity')!;
  eq.equity = { columns: 'by_account', columnCaptions: { 30: 'Capital Stock', '-1': 'Retained Earnings' } };
  return l;
}

const find = (l: FsLayout, kind: string, id: string): FsNode => {
  const walk = (ns: FsNode[]): FsNode | undefined => {
    for (const n of ns) {
      if (n.id === id) return n;
      if (n.type === 'section') { const hit = walk(n.children); if (hit) return hit; }
    }
    return undefined;
  };
  return walk(l.statements.find((s) => s.kind === kind)!.body)!;
};

test('every id in a layout is rewritten: lead sheets, schedule lines, account lines, equity captions', () => {
  const out = remapFsLayoutIds(layout(), plus1000) as FsLayout;
  assert.equal(fsClientLayoutSchema.safeParse(out).success, true);
  const cash = find(out, 'balance_sheet', 'bs_cash') as Extract<FsNode, { type: 'leadsheet' }>;
  assert.deepEqual(cash.ref, { groupingId: '1001', leadsheetCode: 'A' });
  const opex = find(out, 'income_statement', 'is_opex') as Extract<FsNode, { type: 'leadsheet' }>;
  assert.deepEqual(opex.scheduleLines?.[0]?.accountRefs, [{ accountId: '1060' }, { accountId: '1061' }]);
  assert.deepEqual((find(out, 'income_statement', 'rent_line') as Extract<FsNode, { type: 'account' }>).refs, [{ accountId: '1060' }]);
  assert.deepEqual(out.statements.find((s) => s.kind === 'equity')!.equity?.columnCaptions, { 1030: 'Capital Stock', '-1': 'Retained Earnings' });
  // Nothing of the old numbering survives.
  assert.ok(!/"(groupingId|accountId)":"\d{1,3}"/.test(JSON.stringify(out)));
});

test('the input is not mutated', () => {
  const before = layout();
  const snapshot = JSON.stringify(before);
  remapFsLayoutIds(before, plus1000);
  assert.equal(JSON.stringify(before), snapshot);
});

test('a lead sheet that was not restored falls back to its code', () => {
  const out = remapFsLayoutIds(layout(), { ...plus1000, leadSheet: (id) => (id === 1 ? undefined : id + 1000) }) as FsLayout;
  const cash = find(out, 'balance_sheet', 'bs_cash') as Extract<FsNode, { type: 'leadsheet' }>;
  assert.deepEqual(cash.ref, { leadsheetCode: 'A' }, 'no stale id is left to point at another client');
  assert.equal(fsClientLayoutSchema.safeParse(out).success, true);
});

test('an account that was not restored is dropped, and what named its line is scrubbed', () => {
  const out = remapFsLayoutIds(layout(), { ...plus1000, account: (id) => (id === 60 ? undefined : id + 1000) }) as FsLayout;
  assert.equal(find(out, 'income_statement', 'rent_line'), undefined, 'the line had only that account');
  const net = find(out, 'income_statement', 'is_net_income') as Extract<FsNode, { type: 'total' }>;
  assert.ok(!net.terms.some((t) => t.nodeId === 'rent_line'));
  assert.deepEqual(out.statements.find((s) => s.kind === 'income_statement')!.plugs, {});
  const opex = find(out, 'income_statement', 'is_opex') as Extract<FsNode, { type: 'leadsheet' }>;
  assert.deepEqual(opex.scheduleLines?.[0]?.accountRefs, [{ accountId: '1061' }]);
  assert.equal(fsClientLayoutSchema.safeParse(out).success, true);
});

test('a schedule left with no accounts loses its customization, not the line', () => {
  const out = remapFsLayoutIds(layout(), { ...plus1000, account: () => undefined }) as FsLayout;
  const opex = find(out, 'income_statement', 'is_opex') as Extract<FsNode, { type: 'leadsheet' }>;
  assert.equal(opex.scheduleLines, undefined);
  assert.equal(opex.ref.groupingId, '1013');
});

test('anything that is not a layout is passed through', () => {
  assert.equal(remapFsLayoutIds(null, plus1000), null);
  assert.deepEqual(remapFsLayoutIds({ version: 1 }, plus1000), { version: 1 });
});
