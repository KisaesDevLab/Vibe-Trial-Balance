// Copyright 2025-2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Use is limited to qualifying small businesses. See LICENSE for terms.

// Run with: npm run test:reportfilename (from the repo root)

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { engagementFilename, safeFilePart } from '../reportFilename';

test('period, client, report — and nothing after the report name', () => {
  assert.equal(
    engagementFilename('FY2024', 'Acme Holdings LLC', 'general-ledger.xlsx'),
    'FY2024_Acme Holdings LLC_general-ledger.xlsx',
  );
});

test('a client name a firm would actually type stays readable', () => {
  assert.equal(
    engagementFilename('FY2024', 'Smith & Co., Inc.', 'trial-balance-report.xlsx'),
    'FY2024_Smith & Co., Inc_trial-balance-report.xlsx',
  );
});

test('path separators and control characters never reach a filename', () => {
  assert.equal(safeFilePart('FY 2024/2025'), 'FY 2024 2025');
  assert.equal(safeFilePart('C:\\Books\\Acme'), 'C Books Acme');
  assert.equal(safeFilePart('  spaced   out  '), 'spaced out');
});

test('a missing period or client just drops out of the prefix', () => {
  assert.equal(engagementFilename(null, 'Acme', 'x.xlsx'), 'Acme_x.xlsx');
  assert.equal(engagementFilename('FY2024', undefined, 'x.xlsx'), 'FY2024_x.xlsx');
  assert.equal(engagementFilename(null, undefined, 'x.xlsx'), 'x.xlsx');
});
