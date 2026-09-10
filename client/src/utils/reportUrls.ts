// Copyright 2025-2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Use is limited to qualifying small businesses. See LICENSE for terms.

/**
 * Query-string building for the report endpoints.
 *
 * Kept apart from `api/pdfReports.ts` because that module reads Vite's
 * `import.meta.env`, which makes it unloadable outside a browser build — and
 * this is exactly the logic that needs unit tests. Pure strings, no imports.
 */

export type FsPdfBasis = 'unadjusted' | 'book' | 'tax';

/** The query string for a financial statement, or '' when nothing is set. */
export function fsQuery(basis?: FsPdfBasis, groupByLeadSheet?: boolean): string {
  const parts: string[] = [];
  if (basis) parts.push(`basis=${basis}`);
  if (groupByLeadSheet) parts.push('groupByLeadSheet=true');
  return parts.length > 0 ? `?${parts.join('&')}` : '';
}

/**
 * Add `preview=true` with the RIGHT separator, and only if it is not there yet.
 *
 * Call sites used to append `'?preview=true'` by hand. Harmless while every
 * report URL was bare, but a builder carrying its own query string produced
 * `...?basis=book&groupByLeadSheet=true?preview=true` — a second '?' inside a
 * value — so the last parameter arrived as `true?preview=true` and was silently
 * dropped. That is how the Financial Statements preview lost its lead sheet
 * grouping; before grouping existed, the same bug had been quietly falling back
 * to book-adjusted whenever the page asked for Unadjusted or Tax.
 *
 * Owning it in one place means no call site can get the separator wrong again.
 * The already-present check protects builders that set the flag themselves —
 * the flux report uses the same builder for downloads, where it is false.
 */
export function withPreviewFlag(url: string): string {
  if (/[?&]preview=/.test(url)) return url;
  return `${url}${url.includes('?') ? '&' : '?'}preview=true`;
}
