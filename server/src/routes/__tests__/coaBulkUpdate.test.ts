// Copyright 2025-2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Use is limited to qualifying small businesses. See LICENSE for terms.

/**
 * Chart of accounts bulk edit — the column mapper behind
 * POST /clients/:id/chart-of-accounts/bulk-update. The guarantee under test
 * is that an unticked field is never touched, a ticked-but-empty text field
 * clears, and the tax code / lead sheet writes carry the same side columns
 * the single-account PATCH writes.
 * Run: npx tsx --test src/routes/__tests__/coaBulkUpdate.test.ts
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

process.env.JWT_SECRET ??= 'test'.repeat(16);
const { bulkUpdateColumns } = require('../chartOfAccounts') as typeof import('../chartOfAccounts');

test('only the keys present in the body become columns', () => {
  assert.deepEqual(bulkUpdateColumns({ category: 'expenses' }, null), { category: 'expenses' });
  assert.deepEqual(
    bulkUpdateColumns({ category: 'expenses', normalBalance: 'debit' }, null),
    { category: 'expenses', normal_balance: 'debit' },
  );
});

test('an empty string clears a text field, same as null', () => {
  assert.deepEqual(bulkUpdateColumns({ subcategory: '' }, null), { subcategory: null });
  assert.deepEqual(bulkUpdateColumns({ unit: null }, null), { unit: null });
  assert.deepEqual(bulkUpdateColumns({ workpaperRef: 'A-1' }, null), { workpaper_ref: 'A-1' });
});

test('a tax code dual-writes tax_line and marks the source manual', () => {
  assert.deepEqual(
    bulkUpdateColumns({ taxCodeId: 42 }, '1120S-L1a'),
    { tax_code_id: 42, tax_line: '1120S-L1a', tax_line_source: 'manual' },
  );
  assert.deepEqual(bulkUpdateColumns({ taxCodeId: null }, null), { tax_code_id: null, tax_line: null });
});

test('a lead sheet write records provenance; clearing it clears the provenance', () => {
  assert.deepEqual(bulkUpdateColumns({ leadSheetId: 7 }, null), { lead_sheet_id: 7, lead_sheet_source: 'manual' });
  assert.deepEqual(bulkUpdateColumns({ leadSheetId: null }, null), { lead_sheet_id: null, lead_sheet_source: null });
});
