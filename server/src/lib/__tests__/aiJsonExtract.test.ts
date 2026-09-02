// Copyright 2025-2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Use is limited to qualifying small businesses. See LICENSE for terms.

/**
 * JSON extraction from AI replies, including recovery of an array the model
 * did not get to close. Run: npx tsx --test src/lib/__tests__/aiJsonExtract.test.ts
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { extractJsonArray, salvageJsonArray } from '../aiJsonExtract';

const ROW = (n: number) => `{"account_number": "${n}", "suggested_tax_code": "212", "confidence": 0.8, "reasoning": "ok [x]"}`;

test('extractJsonArray handles fences, prose and an object wrapper', () => {
  assert.equal(extractJsonArray(`Sure:\n\`\`\`json\n[${ROW(1)}]\n\`\`\``)?.length, 1);
  assert.equal(extractJsonArray(`{"results": [${ROW(1)}, ${ROW(2)}]}`)?.length, 2);
  assert.equal(extractJsonArray(`[${ROW(1)}, {"account_number": "2", "suggested`), null);
});

test('salvageJsonArray keeps the complete rows of a reply cut off mid-element', () => {
  const cut = `\`\`\`json\n[\n${ROW(1)},\n${ROW(2)},\n{"account_number": "3", "suggested_tax_code": "20`;
  const r = salvageJsonArray<{ account_number: string }>(cut);
  assert.equal(r.complete, false);
  assert.deepEqual(r.items.map((i) => i.account_number), ['1', '2']);
});

test('salvageJsonArray reports a closed array and tolerates numeric keys', () => {
  const r = salvageJsonArray<{ account_number: unknown }>(`[{"account_number": 100000, "suggested_tax_code": null}]`);
  assert.equal(r.complete, true);
  assert.equal(r.items.length, 1);
  assert.equal(r.items[0].account_number, 100000);
  assert.deepEqual(salvageJsonArray('I cannot help with that.'), { items: [], complete: false });
  // Reasoning text that contains brackets does not derail the walk.
  const s = salvageJsonArray<{ account_number: string }>(`[${ROW(7)}, {"account_number": "8", "reasoning": "see [Sch L]"}`);
  assert.deepEqual(s.items.map((i) => i.account_number), ['7', '8']);
});
