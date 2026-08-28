// Copyright 2025-2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Use is limited to qualifying small businesses. See LICENSE for terms.

/**
 * Storage path primitives + the fiscal-year key scheme.
 * Run: npx tsx --test src/lib/__tests__/storageKeys.test.ts
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  joinPath,
  normalizeTopPrefix,
  sanitizeForWindows,
  enforceKeyByteCap,
  resolveCollision,
  folderBasename,
  MAX_BASENAME_BYTES,
  MAX_KEY_BYTES,
} from '../storage/paths';
import {
  clientFolderName,
  fiscalYearFolder,
  buildDocumentKey,
  buildUniqueDocumentKey,
  clientFolderPath,
} from '../storage/keys';

// ── joinPath ─────────────────────────────────────────────────────────────────

test('joinPath normalises separators and collapses slashes', () => {
  assert.equal(joinPath('a', 'b', 'c.pdf'), 'a/b/c.pdf');
  assert.equal(joinPath('a/', '/b/', '/c.pdf'), 'a/b/c.pdf');
  assert.equal(joinPath('a\\b', 'c.pdf'), 'a/b/c.pdf');
  assert.equal(joinPath('a//b', 'c.pdf'), 'a/b/c.pdf');
  assert.equal(joinPath('', 'b'), 'b');
  assert.equal(joinPath(), '');
});

test('joinPath keeps a trailing slash only when the last segment has one', () => {
  assert.equal(joinPath('a', 'b/'), 'a/b/');
  assert.equal(joinPath('a', 'b'), 'a/b');
});

test('normalizeTopPrefix gives empty or exactly one trailing slash', () => {
  assert.equal(normalizeTopPrefix(undefined), '');
  assert.equal(normalizeTopPrefix(''), '');
  assert.equal(normalizeTopPrefix('vibe-tb'), 'vibe-tb/');
  assert.equal(normalizeTopPrefix('/vibe-tb/'), 'vibe-tb/');
});

test('folderBasename ignores the prefix', () => {
  assert.equal(folderBasename('vibe-tb/Acme (12)/'), 'Acme (12)');
  assert.equal(folderBasename('Acme (12)'), 'Acme (12)');
});

// ── sanitizeForWindows ───────────────────────────────────────────────────────

test('sanitizeForWindows strips characters Explorer refuses', () => {
  assert.equal(sanitizeForWindows('a<b>c:d"e|f?g*h'), 'a_b_c_d_e_f_g_h');
  assert.equal(sanitizeForWindows('a/b\\c'), 'a_b_c');
  assert.equal(sanitizeForWindows('tab\there'), 'tabhere');
});

test('sanitizeForWindows trims trailing dots and spaces', () => {
  assert.equal(sanitizeForWindows('report.  '), 'report');
  assert.equal(sanitizeForWindows('report...'), 'report');
});

test('sanitizeForWindows escapes reserved device names but not lookalikes', () => {
  assert.equal(sanitizeForWindows('NUL'), '_NUL');
  assert.equal(sanitizeForWindows('nul.pdf'), '_nul.pdf');
  assert.equal(sanitizeForWindows('COM1.txt'), '_COM1.txt');
  // Must not fire on a name that merely contains one.
  assert.equal(sanitizeForWindows('ANNUAL.pdf'), 'ANNUAL.pdf');
  assert.equal(sanitizeForWindows('CONSULTING.pdf'), 'CONSULTING.pdf');
});

test('sanitizeForWindows never returns empty', () => {
  assert.equal(sanitizeForWindows(''), '_');
  assert.equal(sanitizeForWindows('...'), '_');
});

test('sanitizeForWindows truncates a long name but keeps the extension', () => {
  const out = sanitizeForWindows('x'.repeat(400) + '.pdf');
  assert.ok(Buffer.byteLength(out, 'utf8') <= MAX_BASENAME_BYTES);
  assert.ok(out.endsWith('.pdf'), 'extension preserved');
});

// ── enforceKeyByteCap ────────────────────────────────────────────────────────

test('enforceKeyByteCap leaves a short key alone and caps a long one', () => {
  assert.equal(enforceKeyByteCap('a/b.pdf'), 'a/b.pdf');
  const long = 'dir/' + 'y'.repeat(2000) + '.pdf';
  const capped = enforceKeyByteCap(long);
  assert.ok(Buffer.byteLength(capped, 'utf8') <= MAX_KEY_BYTES);
  assert.ok(capped.startsWith('dir/') && capped.endsWith('.pdf'));
});

// ── resolveCollision ─────────────────────────────────────────────────────────

test('resolveCollision appends " (2)" before the extension', async () => {
  const taken = new Set(['a/b.pdf']);
  assert.equal(await resolveCollision('a/b.pdf', async (k) => taken.has(k)), 'a/b (2).pdf');
});

test('resolveCollision keeps counting past the first free slot', async () => {
  const taken = new Set(['a/b.pdf', 'a/b (2).pdf', 'a/b (3).pdf']);
  assert.equal(await resolveCollision('a/b.pdf', async (k) => taken.has(k)), 'a/b (4).pdf');
});

test('resolveCollision returns the desired key when it is free', async () => {
  assert.equal(await resolveCollision('a/b.pdf', async () => false), 'a/b.pdf');
});

// ── client folder ────────────────────────────────────────────────────────────

test('the client folder carries the id, because names are not unique', () => {
  // clients.name has no unique index — two clients may share a name, and the
  // id is the only stable disambiguator.
  assert.equal(clientFolderName({ id: 12, name: 'Acme Holdings, LLC' }), 'Acme Holdings, LLC (12)');
  assert.equal(clientFolderName({ id: 7, name: 'Acme Holdings, LLC' }), 'Acme Holdings, LLC (7)');
  assert.notEqual(
    clientFolderName({ id: 12, name: 'Same Name' }),
    clientFolderName({ id: 13, name: 'Same Name' }),
  );
});

test('a client name with forbidden characters still yields a usable folder', () => {
  assert.equal(clientFolderName({ id: 3, name: 'A/B: "C"' }), 'A_B_ _C_ (3)');
});

// ── fiscal year ──────────────────────────────────────────────────────────────

test('a calendar-year client takes the end_date year', () => {
  assert.equal(fiscalYearFolder({ endDate: '2024-12-31', taxYearEnd: '12-31' }), 'FY2024');
  assert.equal(fiscalYearFolder({ endDate: '2024-07-31', taxYearEnd: '12-31' }), 'FY2024');
});

test('a non-calendar year end rolls a later period into the next FY', () => {
  // The case a naive year(end_date) gets wrong: FYE 06-30 means a period
  // ending 2024-12-31 belongs to FY2025.
  assert.equal(fiscalYearFolder({ endDate: '2025-06-30', taxYearEnd: '06-30' }), 'FY2025');
  assert.equal(fiscalYearFolder({ endDate: '2024-12-31', taxYearEnd: '06-30' }), 'FY2025');
  assert.equal(fiscalYearFolder({ endDate: '2024-03-31', taxYearEnd: '06-30' }), 'FY2024');
  // Exactly on the year end stays in that year.
  assert.equal(fiscalYearFolder({ endDate: '2024-06-30', taxYearEnd: '06-30' }), 'FY2024');
});

test('a missing or malformed tax_year_end degrades to the calendar year', () => {
  assert.equal(fiscalYearFolder({ endDate: '2024-12-31' }), 'FY2024');
  assert.equal(fiscalYearFolder({ endDate: '2024-12-31', taxYearEnd: '' }), 'FY2024');
  assert.equal(fiscalYearFolder({ endDate: '2024-12-31', taxYearEnd: 'junk' }), 'FY2024');
  assert.equal(fiscalYearFolder({ endDate: '2024-12-31', taxYearEnd: '13-45' }), 'FY2024');
});

test('the fiscal year never comes from period_name when a date exists', () => {
  // period_name is free text a user can rename; a rename must not move files.
  assert.equal(fiscalYearFolder({ endDate: '2024-12-31', periodName: 'FY2019' }), 'FY2024');
});

test('a Date at local midnight is not shifted a day by timezone', () => {
  // node-pg materialises a Postgres `date` as a Date at LOCAL midnight. Reading
  // it back with getUTC* moves it a day earlier anywhere east of UTC, so a
  // 2024-07-01 period end would read as 6/30 and a 06-30 year end would file
  // the documents under the wrong FY.
  const julyFirst = new Date(2024, 6, 1); // local midnight, 1 July 2024
  assert.equal(fiscalYearFolder({ endDate: julyFirst, taxYearEnd: '06-30' }), 'FY2025');
  const juneThirtieth = new Date(2024, 5, 30);
  assert.equal(fiscalYearFolder({ endDate: juneThirtieth, taxYearEnd: '06-30' }), 'FY2024');
  // A plain YYYY-MM-DD string is read textually, never via Date.
  assert.equal(fiscalYearFolder({ endDate: '2024-07-01', taxYearEnd: '06-30' }), 'FY2025');
  assert.equal(fiscalYearFolder({ endDate: '2024-01-01', taxYearEnd: '12-31' }), 'FY2024');
});

test('period_name is the last resort, then FY-unknown', () => {
  assert.equal(fiscalYearFolder({ endDate: null, periodName: 'FY2022 final' }), 'FY2022');
  assert.equal(fiscalYearFolder({ endDate: null, startDate: '2021-01-01' }), 'FY2021');
  assert.equal(fiscalYearFolder({ endDate: null, periodName: 'no year here' }), 'FY-unknown');
  assert.equal(fiscalYearFolder({ endDate: null }), 'FY-unknown');
});

// ── full key ─────────────────────────────────────────────────────────────────

const CLIENT = { id: 12, name: 'Acme Holdings, LLC' };

test('the key is prefix / client / section / FY / filename', () => {
  assert.equal(
    buildDocumentKey({
      prefix: 'vibe-tb',
      client: CLIENT,
      section: 'Support',
      fiscalYear: 'FY2024',
      filename: '2024 Q4 Bank Stmt.pdf',
    }),
    'vibe-tb/Acme Holdings, LLC (12)/Support/FY2024/2024 Q4 Bank Stmt.pdf',
  );
});

test('a subfolder adds one tier inside the year', () => {
  assert.equal(
    buildDocumentKey({
      prefix: 'vibe-tb',
      client: CLIENT,
      section: 'Workpapers',
      fiscalYear: 'FY2024',
      subfolder: 'Lead Sheets',
      filename: 'A001.pdf',
    }),
    'vibe-tb/Acme Holdings, LLC (12)/Workpapers/FY2024/Lead Sheets/A001.pdf',
  );
});

test('an empty prefix drops the leading segment cleanly', () => {
  assert.equal(
    buildDocumentKey({ client: CLIENT, section: 'Support', fiscalYear: 'FY2024', filename: 'x.pdf' }),
    'Acme Holdings, LLC (12)/Support/FY2024/x.pdf',
  );
});

test('the original filename is preserved, not replaced with a blob name', () => {
  const key = buildDocumentKey({
    client: CLIENT, section: 'Support', fiscalYear: 'FY2024',
    filename: '2024 Q4 Bank Stmt.pdf',
  });
  assert.ok(key.endsWith('/2024 Q4 Bank Stmt.pdf'));
});

test('a filename that would break a path is sanitised, not rejected', () => {
  const key = buildDocumentKey({
    client: CLIENT, section: 'Support', fiscalYear: 'FY2024',
    filename: 'a/b:c.pdf',
  });
  assert.ok(key.endsWith('/a_b_c.pdf'), key);
});

test('buildUniqueDocumentKey resolves a collision', async () => {
  const base = 'Acme Holdings, LLC (12)/Support/FY2024/dup.pdf';
  const taken = new Set([base]);
  const key = await buildUniqueDocumentKey(
    { client: CLIENT, section: 'Support', fiscalYear: 'FY2024', filename: 'dup.pdf' },
    async (k) => taken.has(k),
  );
  assert.equal(key, 'Acme Holdings, LLC (12)/Support/FY2024/dup (2).pdf');
});

test('clientFolderPath ends with a slash', () => {
  assert.equal(clientFolderPath('vibe-tb', CLIENT), 'vibe-tb/Acme Holdings, LLC (12)/');
  assert.equal(clientFolderPath(undefined, CLIENT), 'Acme Holdings, LLC (12)/');
});
