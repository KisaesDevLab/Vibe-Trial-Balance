// Copyright 2025-2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Use is limited to qualifying small businesses. See LICENSE for terms.

/**
 * Reclassifying entries (RJEs): labels, the type-change rule, and dormancy.
 * Run: npx tsx --test src/lib/__tests__/journalEntryTypes.test.ts
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bookAjeHeading, entryRef, hasReclass, typeChangeRefusal } from '../journalEntryTypes';
import { hasReportableActivity } from '../tbActivity';

test('entry references: RJE-n for a reclass, the GL prefixes otherwise', () => {
  assert.equal(entryRef('reclass', 2), 'RJE-2');
  assert.equal(entryRef('book', 3), 'BOOK-3');
  assert.equal(entryRef('tax', 1), 'TAX-1');
  assert.equal(entryRef('trans', 14), 'TRANS-14');
});

test('an entry never changes to or from reclass; book and tax still swap', () => {
  assert.match(typeChangeRefusal('reclass', 'book') ?? '', /numbered on their own/);
  assert.match(typeChangeRefusal('tax', 'reclass') ?? '', /numbered on their own/);
  assert.equal(typeChangeRefusal('book', 'tax'), null);
  assert.equal(typeChangeRefusal('reclass', 'reclass'), null);
  assert.equal(typeChangeRefusal('reclass', undefined), null);
});

test('the book AJE heading names reclasses only when there are any', () => {
  assert.equal(bookAjeHeading(false), 'Book AJEs');
  assert.equal(bookAjeHeading(true), 'Book AJEs & reclasses');
  assert.equal(hasReclass({ reclass_adj_debit: '0', reclass_adj_credit: 0 }), false);
  assert.equal(hasReclass({ reclass_adj_credit: '250' }), true);
});

test('an account whose only activity is a reclass is not dormant', () => {
  assert.equal(hasReportableActivity({ unadjusted_debit: 0 }), false);
  assert.equal(hasReportableActivity({ unadjusted_debit: 0, reclass_adj_debit: 250 }), true);
});
