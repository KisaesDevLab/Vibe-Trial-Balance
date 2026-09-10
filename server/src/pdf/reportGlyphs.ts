// Copyright 2025-2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Use is limited to qualifying small businesses. See LICENSE for terms.

/**
 * Making user-chosen symbols printable in the reports.
 *
 * Reports render through pdfmake in Roboto, and **Roboto has no check mark**.
 * `✓` (U+2713) is the very first seeded system tickmark, so the mark an auditor
 * is most likely to apply came out of every PDF as a hollow rectangle.
 *
 * The failure is SILENT, which is why it survived: fontkit maps an unsupported
 * code point to `.notdef`, which has a width and draws a box. Nothing throws,
 * `widthOfTextAtSize` returns a number, and the page looks fine to any check
 * built on "it didn't error". Coverage is therefore read off the font's own
 * character set — see `lib/leadSheetPdf.ts`, which learned this the same way
 * for the pdf-lib stamping path.
 *
 * The fix is substitution, not a new font. Roboto does carry `√` (U+221A) and
 * `×` (U+00D7), which are the traditional pen-and-paper tickmark shapes anyway —
 * a workpaper ticked with `√` reads exactly as intended. Shipping a symbol font
 * to draw one glyph would add a binary asset and a licence to audit for no
 * legibility gain.
 *
 * Substitution is a PRINT-TIME concern only. The stored symbol is never
 * rewritten: the screen renders in the browser's own fonts, where `✓` is fine,
 * and silently editing a firm's tickmark library to suit a PDF font would be
 * the wrong trade.
 */

import fontkit from '@pdf-lib/fontkit';
import { ROBOTO_REGULAR } from './PdfTemplateService';

/**
 * Print-time stand-ins, keyed by the code point Roboto cannot draw.
 *
 * Each replacement must itself be covered by Roboto — asserted at lookup, so a
 * bad entry degrades to '?' rather than reintroducing the hollow box.
 */
const SUBSTITUTIONS: Record<string, string> = {
  '✓': '√', // ✓ check mark        → √ radical
  '✔': '√', // ✔ heavy check mark  → √
  '✅': '√', // ✅ white heavy check → √
  '✗': '×', // ✗ ballot X          → × multiplication sign
  '✘': '×', // ✘ heavy ballot X    → ×
  '❌': '×', // ❌ cross mark        → ×
  '•': '•', // • bullet (covered; here so ◦/∙ have somewhere to land)
  '◦': '•', // ◦ white bullet      → •
  '∙': '•', // ∙ bullet operator   → •
  '≡': '≈', // ≡ identical to      → ≈ almost equal
  '★': '*',      // ★ black star        → *
  '☆': '*',      // ☆ white star        → *
  '✱': '*',      // ✱ heavy asterisk    → *
  '✶': '*',      // ✶ six-pointed star  → *
  '→': '>',      // → rightwards arrow  → >
  '←': '<',      // ← leftwards arrow   → <
  '⇒': '>',      // ⇒ rightwards double → >
};

/** Code points Roboto can actually draw. Built once, off the font itself. */
let coveredCodePoints: Set<number> | null = null;

function covered(codePoint: number): boolean {
  if (coveredCodePoints === null) {
    const font = fontkit.create(ROBOTO_REGULAR) as unknown as { characterSet: number[] };
    coveredCodePoints = new Set<number>(font.characterSet);
  }
  return coveredCodePoints.has(codePoint);
}

/**
 * A version of `raw` that the report font can draw.
 *
 * Per character, because a tickmark symbol is a short string rather than a
 * single glyph (the column is `varchar(10)`), so `✓✓` and `✓A` have to work.
 * A character with no coverage and no stand-in becomes '?' — visibly wrong,
 * which beats a hollow box that reads as a deliberate empty checkbox on a
 * signed workpaper.
 */
export function pdfSafeSymbol(raw: string): string {
  let out = '';
  for (const ch of raw) {
    const cp = ch.codePointAt(0);
    if (cp === undefined) continue;
    if (covered(cp)) {
      out += ch;
      continue;
    }
    const sub = SUBSTITUTIONS[ch];
    const subCp = sub?.codePointAt(0);
    out += sub !== undefined && subCp !== undefined && covered(subCp) ? sub : '?';
  }
  return out;
}
