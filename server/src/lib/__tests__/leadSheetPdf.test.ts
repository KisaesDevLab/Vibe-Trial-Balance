// Copyright 2025-2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Use is limited to qualifying small businesses. See LICENSE for terms.

/**
 * Tickmark stamping and image conversion.
 * Run: npx tsx --test src/lib/__tests__/leadSheetPdf.test.ts
 *
 * No DB and no network — pure pdf-lib work.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PDFDocument, StandardFonts } from 'pdf-lib';
import { burnAnnotation, imageToPdf, isConvertibleImage, pdfPageCount } from '../leadSheetPdf';

/** The first tickmark this app seeds. */
const CHECK = '✓';
/** WinAnsi 0x86 — encodable by the standard fonts. */
const DAGGER = '†';

async function blankPdf(pages = 1): Promise<Buffer> {
  const doc = await PDFDocument.create();
  for (let i = 0; i < pages; i++) doc.addPage([612, 792]);
  return Buffer.from(await doc.save());
}

function annotation(over: Partial<Parameters<typeof burnAnnotation>[1]> = {}) {
  return {
    id: 'a1', page: 1, xPct: 0.25, yPct: 0.25,
    symbol: CHECK, color: 'green', note: null,
    ...over,
  } as Parameters<typeof burnAnnotation>[1];
}

// ── The reason fontkit is a dependency ───────────────────────────────────────

test("pdf-lib's standard fonts cannot encode the seeded check tickmark", async () => {
  // This is why the stamper embeds a real TTF via fontkit. If this test ever
  // starts passing, the workaround could be revisited — but until then,
  // switching to StandardFonts would throw on the most-used tickmark.
  const doc = await PDFDocument.create();
  const page = doc.addPage([612, 792]);
  const font = await doc.embedFont(StandardFonts.HelveticaBold);
  assert.throws(() => page.drawText(CHECK, { x: 10, y: 10, size: 16, font }));
  // The dagger is fine, which is why a naive test would miss this.
  assert.doesNotThrow(() => page.drawText(DAGGER, { x: 10, y: 30, size: 16, font }));
});

test('burnAnnotation renders the check tickmark without throwing', async () => {
  const out = await burnAnnotation(await blankPdf(), annotation());
  assert.ok(out.length > 0);
  assert.equal(out.subarray(0, 5).toString('latin1'), '%PDF-');
});

test('burnAnnotation renders the dagger too', async () => {
  const out = await burnAnnotation(await blankPdf(), annotation({ symbol: DAGGER, color: 'red' }));
  assert.equal(out.subarray(0, 5).toString('latin1'), '%PDF-');
});

// ── Stamping behaviour ───────────────────────────────────────────────────────

test('stamping changes the bytes and preserves the page count', async () => {
  const original = await blankPdf(3);
  const stamped = await burnAnnotation(original, annotation({ page: 2 }));
  assert.notEqual(stamped.toString('base64'), original.toString('base64'));
  assert.equal(await pdfPageCount(stamped), 3);
});

test('an out-of-range page is clamped rather than throwing', async () => {
  // The route validates the page first; this is the last line of defence.
  const out = await burnAnnotation(await blankPdf(2), annotation({ page: 99 }));
  assert.equal(await pdfPageCount(out), 2);
});

test('out-of-range coordinates are clamped to the page', async () => {
  const out = await burnAnnotation(await blankPdf(), annotation({ xPct: 5, yPct: -3 }));
  assert.equal(out.subarray(0, 5).toString('latin1'), '%PDF-');
});

test('an unknown colour falls back instead of failing', async () => {
  const out = await burnAnnotation(await blankPdf(), annotation({ color: 'chartreuse' }));
  assert.equal(out.subarray(0, 5).toString('latin1'), '%PDF-');
});

test('a long note is accepted and truncated', async () => {
  const out = await burnAnnotation(await blankPdf(), annotation({ note: 'x'.repeat(500) }));
  assert.equal(out.subarray(0, 5).toString('latin1'), '%PDF-');
});

test('stamping twice accumulates rather than replacing', async () => {
  const once = await burnAnnotation(await blankPdf(), annotation());
  const twice = await burnAnnotation(once, annotation({ id: 'a2', symbol: DAGGER, xPct: 0.6 }));
  // Re-saving a vector PDF is lossless, so the second pass only adds content.
  assert.ok(twice.length >= once.length);
  assert.equal(await pdfPageCount(twice), 1);
});

// ── Image conversion ─────────────────────────────────────────────────────────

// A 2x2 PNG.
const PNG_2X2 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAFElEQVR42mP8z8BQz0AEYBxVSF+FABJADveWkH6oAAAAAElFTkSuQmCC',
  'base64',
);

test('isConvertibleImage accepts PNG and JPEG only', () => {
  assert.equal(isConvertibleImage('image/png'), true);
  assert.equal(isConvertibleImage('image/jpeg'), true);
  assert.equal(isConvertibleImage('application/pdf'), false);
  assert.equal(isConvertibleImage('image/gif'), false);
});

test('a PNG becomes a one-page PDF', async () => {
  // Preparers photograph receipts; converting on upload keeps every attachment
  // stampable, ref-coded and mergeable into the binder.
  const pdf = await imageToPdf(PNG_2X2, 'image/png');
  assert.equal(pdf.subarray(0, 5).toString('latin1'), '%PDF-');
  assert.equal(await pdfPageCount(pdf), 1);
});

test('a converted image can then be stamped like any other attachment', async () => {
  const pdf = await imageToPdf(PNG_2X2, 'image/png');
  const stamped = await burnAnnotation(pdf, annotation());
  assert.equal(stamped.subarray(0, 5).toString('latin1'), '%PDF-');
});
