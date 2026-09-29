// Copyright 2025-2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Use is limited to qualifying small businesses. See LICENSE for terms.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const DEPLOY_DIR = path.resolve(__dirname, '../../../../deploy');
const CONFIGS = ['nginx.conf', 'nginx-docker.conf'];

const REQUIRED = [
  'X-Content-Type-Options',
  'X-Frame-Options',
  'Referrer-Policy',
  'Permissions-Policy',
  'Cross-Origin-Opener-Policy',
  'Cross-Origin-Resource-Policy',
  'Strict-Transport-Security',
  'Content-Security-Policy-Report-Only',
];

function stripComments(text: string): string {
  return text
    .split(/\r?\n/)
    .map(line => (line.trimStart().startsWith('#') ? '' : line))
    .join('\n');
}

/** `add_header` lines of one block, as name → raw value (quotes and `always` included). */
function headersOf(block: string): Map<string, string> {
  const out = new Map<string, string>();
  for (const m of block.matchAll(/^\s*add_header\s+(\S+)\s+(.+);\s*$/gm)) out.set(m[1], m[2].trim());
  return out;
}

function parse(file: string) {
  const text = stripComments(readFileSync(path.join(DEPLOY_DIR, file), 'utf8'));
  const index = text.match(/^\s*location = \/index\.html \{([^}]*)\}/m);
  assert.ok(index, `${file}: location = /index.html not found`);
  // Server level = everything that is not inside a location block. Anchored to
  // the start of a line: "geolocation" in Permissions-Policy is not a block.
  const serverLevel = text.replace(/^\s*location\s[^{]*\{[^}]*\}/gm, '');
  return { text, server: headersOf(serverLevel), index: headersOf(index[1]) };
}

for (const file of CONFIGS) {
  test(`${file}: every security header is set at server level and again inside location = /index.html`, () => {
    const { server, index } = parse(file);
    for (const name of REQUIRED) {
      assert.ok(server.has(name), `${name} missing at server level`);
      assert.match(server.get(name)!, /\balways$/, `${name} must be sent on error responses too`);
      // A location with its own add_header inherits none from the server.
      assert.equal(index.get(name), server.get(name), `${name} differs inside location = /index.html`);
    }
    assert.equal(index.get('Cache-Control'), '"no-store" always');
  });

  test(`${file}: header values that other features depend on`, () => {
    const { text, server } = parse(file);
    // The single sign-on popup crosses to the identity provider and posts back.
    assert.equal(server.get('Cross-Origin-Opener-Policy'), '"same-origin-allow-popups" always');
    const permissions = server.get('Permissions-Policy')!;
    assert.match(permissions, /publickey-credentials-get=\(self\)/);
    assert.match(permissions, /publickey-credentials-create=\(self\)/);
    // The pdf.js worker is loaded from a blob: URL.
    assert.match(server.get('Content-Security-Policy-Report-Only')!, /worker-src 'self' blob:/);
    // HSTS only for requests that reached the edge over HTTPS.
    assert.equal(server.get('Strict-Transport-Security'), '$vibe_hsts always');
    assert.match(text, /map \$http_x_forwarded_proto \$vibe_hsts \{\s*default "";\s*https\s+"max-age=\d+";\s*\}/);
    // TLS ends upstream and the emergency port must stay on plain HTTP.
    assert.doesNotMatch(text, /return\s+30[1278]|rewrite\s+.*https:/);
  });
}

test('both nginx configs send the same security headers', () => {
  const [pi, docker] = CONFIGS.map(parse);
  assert.deepEqual([...pi.server], [...docker.server]);
  assert.deepEqual([...pi.index], [...docker.index]);
});
