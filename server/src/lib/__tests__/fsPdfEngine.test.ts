// Copyright 2025-2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Use is limited to qualifying small businesses. See LICENSE for terms.

/**
 * Where the Statement Writer finds its Chromium, and reading a logo's size.
 * Run: npx tsx --test src/lib/__tests__/fsPdfEngine.test.ts
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PDFDocument } from 'pdf-lib';
import { resolveChromiumPath } from '../fs/pdfBrowser';
import { imageInfoFromDataUri } from '../fs/imageSize';

const only = (...paths: string[]) => (p: string) => paths.includes(p);

test('precedence: the setting, then the environment, then the usual install locations', () => {
  const exists = only('/opt/chrome', '/env/chrome', '/usr/bin/chromium');
  assert.deepEqual(resolveChromiumPath({ setting: '/opt/chrome', env: '/env/chrome', platform: 'linux', exists }), { path: '/opt/chrome', source: 'setting' });
  assert.deepEqual(resolveChromiumPath({ setting: '', env: '/env/chrome', platform: 'linux', exists }), { path: '/env/chrome', source: 'env' });
  assert.deepEqual(resolveChromiumPath({ setting: null, env: null, platform: 'linux', exists }), { path: '/usr/bin/chromium', source: 'detected' });
});

test('the Alpine image path is probed before Debian\'s', () => {
  const exists = only('/usr/bin/chromium-browser', '/usr/bin/chromium');
  assert.equal(resolveChromiumPath({ platform: 'linux', exists })?.path, '/usr/bin/chromium-browser');
});

test('a configured path that is missing is NOT replaced by a detected browser', () => {
  // The admin named a browser. Printing with another one would hide the mistake.
  const exists = only('/usr/bin/chromium');
  assert.equal(resolveChromiumPath({ setting: '/opt/gone', platform: 'linux', exists }), null);
  assert.equal(resolveChromiumPath({ env: '/opt/gone', platform: 'linux', exists }), null);
});

test('nothing installed resolves to null rather than throwing', () => {
  assert.equal(resolveChromiumPath({ platform: 'linux', exists: () => false }), null);
  assert.equal(resolveChromiumPath({ platform: 'plan9', exists: () => true }), null);
});

test('whitespace around a configured path is ignored', () => {
  assert.equal(resolveChromiumPath({ setting: '  /opt/chrome \n', exists: only('/opt/chrome') })?.path, '/opt/chrome');
});

// 3×2 red PNG and a minimal baseline JPEG header (SOF0 5×7).
const PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAMAAAACCAIAAAASFvFNAAAAEklEQVR4nGP4z8DAwMDAwMAAAB4ABTa+0oMAAAAASUVORK5CYII=';
const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, ...new Array(14).fill(0), 0xff, 0xc0, 0x00, 0x11, 0x08, 0x00, 0x07, 0x00, 0x05, 0x03, ...new Array(9).fill(0)]);

test('logo dimensions are read from the PNG and JPEG headers', () => {
  const png = imageInfoFromDataUri(`data:image/png;base64,${PNG}`);
  assert.deepEqual([png?.width, png?.height, png?.type], [3, 2, 'png']);
  const jpg = imageInfoFromDataUri(`data:image/jpeg;base64,${JPEG.toString('base64')}`);
  assert.deepEqual([jpg?.width, jpg?.height, jpg?.type], [5, 7, 'jpg']);
  assert.equal(imageInfoFromDataUri('data:image/gif;base64,AAAA'), null);
  assert.equal(imageInfoFromDataUri(null), null);
});

test('the PNG bytes embed in pdf-lib (the full-bleed letterhead path)', async () => {
  const doc = await PDFDocument.create();
  const info = imageInfoFromDataUri(`data:image/png;base64,${PNG}`)!;
  const img = await doc.embedPng(info.bytes);
  assert.deepEqual([img.width, img.height], [3, 2]);
});
