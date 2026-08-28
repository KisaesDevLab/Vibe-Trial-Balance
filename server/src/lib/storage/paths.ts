// Copyright 2025-2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Use is limited to qualifying small businesses. See LICENSE for terms.

/**
 * Path primitives for the object-storage layer. Ported near-verbatim from
 * Vibe Time & Billing's `packages/storage/src/paths.ts`.
 *
 * Invariants:
 *   - Forward slashes only; Windows backslashes normalise to '/' on the way in.
 *   - Folder paths end with '/'. File keys never do.
 *   - Pure: no env, no I/O, so this is unit-testable on its own.
 *
 * Sanitisation is biased toward what Windows File Explorer accepts, because the
 * bucket can be mounted as a virtual drive. POSIX mounts accept Windows-safe
 * names too, so there is no downside to the stricter rule.
 */

const FORBIDDEN_CHARS_RE = /[<>:"|?*\\]/g;
// Control chars 0-31 (incl. tab/newline) plus DEL.
// eslint-disable-next-line no-control-regex
const CONTROL_CHARS_RE = /[\x00-\x1f\x7f]/g;

const WINDOWS_RESERVED_NAMES = new Set([
  'CON', 'PRN', 'AUX', 'NUL',
  'COM1', 'COM2', 'COM3', 'COM4', 'COM5', 'COM6', 'COM7', 'COM8', 'COM9',
  'LPT1', 'LPT2', 'LPT3', 'LPT4', 'LPT5', 'LPT6', 'LPT7', 'LPT8', 'LPT9',
]);

/** Max bytes for one path segment (Windows limit, less room for a ` (2)` suffix). */
export const MAX_BASENAME_BYTES = 240;

/** Max total key bytes. B2's hard cap is 1024; we use the same. */
export const MAX_KEY_BYTES = 1024;

/**
 * Join segments with '/'. Normalises backslashes, collapses duplicate slashes,
 * strips leading/trailing slashes on intermediate segments. A trailing slash on
 * the LAST segment is preserved, which is how callers express folder-vs-file
 * intent.
 */
export function joinPath(...segments: string[]): string {
  if (segments.length === 0) return '';
  const trailing = segments[segments.length - 1]?.endsWith('/') ?? false;
  const cleaned = segments
    .map((s) => s.replace(/\\/g, '/').replace(/\/+/g, '/').replace(/^\/|\/$/g, ''))
    .filter((s) => s.length > 0);
  const joined = cleaned.join('/');
  if (joined.length === 0) return '';
  return trailing ? `${joined}/` : joined;
}

/** Last non-empty segment — the folder's own name, independent of its prefix. */
export function folderBasename(path: string): string {
  const segments = path.replace(/\\/g, '/').split('/').filter((s) => s.length > 0);
  return segments[segments.length - 1] ?? '';
}

/** '' stays ''; anything else gets exactly one trailing '/'. */
export function normalizeTopPrefix(prefix: string | undefined): string {
  const trimmed = (prefix ?? '').replace(/\\/g, '/').replace(/^\/+|\/+$/g, '').trim();
  return trimmed.length > 0 ? `${trimmed}/` : '';
}

/**
 * Sanitise one path segment for Windows compatibility. Always returns a
 * non-empty string.
 */
export function sanitizeForWindows(input: string): string {
  let s = input ?? '';
  // A segment must not contain separators.
  s = s.replace(/[\\/]/g, '_');
  s = s.replace(FORBIDDEN_CHARS_RE, '_');
  s = s.replace(CONTROL_CHARS_RE, '');
  // Explorer silently strips trailing dots and spaces, so do it deliberately.
  s = s.replace(/[. ]+$/g, '');
  if (s.length === 0) return '_';

  // Reserved device names are checked against the basename only, so
  // "NUL.pdf" is caught but "ANNUAL.pdf" is not.
  const dot = s.lastIndexOf('.');
  const base = dot > 0 ? s.slice(0, dot) : s;
  const ext = dot > 0 ? s.slice(dot) : '';
  if (WINDOWS_RESERVED_NAMES.has(base.toUpperCase())) {
    s = `_${base}${ext}`;
  }

  if (Buffer.byteLength(s, 'utf8') > MAX_BASENAME_BYTES) {
    const extBytes = Buffer.byteLength(ext, 'utf8');
    const baseBudget = MAX_BASENAME_BYTES - extBytes;
    let trimmed = base;
    while (Buffer.byteLength(trimmed, 'utf8') > baseBudget && trimmed.length > 1) {
      trimmed = trimmed.slice(0, -1);
    }
    s = trimmed + ext;
  }

  return s;
}

/**
 * Return a free key, appending ` (2)`, ` (3)`, … before the extension.
 *
 * `exists` is async so it can be backed by a real HEAD against the store
 * rather than a cached listing.
 */
export async function resolveCollision(
  desiredKey: string,
  exists: (key: string) => Promise<boolean>,
): Promise<string> {
  if (!(await exists(desiredKey))) return desiredKey;
  const slash = desiredKey.lastIndexOf('/');
  const dir = slash >= 0 ? desiredKey.slice(0, slash + 1) : '';
  const file = slash >= 0 ? desiredKey.slice(slash + 1) : desiredKey;
  const dot = file.lastIndexOf('.');
  const base = dot > 0 ? file.slice(0, dot) : file;
  const ext = dot > 0 ? file.slice(dot) : '';
  for (let i = 2; i <= 999; i++) {
    const candidate = `${dir}${base} (${i})${ext}`;
    if (!(await exists(candidate))) return candidate;
  }
  throw new Error(`resolveCollision: exhausted 999 attempts for ${desiredKey}`);
}

/**
 * Enforce the total key byte cap by truncating the last segment's basename,
 * preserving the extension. Throws when the directory plus extension alone
 * exceed the cap — that is a caller bug worth failing loudly on.
 */
export function enforceKeyByteCap(key: string): string {
  if (Buffer.byteLength(key, 'utf8') <= MAX_KEY_BYTES) return key;
  const slash = key.lastIndexOf('/');
  const dir = slash >= 0 ? key.slice(0, slash + 1) : '';
  const file = slash >= 0 ? key.slice(slash + 1) : key;
  const dot = file.lastIndexOf('.');
  const base = dot > 0 ? file.slice(0, dot) : file;
  const ext = dot > 0 ? file.slice(dot) : '';
  const baseBudget = MAX_KEY_BYTES - Buffer.byteLength(dir, 'utf8') - Buffer.byteLength(ext, 'utf8');
  if (baseBudget < 1) {
    throw new Error(`enforceKeyByteCap: cannot fit ${key} within ${MAX_KEY_BYTES} bytes`);
  }
  let trimmed = base;
  while (Buffer.byteLength(trimmed, 'utf8') > baseBudget && trimmed.length > 0) {
    trimmed = trimmed.slice(0, -1);
  }
  return `${dir}${trimmed}${ext}`;
}
