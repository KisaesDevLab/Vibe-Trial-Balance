// Copyright 2025-2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Use is limited to qualifying small businesses. See LICENSE for terms.

/**
 * Object-key layout. Written fresh — Time & Billing has no fiscal-year tier —
 * but built on its four path primitives.
 *
 *   Clients/Jack Black LLC/Workpapers & Support/2025/<filename>
 *   <prefix>/<client folder>/<section>/<year>/<filename>
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
  /** The firm's own identifier for the client, if they use one. */
  code?: string | null;
}

/** Default client-folder pattern. */
export const DEFAULT_CLIENT_FOLDER_FORMAT = '{name}';

/** Placeholders a client-folder pattern may use. */
export const CLIENT_FOLDER_PLACEHOLDERS = ['{name}', '{code}', '{id}'] as const;

/** A pattern must include the name, or folders stop being recognisable. */
export function isValidClientFolderFormat(format: string): boolean {
  return format.includes('{name}');
}

/**
 * `Jack Black LLC` — the client's name, sanitised, and nothing else.
 *
 * `clients.name` has no unique index, so two clients CAN share a name. That is
 * handled where it actually matters rather than by mangling every folder name:
 * createClientFolder walks for a free name (`Jack Black LLC (2)`), and the
 * sentinel file — not the path — is what identifies the client, so a duplicate
 * name can never silently cross-link two of them.
 */
export function clientFolderName(client: ClientFolderInput, format?: string): string {
  const pattern = format && isValidClientFolderFormat(format) ? format : DEFAULT_CLIENT_FOLDER_FORMAT;
  const rendered = pattern
    .replace('{name}', client.name ?? '')
    .replace('{code}', (client.code ?? '').trim())
    .replace('{id}', String(client.id));
  // A pattern like "{code} - {name}" leaves a dangling separator when the
  // client has no code, so tidy the seams rather than producing " - Smith".
  const tidied = rendered
    .replace(/\s*[-_]\s*[-_]\s*/g, ' - ')
    .replace(/^[\s\-_]+|[\s\-_]+$/g, '')
    .replace(/\s{2,}/g, ' ');
  return sanitizeForWindows(tidied || client.name);
}

/** Default year-folder pattern. `{year}` is the only supported placeholder. */
export const DEFAULT_YEAR_FORMAT = '{year}';

/** A pattern is only usable if it actually places the year somewhere. */
export function isValidYearFormat(format: string): boolean {
  return format.includes('{year}');
}

export interface FiscalYearInput {
  /**
   * periods.folder_year — an explicit label set on the period. Wins over
   * derivation, which cannot know about a short year, a stub period, or a
   * firm's own naming.
   */
  folderYear?: string | null;
  /** periods.end_date — the stable anchor when no explicit label is set. */
  endDate: string | Date | null;
  /** periods.start_date, used only as a fallback. */
  startDate?: string | Date | null;
  /** periods.period_name, the last-resort fallback. */
  periodName?: string | null;
  /** clients.tax_year_end, a varchar(5) holding MM-DD. */
  taxYearEnd?: string | null;
}

/**
 * `2025`, or whatever the year-format setting asks for.
 *
 * An explicit `periods.folder_year` wins. Otherwise derived from `end_date`,
 * never from `period_name` — a period name is free
 * text a user can rename at will, and a rename must not orphan stored files.
 *
 * When the client has a non-calendar year end, a period ending after that date
 * belongs to the NEXT fiscal year. A client with a 06-30 year end whose period
 * ends 2024-12-31 is in FY2025, which a naive `year(end_date)` gets wrong.
 */
export function fiscalYearFolder(input: FiscalYearInput, format?: string): string {
  const pattern = format && isValidYearFormat(format) ? format : DEFAULT_YEAR_FORMAT;
  const render = (year: string | number): string =>
    sanitizeForWindows(pattern.replace('{year}', String(year)));

  // An explicit label on the period is used as-is: the point of the field is to
  // say something derivation can't work out.
  const explicit = (input.folderYear ?? '').trim();
  if (explicit) return sanitizeForWindows(explicit);

  const end = toYmd(input.endDate) ?? toYmd(input.startDate ?? null);
  if (end) {
    let year = end.year;
    const fye = parseMonthDay(input.taxYearEnd);
    if (fye && (end.month > fye.month || (end.month === fye.month && end.day > fye.day))) {
      year += 1;
    }
    return render(year);
  }
  // Digit-boundary lookarounds, not \b: in "FY2022" the position between 'Y'
  // and '2' is not a word boundary, so \b would never match.
  const fromName = /(?<!\d)(19|20)\d{2}(?!\d)/.exec(input.periodName ?? '');
  return fromName ? render(fromName[0]) : 'unknown-year';
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
  /** Client-folder pattern; defaults to `{name}`. */
  clientFolderFormat?: string;
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
    clientFolderName(input.client, input.clientFolderFormat),
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
export function clientFolderPath(
  prefix: string | undefined,
  client: ClientFolderInput,
  format?: string,
): string {
  return `${joinPath(normalizeTopPrefix(prefix), clientFolderName(client, format))}/`;
}
