// Copyright 2025-2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Use is limited to qualifying small businesses. See LICENSE for terms.

/**
 * Deterministic account numbering for accounts that arrive without a number
 * (a QuickBooks company that never turned on account numbers, for one).
 *
 * The rule is the one a bookkeeper applies by hand: find the band this
 * client already uses for the category (1xxx assets, 2xxx liabilities, 3xxx
 * equity, 4xxx revenue, 5–9xxx expenses — whichever expense digit the client
 * favours), take the highest number in it, and go up in steps of ten. A
 * client with 5-digit numbers gets 5-digit numbers. Nothing here is
 * clever, which is the point: it needs no AI, never collides, and lands
 * new accounts where the rest of the chart expects them.
 *
 * The AI pass in `POST /import/qbo/suggest-numbers` is the smarter option;
 * this is what fills whatever the AI misses, and what runs when AI is off.
 * A placeholder like `QB123` is never produced — the user asked for real
 * numbers or nothing.
 */

import { inferAccountType, type AccountCategory, type NormalBalance, CATEGORY_NORMAL_BALANCE } from './accountTypeInference';

export interface NumberingRow {
  key: string;
  name: string;
  category: AccountCategory | null;
}

export interface NumberingResult {
  key: string;
  number: string;
  category: AccountCategory;
  normalBalance: NormalBalance;
}

/** Leading digits tried for each category, most conventional first. */
const BAND_DIGITS: Record<AccountCategory, number[]> = {
  assets: [1],
  liabilities: [2],
  equity: [3],
  revenue: [4],
  expenses: [6, 5, 7, 8, 9],
};

const STEP = 10;
const DEFAULT_WIDTH = 4;

function isNumeric(n: string): boolean {
  return /^[0-9]+$/.test(n);
}

/** The digit count most of the client's numeric account numbers share (4 when there are none). */
export function dominantWidth(existingNumbers: readonly string[]): number {
  const counts = new Map<number, number>();
  for (const n of existingNumbers) {
    if (!isNumeric(n)) continue;
    counts.set(n.length, (counts.get(n.length) ?? 0) + 1);
  }
  let best = DEFAULT_WIDTH;
  let bestCount = 0;
  for (const [w, c] of counts) {
    if (c > bestCount || (c === bestCount && w < best)) { best = w; bestCount = c; }
  }
  return Math.min(Math.max(best, 3), 8);
}

/**
 * Which leading digit the client uses for a category: the one with the most
 * existing accounts of that category at the dominant width, else the
 * conventional first choice.
 */
function bandDigit(
  category: AccountCategory,
  width: number,
  existing: ReadonlyArray<{ number: string; category: AccountCategory | null }>,
): number {
  const candidates = BAND_DIGITS[category];
  let best = candidates[0] as number;
  let bestCount = 0;
  for (const d of candidates) {
    const c = existing.filter((e) => e.category === category && isNumeric(e.number) && e.number.length === width && e.number.startsWith(String(d))).length;
    if (c > bestCount) { best = d; bestCount = c; }
  }
  return best;
}

/**
 * Assign a number to every row, in input order, never reusing an existing,
 * reserved or just-assigned number. Rows without a category are typed from
 * their name (the same `inferAccountType` the import confirm uses).
 */
export function assignSequentialNumbers(
  rows: readonly NumberingRow[],
  existing: ReadonlyArray<{ number: string; category: AccountCategory | null }>,
  reservedNumbers: readonly string[] = [],
): NumberingResult[] {
  const used = new Set<string>();
  for (const e of existing) used.add(e.number.trim());
  for (const r of reservedNumbers) { const clean = String(r).trim(); if (clean) used.add(clean); }

  const width = dominantWidth(existing.map((e) => e.number));
  const bandBase = (digit: number): number => digit * 10 ** (width - 1);
  const bandTop = (digit: number): number => bandBase(digit) + 10 ** (width - 1) - 1;

  // Highest number already taken per band, so the first assignment continues
  // the client's own sequence rather than restarting at the base.
  const highest = new Map<number, number>();
  const noteTaken = (n: string): void => {
    if (!isNumeric(n) || n.length !== width) return;
    const digit = Number(n[0]);
    const v = Number(n);
    if ((highest.get(digit) ?? -1) < v) highest.set(digit, v);
  };
  for (const n of used) noteTaken(n);

  const out: NumberingResult[] = [];
  for (const row of rows) {
    const inferred = row.category ? null : inferAccountType(null, row.name);
    const category: AccountCategory = row.category ?? inferred?.category ?? 'expenses';
    const normalBalance: NormalBalance = inferred?.normalBalance ?? CATEGORY_NORMAL_BALANCE[category];
    const digit = bandDigit(category, width, existing);

    const top = highest.get(digit);
    // Next multiple of STEP above the highest, or the band's base when empty.
    let candidate = top === undefined ? bandBase(digit) : Math.floor(top / STEP) * STEP + STEP;
    // Past the band (a chart with 999 expense accounts): step by one instead
    // of stopping — a number past the band beats no number at all.
    while (used.has(String(candidate))) candidate += candidate > bandTop(digit) ? 1 : STEP;

    const number = String(candidate);
    used.add(number);
    noteTaken(number);
    out.push({ key: row.key, number, category, normalBalance });
  }
  return out;
}
