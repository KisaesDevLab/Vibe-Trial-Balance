// Copyright 2025-2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Use is limited to qualifying small businesses. See LICENSE for terms.

/**
 * Paging / search / status filter behind GET /storage/links.
 * Run: npx tsx --test src/lib/__tests__/clientLinksQuery.test.ts
 *
 * The SQL assertions build against a connection-less pg query builder, so
 * they pin the generated WHERE clauses without a database.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import knex from 'knex';
import {
  DEFAULT_LINKS_PAGE_SIZE,
  MAX_LINKS_PAGE_SIZE,
  MAX_SEARCH_LENGTH,
  escapeLike,
  likePattern,
  parseClientLinksQuery,
  whereLinkSearch,
  whereLinkStatus,
} from '../clientLinksQuery';

const pg = knex({ client: 'pg' });
const base = () => pg('clients as c').leftJoin('client_folder_links as l', 'l.client_id', 'c.id');

test('parseClientLinksQuery: defaults, clamps and tolerates junk', () => {
  assert.deepEqual(parseClientLinksQuery({}), { page: 1, limit: DEFAULT_LINKS_PAGE_SIZE, search: '', status: 'all' });
  assert.deepEqual(
    parseClientLinksQuery({ page: '3', limit: '50', search: '  Black ', status: 'unlinked' }),
    { page: 3, limit: 50, search: 'Black', status: 'unlinked' },
  );
  // Out-of-range and malformed values fall back rather than 400ing.
  assert.equal(parseClientLinksQuery({ page: '0' }).page, 1);
  assert.equal(parseClientLinksQuery({ page: '-4' }).page, 1);
  assert.equal(parseClientLinksQuery({ page: 'abc' }).page, 1);
  assert.equal(parseClientLinksQuery({ page: '2.9' }).page, 2);
  assert.equal(parseClientLinksQuery({ limit: '0' }).limit, 1);
  assert.equal(parseClientLinksQuery({ limit: '9999' }).limit, MAX_LINKS_PAGE_SIZE);
  assert.equal(parseClientLinksQuery({ status: 'bogus' }).status, 'all');
  assert.equal(parseClientLinksQuery({ status: ['unlinked'] }).status, 'all');
  assert.equal(parseClientLinksQuery({ search: ['a', 'b'] }).search, '');
  assert.equal(parseClientLinksQuery({ search: 'x'.repeat(MAX_SEARCH_LENGTH + 50) }).search.length, MAX_SEARCH_LENGTH);
});

test('escapeLike neutralises LIKE metacharacters so "100%" matches literally', () => {
  assert.equal(escapeLike('100%'), '100\\%');
  assert.equal(escapeLike('a_b'), 'a\\_b');
  assert.equal(escapeLike('back\\slash'), 'back\\\\slash');
  assert.equal(likePattern('Jack Black'), '%Jack Black%');
});

test('whereLinkSearch matches name, code and folder path; no-op when empty', () => {
  const q = base().modify(whereLinkSearch, 'black');
  const sql = q.toSQL();
  assert.match(sql.sql, /"c"\."name" ilike \?/);
  assert.match(sql.sql, /"c"\."client_code" ilike \?/);
  assert.match(sql.sql, /"l"\."storage_path" ilike \?/);
  // The three are OR'd inside one group so a later AND (status) applies to all.
  assert.match(sql.sql, /where \(.*or.*or.*\)/);
  assert.deepEqual(sql.bindings, ['%black%', '%black%', '%black%']);

  const untouched = base().modify(whereLinkSearch, '');
  assert.doesNotMatch(untouched.toSQL().sql, /where/);
});

test('whereLinkStatus: unlinked / attention / active / all', () => {
  assert.match(base().modify(whereLinkStatus, 'unlinked').toSQL().sql, /where "l"\."id" is null$/);
  const attention = base().modify(whereLinkStatus, 'attention').toSQL();
  assert.match(attention.sql, /"l"\."id" is not null and not "l"\."status" = \?/);
  assert.deepEqual(attention.bindings, ['active']);
  const active = base().modify(whereLinkStatus, 'active').toSQL();
  assert.match(active.sql, /where "l"\."status" = \?$/);
  assert.deepEqual(active.bindings, ['active']);
  assert.doesNotMatch(base().modify(whereLinkStatus, 'all').toSQL().sql, /where/);
});

test('search and status compose as AND', () => {
  const sql = base().modify(whereLinkSearch, 'llc').modify(whereLinkStatus, 'unlinked').toSQL();
  assert.match(sql.sql, /where \(.*\) and "l"\."id" is null$/);
});
