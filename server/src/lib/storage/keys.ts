// Copyright 2025-2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Use is limited to qualifying small businesses. See LICENSE for terms.

/**
 * Object-key layout. Written fresh — Time & Billing has no fiscal-year tier —
 * but built on its four path primitives.
 *
 *   <prefix>/<Client Name (id)>/<Section>/FY<year>/<filename>
 *
 * Section before year, so all years of one document kind sit together.
 *
 * Pure: no DB, no env, no I/O (except the injected `exists` predicate), so the
 * whole scheme is unit-testable.
 *
 * Keys are STORED, never re-derived. `client_documents.object_key` is the sole
 * source of truth for reads, so renaming a client or a folder template row
 * moves nothing and breaks nothing — only later writes use the new name.
 */

import {
  enforceKeyByteCap,
  joinPath,
  normalizeTopPrefix,
  resolveCollision,
  sanitizeForWindows,
} from './paths';

export interface ClientFolderInput {
  id: number;
  name: string;
}

/**
 * `Acme Holdings, LLC (12)`.
 *
 * The id suffix is not decoration: `clients.name` has no unique index, so two
 * clients may legitimately share a name. The id is the only stable
 * disambiguator, and it keeps the folder recognisable when the bucket is
 * browsed directly.
 */
export function clientFolderName(client: ClientFolderInput): string {
  return sanitizeForWindows(`${client.name} (${client.id})`);
}

export interface FiscalYearInput {
  /** periods.end_date — the stable anchor. */
  endDate: string | Date | null;
  /** periods.start_date, used only as a fallback. */
  startDate?: string | Date | null;
  /** periods.period_name, the last-resort fallback. */
  periodName?: string | null;
  /** clients.tax_year_end, a varchar(5) holding MM-DD. */
  taxYearEnd?: string | null;
}

/**
 * `FY2024`.
 *
 * Derived from `end_date`, never from `period_name` — a period name is free
 * text a user can rename at will, and a rename must not orphan stored files.
 *
 * When the client has a non-calendar year end, a period ending after that date
 * belongs to the NEXT fiscal year. A client with a 06-30 year end whose period
 * ends 2024-12-31 is in FY2025, which a naive `year(end_date)` gets wrong.
 */
export function fiscalYearFolder(input: FiscalYearInput): string {
  const end = toYmd(input.endDate) ?? toYmd(input.startDate ?? null);
  if (end) {
    let year = end.year;
    const fye = parseMonthDay(input.taxYearEnd);
    if (fye && (end.month > fye.month || (end.month === fye.month && end.day > fye.day))) {
      year += 1;
    }
    return `FY${year}`;
  }
  // Digit-boundary lookarounds, not \b: in "FY2022" the position between 'Y'
  // and '2' is not a word boundary, so \b would never match.
  const fromName = /(?<!\d)(19|20)\d{2}(?!\d)/.exec(input.periodName ?? '');
  return fromName ? `FY${fromName[0]}` : 'FY-unknown';
}

/**
 * Calendar year/month/day, with no timezone shifting.
 *
 * `periods.end_date` is a Postgres `date`; node-pg materialises it as a Date at
 * LOCAL midnight. Reading it back with getUTC* shifts it a day earlier anywhere
 * east of UTC, so a 2024-07-01 period end would read as 6/30 and a 06-30 year
 * end would file the documents under the wrong FY. Read local components from a
 * Date, and parse a YYYY-MM-DD string textually so it never becomes a Date at
 * all.
 */
function toYmd(v: string | Date | null | undefined): { year: number; month: number; day: number } | null {
  if (!v) return null;
  if (typeof v === 'string') {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(v.trim());
    if (m) return { year: Number(m[1]), month: Number(m[2]), day: Number(m[3]) };
    const parsed = new Date(v);
    if (Number.isNaN(parsed.getTime())) return null;
    return { year: parsed.getFullYear(), month: parsed.getMonth() + 1, day: parsed.getDate() };
  }
  if (Number.isNaN(v.getTime())) return null;
  return { year: v.getFullYear(), month: v.getMonth() + 1, day: v.getDate() };
}

/** `MM-DD` -> { month, day }. Returns null for anything else, including ''. */
function parseMonthDay(raw: string | null | undefined): { month: number; day: number } | null {
  const m = /^(\d{1,2})-(\d{1,2})$/.exec((raw ?? '').trim());
  if (!m) return null;
  const month = Number(m[1]);
  const day = Number(m[2]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return { month, day };
}

export interface DocumentKeyInput {
  prefix?: string;
  client: ClientFolderInput;
  /** A section name from the folder template, e.g. 'Workpapers'. */
  section: string;
  fiscalYear: string;
  /** Optional extra tier, e.g. 'Lead Sheets'. */
  subfolder?: string | null;
  filename: string;
}

/**
 * Build the desired key. The original filename is preserved (sanitised) rather
 * than replaced with a timestamped blob: the point of a browsable object store
 * is seeing `2024 Q4 Bank Stmt.pdf`.
 */
export function buildDocumentKey(input: DocumentKeyInput): string {
  const segments = [
    normalizeTopPrefix(input.prefix),
    clientFolderName(input.client),
    sanitizeForWindows(input.section),
    sanitizeForWindows(input.fiscalYear),
  ];
  if (input.subfolder) segments.push(sanitizeForWindows(input.subfolder));
  segments.push(sanitizeForWindows(input.filename));
  return enforceKeyByteCap(joinPath(...segments));
}

/** Build a key and resolve any collision against the store. */
export async function buildUniqueDocumentKey(
  input: DocumentKeyInput,
  exists: (key: string) => Promise<boolean>,
): Promise<string> {
  return resolveCollision(buildDocumentKey(input), exists);
}

export interface KeyUnderFolderInput {
  /** Null for a legacy layout, which has no section tier. */
  section: string | null;
  /** Null for a legacy layout, which has no fiscal-year tier. */
  fiscalYear: string | null;
  subfolder?: string | null;
  filename: string;
}

/**
 * Build a key UNDER an already-bound client folder.
 *
 * This is what callers should use: the folder comes from the client's link row,
 * so a legacy backfilled path, an admin-chosen folder name, or a path re-bound
 * after an out-of-band rename are all honoured. Re-deriving the folder from the
 * client's current name would file documents somewhere the link doesn't point.
 */
export function buildKeyUnderFolder(folderPath: string, input: KeyUnderFolderInput): string {
  const segments = [folderPath];
  if (input.section) segments.push(sanitizeForWindows(input.section));
  if (input.fiscalYear) segments.push(sanitizeForWindows(input.fiscalYear));
  if (input.subfolder) segments.push(sanitizeForWindows(input.subfolder));
  segments.push(sanitizeForWindows(input.filename));
  return enforceKeyByteCap(joinPath(...segments));
}

export async function buildUniqueDocumentKeyUnder(
  folderPath: string,
  input: KeyUnderFolderInput,
  exists: (key: string) => Promise<boolean>,
): Promise<string> {
  return resolveCollision(buildKeyUnderFolder(folderPath, input), exists);
}

/** The client's folder, with a trailing slash — what a link row records. */
export function clientFolderPath(prefix: string | undefined, client: ClientFolderInput): string {
  return `${joinPath(normalizeTopPrefix(prefix), clientFolderName(client))}/`;
}
