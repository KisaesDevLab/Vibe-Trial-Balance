// Copyright 2025-2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Use is limited to qualifying small businesses. See LICENSE for terms.

/**
 * Import alias claims. Run: npx tsx --test src/lib/__tests__/importAliases.test.ts
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseAliases, normalizeAlias, planAliasClaims, type AliasAccountRow } from '../importAliases';

const row = (id: number, account_name: string, aliases: string[] = []): AliasAccountRow =>
  ({ id, account_name, import_aliases: aliases });

const aliasesOf = (updates: ReturnType<typeof planAliasClaims>, id: number): string[] | undefined =>
  updates.find((u) => u.accountId === id)?.aliases;

// ── parseAliases ────────────────────────────────────────────────────────────

test('parseAliases takes arrays, JSON strings, and refuses junk', () => {
  assert.deepEqual(parseAliases(['a', 'b']), ['a', 'b']);
  assert.deepEqual(parseAliases('["a","b"]'), ['a', 'b']);
  assert.deepEqual(parseAliases(['a', 3, null]), ['a']);
  assert.deepEqual(parseAliases('not json'), []);
  assert.deepEqual(parseAliases(null), []);
  assert.deepEqual(parseAliases({}), []);
});

test('normalizeAlias trims and folds case', () => {
  assert.equal(normalizeAlias('  Cash  '), 'cash');
  assert.equal(normalizeAlias('CASH'), normalizeAlias('cash'));
});

// ── granting ────────────────────────────────────────────────────────────────

test('a new alias is added to its account', () => {
  const updates = planAliasClaims([row(1, 'Cash')], [{ accountId: 1, name: 'Operating Cash' }]);
  assert.deepEqual(aliasesOf(updates, 1), ['Operating Cash']);
});

test('an alias equal to the account name is not stored', () => {
  const updates = planAliasClaims([row(1, 'Cash')], [{ accountId: 1, name: 'Cash' }]);
  assert.deepEqual(updates, []);
});

test('the account-name check ignores case and padding', () => {
  const updates = planAliasClaims([row(1, 'Cash')], [{ accountId: 1, name: '  cash ' }]);
  assert.deepEqual(updates, []);
});

test('a blank name is not an alias', () => {
  const updates = planAliasClaims([row(1, 'Cash')], [{ accountId: 1, name: '   ' }]);
  assert.deepEqual(updates, []);
});

test('re-importing the same file writes nothing the second time', () => {
  const rows = [row(1, 'Cash', ['Operating Cash'])];
  assert.deepEqual(planAliasClaims(rows, [{ accountId: 1, name: 'Operating Cash' }]), []);
});

test('a differently-cased repeat does not create a second copy', () => {
  const rows = [row(1, 'Cash', ['Operating Cash'])];
  assert.deepEqual(planAliasClaims(rows, [{ accountId: 1, name: 'OPERATING CASH' }]), []);
});

// ── the collision: one text, one account ────────────────────────────────────

test('claiming an alias held by another account MOVES it', () => {
  const rows = [row(1, 'Cash', ['Due from Apothecary']), row(2, 'Due to/from Apothecary')];
  const updates = planAliasClaims(rows, [{ accountId: 2, name: 'Due from Apothecary' }]);
  assert.deepEqual(aliasesOf(updates, 2), ['Due from Apothecary'], 'new owner gains it');
  assert.deepEqual(aliasesOf(updates, 1), [], 'previous owner loses it');
});

test('the move is case-insensitive', () => {
  const rows = [row(1, 'Cash', ['DUE FROM APOTHECARY']), row(2, 'Due to/from Apothecary')];
  const updates = planAliasClaims(rows, [{ accountId: 2, name: 'due from apothecary' }]);
  assert.deepEqual(aliasesOf(updates, 1), []);
  assert.deepEqual(aliasesOf(updates, 2), ['due from apothecary']);
});

test('moving one alias leaves the loser other aliases intact', () => {
  const rows = [row(1, 'Cash', ['Petty Cash', 'Due from Apothecary']), row(2, 'Due to/from Apothecary')];
  const updates = planAliasClaims(rows, [{ accountId: 2, name: 'Due from Apothecary' }]);
  assert.deepEqual(aliasesOf(updates, 1), ['Petty Cash']);
});

test('an existing duplicate across three accounts collapses to the claimant', () => {
  const rows = [row(1, 'A', ['Shared']), row(2, 'B', ['Shared']), row(3, 'C')];
  const updates = planAliasClaims(rows, [{ accountId: 3, name: 'Shared' }]);
  assert.deepEqual(aliasesOf(updates, 1), []);
  assert.deepEqual(aliasesOf(updates, 2), []);
  assert.deepEqual(aliasesOf(updates, 3), ['Shared']);
});

test('a claim by the account that already holds it still strips the other holder', () => {
  const rows = [row(1, 'A', ['Shared']), row(2, 'B', ['Shared'])];
  const updates = planAliasClaims(rows, [{ accountId: 1, name: 'Shared' }]);
  assert.equal(aliasesOf(updates, 1), undefined, 'winner unchanged, so not rewritten');
  assert.deepEqual(aliasesOf(updates, 2), []);
});

// ── batches ─────────────────────────────────────────────────────────────────

test('several claims in one import are applied together', () => {
  const rows = [row(1, 'Cash'), row(2, 'AR'), row(3, 'AP')];
  const updates = planAliasClaims(rows, [
    { accountId: 1, name: 'Operating Cash' },
    { accountId: 2, name: 'Trade Receivables' },
    { accountId: 3, name: 'Trade Payables' },
  ]);
  assert.equal(updates.length, 3);
  assert.deepEqual(aliasesOf(updates, 2), ['Trade Receivables']);
});

test('the last claim on the same text wins', () => {
  const rows = [row(1, 'A'), row(2, 'B')];
  const updates = planAliasClaims(rows, [
    { accountId: 1, name: 'Shared' },
    { accountId: 2, name: 'Shared' },
  ]);
  assert.deepEqual(aliasesOf(updates, 2), ['Shared']);
  // Account 1 gained it and lost it again within the batch, so its stored list
  // is unchanged and it is not rewritten at all.
  assert.equal(aliasesOf(updates, 1), undefined);
});

test('the loser of a same-batch fight keeps the aliases it already had', () => {
  const rows = [row(1, 'A', ['Kept']), row(2, 'B')];
  const updates = planAliasClaims(rows, [
    { accountId: 1, name: 'Shared' },
    { accountId: 2, name: 'Shared' },
  ]);
  assert.deepEqual(aliasesOf(updates, 2), ['Shared']);
  assert.equal(aliasesOf(updates, 1), undefined, 'net effect on 1 is nil');
});

test('a claim for an account outside the rows is ignored, and steals nothing', () => {
  const rows = [row(1, 'Cash', ['Operating Cash'])];
  assert.deepEqual(planAliasClaims(rows, [{ accountId: 99, name: 'Operating Cash' }]), []);
});

test('untouched accounts are not rewritten', () => {
  const rows = [row(1, 'Cash', ['Operating Cash']), row(2, 'AR', ['Trade Receivables'])];
  const updates = planAliasClaims(rows, [{ accountId: 1, name: 'Bank Account' }]);
  assert.deepEqual(updates.map((u) => u.accountId), [1]);
});
