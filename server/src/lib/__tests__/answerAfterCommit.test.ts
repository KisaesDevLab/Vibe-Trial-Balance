// Copyright 2025-2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Use is limited to qualifying small businesses. See LICENSE for terms.

/**
 * Q136: a route answers AFTER its transaction commits, never from inside the
 * `db.transaction(async (trx) => { ... })` callback. Answering inside sent a
 * 201 before COMMIT: a caller acting at once (an MCP agent posting an entry,
 * then deleting an account) read nothing, and a failed COMMIT left a 201 for
 * rows that never existed. The callback returns what the answer needs.
 *
 * Reads the route sources, so a new route doing it fails here.
 * Run: npx tsx --test src/lib/__tests__/answerAfterCommit.test.ts
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const SRC = path.resolve(__dirname, '..', '..');

function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name !== '__tests__' && e.name !== 'node_modules') out.push(...sourceFiles(p));
    } else if (e.name.endsWith('.ts')) out.push(p);
  }
  return out;
}

/** The body of every `.transaction(async (x) => { ... })` callback, with its line. */
export function transactionBodies(src: string): Array<{ line: number; body: string }> {
  const out: Array<{ line: number; body: string }> = [];
  const re = /\.transaction\(\s*async\s*\(\s*\w+\s*\)[^{]*\{/g;
  for (const m of src.matchAll(re)) {
    let i = (m.index as number) + m[0].length;
    let depth = 1;
    while (i < src.length && depth > 0) {
      const c = src[i];
      if (c === '{') depth++;
      else if (c === '}') depth--;
      i++;
    }
    out.push({ line: src.slice(0, m.index).split('\n').length, body: src.slice((m.index as number) + m[0].length, i) });
  }
  return out;
}

test('the scanner finds an answer inside a transaction callback', () => {
  const bad = "await db.transaction(async (trx) => {\n  await trx('x').insert({});\n  res.status(201).json({ data: 1 });\n});";
  assert.ok(transactionBodies(bad).some((b) => /\bres\.(status|json|send)\b/.test(b.body)));
  const good = "const row = await db.transaction(async (trx) => { return trx('x').insert({}); });\nres.status(201).json({ data: row });";
  assert.ok(!transactionBodies(good).some((b) => /\bres\.(status|json|send)\b/.test(b.body)));
});

test('no route answers from inside its transaction (Q136)', () => {
  const offenders: string[] = [];
  for (const file of sourceFiles(SRC)) {
    const src = fs.readFileSync(file, 'utf8');
    for (const { line, body } of transactionBodies(src)) {
      if (/\bres\.(status|json|send|end|sendStatus)\b/.test(body)) offenders.push(`${path.relative(SRC, file)}:${line}`);
    }
  }
  assert.deepEqual(offenders, [], `answer after the transaction resolves, not inside it: ${offenders.join(', ')}`);
});
