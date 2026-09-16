// Copyright 2025-2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Use is limited to qualifying small businesses. See LICENSE for terms.

/**
 * Query-string parsing and the knex modifiers behind `GET /storage/links`
 * (the Client folders table on the Storage settings page).
 *
 * Pure so the parsing and the generated SQL can be pinned by a test without
 * a database. The route composes these onto its own base query.
 */

import type { Knex } from 'knex';

export const LINK_STATUS_FILTERS = ['all', 'unlinked', 'attention', 'active'] as const;
export type LinkStatusFilter = (typeof LINK_STATUS_FILTERS)[number];

export const DEFAULT_LINKS_PAGE_SIZE = 25;
export const MAX_LINKS_PAGE_SIZE = 200;
/** A search longer than this cannot match anything a client row holds. */
export const MAX_SEARCH_LENGTH = 200;

export interface ClientLinksQuery {
  /** 1-based. */
  page: number;
  limit: number;
  /** Trimmed; empty string means no search. */
  search: string;
  status: LinkStatusFilter;
}

function toInt(v: unknown): number | null {
  if (typeof v !== 'string' && typeof v !== 'number') return null;
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : null;
}

/** Tolerant: anything malformed falls back to the default rather than 400ing. */
export function parseClientLinksQuery(q: Record<string, unknown>): ClientLinksQuery {
  const page = Math.max(1, toInt(q.page) ?? 1);
  const limit = Math.min(MAX_LINKS_PAGE_SIZE, Math.max(1, toInt(q.limit) ?? DEFAULT_LINKS_PAGE_SIZE));
  const search = typeof q.search === 'string' ? q.search.trim().slice(0, MAX_SEARCH_LENGTH) : '';
  // `?status=a&status=b` arrives as an array; only a plain string qualifies.
  const status = typeof q.status === 'string' && (LINK_STATUS_FILTERS as readonly string[]).includes(q.status)
    ? (q.status as LinkStatusFilter)
    : 'all';
  return { page, limit, search, status };
}

/** Postgres LIKE/ILIKE escape (default escape character is backslash). */
export function escapeLike(s: string): string {
  return s.replace(/[\\%_]/g, '\\$&');
}

export function likePattern(search: string): string {
  return `%${escapeLike(search)}%`;
}

/**
 * Knex modifier: a contains-match on client name, client code and the linked
 * folder path. Expects the aliases `c` (clients) and `l` (client_folder_links)
 * from the route's base query. A no-op for an empty search.
 */
export function whereLinkSearch(qb: Knex.QueryBuilder, search: string): void {
  if (!search) return;
  const pattern = likePattern(search);
  qb.where((b) => {
    b.where('c.name', 'ilike', pattern)
      .orWhere('c.client_code', 'ilike', pattern)
      .orWhere('l.storage_path', 'ilike', pattern);
  });
}

/**
 * Knex modifier for the status dropdown. `attention` is a link whose last
 * verify was not clean (missing/conflict); a legacy layout is NOT attention —
 * it works, it just predates the sentinel scheme.
 */
export function whereLinkStatus(qb: Knex.QueryBuilder, status: LinkStatusFilter): void {
  switch (status) {
    case 'unlinked':
      qb.whereNull('l.id');
      break;
    case 'attention':
      qb.whereNotNull('l.id').whereNot('l.status', 'active');
      break;
    case 'active':
      qb.where('l.status', 'active');
      break;
    case 'all':
    default:
      break;
  }
}

/** Problems first, then legacy layouts, then the rest, alphabetical within each. */
export const LINKS_ORDER_SQL = `
  CASE
    WHEN l.id IS NULL THEN 0
    WHEN l.status <> 'active' THEN 1
    WHEN l.is_legacy_layout THEN 2
    ELSE 3
  END, c.name ASC
`;

/** Whole-firm counts for the section header — never narrowed by search/status. */
export const LINK_COUNTS_SQL = `
  COUNT(*)::int AS all,
  COUNT(*) FILTER (WHERE l.id IS NULL)::int AS unlinked,
  COUNT(*) FILTER (WHERE l.id IS NOT NULL AND l.status <> 'active')::int AS attention,
  COUNT(*) FILTER (WHERE l.status = 'active')::int AS active
`;

export interface LinkCounts {
  all: number;
  unlinked: number;
  attention: number;
  active: number;
}
