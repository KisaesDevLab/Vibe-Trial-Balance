// Copyright 2025-2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Use is limited to qualifying small businesses. See LICENSE for terms.

// Run with: npm run test:reporturls (from the repo root)

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { withPreviewFlag, fsQuery } from '../reportUrls';

// What api/pdfReports.ts composes; that module cannot be imported here because
// it reads Vite's import.meta.env, which is why these helpers were split out.
const incomeStatement = (basis?: 'unadjusted' | 'book' | 'tax', group?: boolean) =>
  `/api/v1/reports/periods/2/income-statement${fsQuery(basis, group)}`;

/** Everything after the FIRST '?', which is what a server parses. Splitting on
 *  '?' instead would truncate at a stray second one and hide the corruption. */
const queryOf = (url: string): URLSearchParams =>
  new URLSearchParams(url.slice(url.indexOf('?') + 1));

const BASE = '/api/v1/reports/periods/2';

test('a bare report URL gets preview with a question mark', () => {
  assert.equal(withPreviewFlag(`${BASE}/aje-listing`), `${BASE}/aje-listing?preview=true`);
});

test('a URL that already has a query gets preview with an ampersand', () => {
  assert.equal(
    withPreviewFlag(`${BASE}/income-statement?basis=tax`),
    `${BASE}/income-statement?basis=tax&preview=true`,
  );
});

test('preview is never added twice', () => {
  const already = `${BASE}/flux/3?preview=true`;
  assert.equal(withPreviewFlag(already), already);
  // The flux report uses the same builder for downloads, where it is false.
  const off = `${BASE}/flux/3?preview=false`;
  assert.equal(withPreviewFlag(off), off, 'must not flip a deliberate preview=false');
});

test('preview is recognised wherever it sits in the query', () => {
  const mid = `${BASE}/trial-balance?preview=true&columns=a,b`;
  assert.equal(withPreviewFlag(mid), mid);
  const end = `${BASE}/tax-code-report?columns=book&preview=true`;
  assert.equal(withPreviewFlag(end), end);
});

test('a parameter merely CONTAINING "preview" is not mistaken for the flag', () => {
  const url = `${BASE}/x?notpreview=true`;
  assert.equal(withPreviewFlag(url), `${url}&preview=true`);
});

// ── The regression this was written for ─────────────────────────────────────

test('the grouped statement survives preview', () => {
  // What the Financial Statements page builds with grouping switched on.
  const url = incomeStatement('book', true);
  const previewed = withPreviewFlag(url);

  const params = queryOf(previewed);
  assert.equal(params.get('groupByLeadSheet'), 'true', 'grouping must reach the server');
  assert.equal(params.get('basis'), 'book');
  assert.equal(params.get('preview'), 'true');

  // The old bug: appending '?preview=true' to a URL that already had a query
  // swallowed the last value, so the server saw "true?preview=true" and,
  // matching neither 'true' nor '1', silently dropped the grouping.
  const broken = queryOf(url + '?preview=true');
  assert.equal(broken.get('groupByLeadSheet'), 'true?preview=true');
  assert.notEqual(broken.get('groupByLeadSheet'), 'true');
});

test('the basis survives preview too — it did not before', () => {
  const previewed = withPreviewFlag(incomeStatement('tax'));
  assert.equal(queryOf(previewed).get('basis'), 'tax');

  // Previously this arrived as "tax?preview=true", which the server's parser
  // mapped to its 'book' fallback — a preview of the Tax Adjusted statement
  // quietly showed book-adjusted figures.
  const broken = queryOf(incomeStatement('tax') + '?preview=true');
  assert.notEqual(broken.get('basis'), 'tax');
});
