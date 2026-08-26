// Copyright 2025-2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Use is limited to qualifying small businesses. See LICENSE for terms.

/**
 * Report PDF naming. Run: npx tsx --test src/lib/__tests__/reportFilename.test.ts
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { safeFilePart, engagementFilename, pdfDisposition } from '../reportFilename';

test('the engagement leads the filename', () => {
  assert.equal(
    engagementFilename('FY2024', 'Acme Holdings LLC', 'trial-balance-12.pdf'),
    'FY2024_Acme Holdings LLC_trial-balance-12.pdf',
  );
});

test('a client name a firm would actually type stays readable', () => {
  assert.equal(
    engagementFilename('FY2024', 'Smith & Co., Inc.', 'balance-sheet-3.pdf'),
    'FY2024_Smith & Co., Inc_balance-sheet-3.pdf',
  );
});

test('path separators and control characters never reach a filename', () => {
  assert.equal(safeFilePart('FY 2024/2025'), 'FY 2024 2025');
  assert.equal(safeFilePart('C:\\Books\\Acme'), 'C Books Acme');
  assert.equal(safeFilePart('Acme\r\nHoldings'), 'Acme Holdings');
  assert.equal(safeFilePart('  spaced   out  '), 'spaced out');
});

test('a missing period or client just drops out of the prefix', () => {
  assert.equal(engagementFilename(null, 'Acme', 'x.pdf'), 'Acme_x.pdf');
  assert.equal(engagementFilename('FY2024', '   ', 'x.pdf'), 'FY2024_x.pdf');
  assert.equal(engagementFilename(null, undefined, 'x.pdf'), 'x.pdf');
});

test('the header carries an ASCII fallback and the encoded name', () => {
  const header = pdfDisposition('FY2024_Café Ltée_trial-balance-9.pdf', false);
  assert.match(header, /^attachment; /);
  assert.match(header, /filename="FY2024_Caf_ Lt_e_trial-balance-9\.pdf"/);
  assert.match(header, /filename\*=UTF-8''/);
  const encoded = /filename\*=UTF-8''(.+)$/.exec(header)![1];
  assert.equal(decodeURIComponent(encoded), 'FY2024_Café Ltée_trial-balance-9.pdf');
});

test('preview renders in the tab instead of downloading', () => {
  assert.match(pdfDisposition('FY2024_Acme_x.pdf', true), /^inline; /);
});
