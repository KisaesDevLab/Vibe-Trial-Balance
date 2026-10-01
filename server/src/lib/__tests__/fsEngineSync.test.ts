// Copyright 2025-2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Use is limited to qualifying small businesses. See LICENSE for terms.

/**
 * The Statement Writer engine exists twice: server/src/lib/fs/engine is the
 * canonical copy, client/src/lib/fsEngine is generated from it by
 * `node scripts/sync-fs-engine.mjs`. The browser's live preview and the
 * server's stored numbers must come from the same code, so this pins the
 * two copies to each other.
 * Run: npx tsx --test src/lib/__tests__/fsEngineSync.test.ts
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';

const SERVER_DIR = join(__dirname, '..', 'fs', 'engine');
const CLIENT_DIR = join(__dirname, '..', '..', '..', '..', 'client', 'src', 'lib', 'fsEngine');

function tsFiles(dir: string, base = dir): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = join(dir, e.name);
    if (e.isDirectory()) return tsFiles(p, base);
    return e.name.endsWith('.ts') ? [relative(base, p).replace(/\\/g, '/')] : [];
  }).sort();
}

// Line endings are normalised: git may check the two trees out differently.
const digest = (path: string) =>
  createHash('sha256').update(readFileSync(path, 'utf8').replace(/\r\n/g, '\n')).digest('hex');

test('the client engine has exactly the server engine\'s files', () => {
  assert.deepEqual(tsFiles(CLIENT_DIR), tsFiles(SERVER_DIR), 'run: node scripts/sync-fs-engine.mjs');
});

test('every client engine file is byte-identical to the server copy', () => {
  for (const f of tsFiles(SERVER_DIR)) {
    assert.equal(digest(join(CLIENT_DIR, f)), digest(join(SERVER_DIR, f)), `${f} differs — run: node scripts/sync-fs-engine.mjs`);
  }
});

test('the engine imports nothing but zod and itself', () => {
  // It must compile in the browser: no node: builtins, no server modules.
  for (const f of tsFiles(SERVER_DIR)) {
    const src = readFileSync(join(SERVER_DIR, f), 'utf8');
    for (const m of src.matchAll(/from\s+'([^']+)'/g)) {
      const spec = m[1]!;
      assert.ok(spec === 'zod' || spec.startsWith('./') || spec.startsWith('../'), `${f} imports ${spec}`);
      assert.ok(!spec.endsWith('.js'), `${f}: drop the .js suffix from ${spec}`);
      if (spec.startsWith('../')) assert.ok(f.includes('/'), `${f} reaches outside the engine with ${spec}`);
    }
  }
});
