// Copyright 2025-2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Use is limited to qualifying small businesses. See LICENSE for terms.

/**
 * PDF work for lead sheet attachments: converting an uploaded image into a PDF,
 * and burning annotations — tickmark stamps, free-text notes and drawn lines —
 * into the stored file.
 *
 * Annotations are BURNED IN, not applied at download. The bucket is browsable,
 * and a workpaper archive whose review marks exist only inside the app is not
 * an archive — open A001.pdf from the B2 console or a mounted drive and the
 * tickmarks, notes and lines must be there.
 *
 * The accepted consequence: an annotation cannot be removed. There is no
 * pristine copy to re-render from, so the UI must treat placing one as
 * permanent.
 *
 * Font note, and it takes two fonts to cover the tickmarks:
 *   - pdf-lib's StandardFonts are WinAnsi-encoded and drawText THROWS on '✓'
 *     (U+2713), this app's first seeded system tickmark. So a real TTF is
 *     embedded via fontkit, reusing the Roboto buffer PdfTemplateService
 *     already decodes rather than loading a second copy.
 *   - But pdfmake's Roboto has no '✓' glyph either, and that failure is
 *     SILENT: fontkit maps an unsupported code point to .notdef, which has a
 *     width and draws nothing. The mark went in, the audit trail said it was
 *     stamped, and the page came out blank. So coverage is checked against the
 *     font's character set — a width that doesn't throw proves nothing — and
 *     anything Roboto lacks falls back to ZapfDingbats, which carries ✓ ✔ ✗ ✘
 *     and is one of the 14 standard PDF fonts, so nothing extra is embedded.
 */

import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFImage } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import { ROBOTO_MEDIUM } from '../pdf/PdfTemplateService';

interface AnnotationBase {
  id: string;
  /** 1-based. */
  page: number;
  /** 0..1 from the left edge. */
  xPct: number;
  /** 0..1 from the TOP edge — converted to pdf-lib's bottom origin at render. */
  yPct: number;
  color: string | null;
  createdBy?: number | null;
  createdAt?: string;
}

/** A tickmark from the client's library, with an optional caption. `kind` is
 *  absent on rows written before notes and lines existed. */
export interface TickmarkAnnotation extends AnnotationBase {
  kind?: 'tickmark';
  symbol: string;
  note: string | null;
}

/** Free text, drawn in a bordered box whose top-left corner is the click point. */
export interface NoteAnnotation extends AnnotationBase {
  kind: 'note';
  text: string;
}

/** A straight line from (xPct, yPct) to (x2Pct, y2Pct). */
export interface LineAnnotation extends AnnotationBase {
  kind: 'line';
  x2Pct: number;
  y2Pct: number;
  /** Stroke width in PDF points. */
  strokeWidth: number;
}

export type StampAnnotation = TickmarkAnnotation | NoteAnnotation | LineAnnotation;

/** Longest note the burner will draw; the route enforces the same cap. */
export const MAX_NOTE_TEXT = 500;
export const MIN_STROKE_WIDTH = 0.5;
export const MAX_STROKE_WIDTH = 8;

/** Note box typography, in PDF points. */
const NOTE_FONT_SIZE = 9;
const NOTE_LINE_HEIGHT = 11;
const NOTE_PADDING = 4;
const NOTE_MAX_WIDTH = 220;

/** This app's tickmark colour vocabulary (note: amber, not the reference's yellow). */
const STAMP_COLORS: Record<string, [number, number, number]> = {
  gray: [0.35, 0.35, 0.35],
  blue: [0.12, 0.38, 0.85],
  green: [0.09, 0.55, 0.27],
  red: [0.86, 0.15, 0.15],
  purple: [0.49, 0.23, 0.83],
  amber: [0.79, 0.5, 0.05],
};

const clamp01 = (n: number): number => (Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : 0);

/**
 * Can ZapfDingbats encode this symbol?
 *
 * Asked of a throwaway document, because embedFont registers the font on the
 * document it is called with and pdf-lib writes it out at save whether or not
 * anything drew with it — so asking the real file would leave a dead font
 * dictionary in every workpaper whose symbol turned out to be unsupported too.
 * The scratch document holds only standard-font metrics; nothing is embedded.
 */
let scratchDingbats: Promise<PDFFont> | null = null;
async function dingbatsCanEncode(text: string): Promise<boolean> {
  scratchDingbats ??= PDFDocument.create().then((d) => d.embedFont(StandardFonts.ZapfDingbats));
  try {
    (await scratchDingbats).widthOfTextAtSize(text, 16);
    return true;
  } catch {
    return false;
  }
}

/**
 * Break `text` into lines no wider than `maxWidth`. Words wider than the box
 * are split by character so nothing is ever drawn past the border. Explicit
 * newlines are honoured.
 */
export function wrapText(
  text: string,
  measure: (s: string) => number,
  maxWidth: number,
): string[] {
  const lines: string[] = [];
  for (const para of text.replace(/\r\n?/g, '\n').split('\n')) {
    const words = para.split(/\s+/).filter(Boolean);
    if (words.length === 0) { lines.push(''); continue; }
    let current = '';
    for (const word of words) {
      const candidate = current ? `${current} ${word}` : word;
      if (measure(candidate) <= maxWidth) { current = candidate; continue; }
      if (current) lines.push(current);
      // The word alone overflows: hard-break it.
      let chunk = '';
      for (const ch of word) {
        if (chunk && measure(chunk + ch) > maxWidth) { lines.push(chunk); chunk = ''; }
        chunk += ch;
      }
      current = chunk;
    }
    if (current) lines.push(current);
  }
  return lines;
}

/**
 * Draw one annotation onto an already-loaded document.
 *
 * Only the NEW annotation is drawn — existing ones are already part of the
 * page content, and re-drawing them would double-ink the file.
 */
export async function burnAnnotation(pdfBytes: Buffer, ann: StampAnnotation): Promise<Buffer> {
  const doc = await PDFDocument.load(pdfBytes);
  doc.registerFontkit(fontkit);

  let font: PDFFont;
  try {
    // subset: true keeps the embedded font at a couple of KB rather than ~170.
    font = await doc.embedFont(ROBOTO_MEDIUM, { subset: true });
  } catch {
    font = await doc.embedFont(ROBOTO_MEDIUM);
  }

  const pages = doc.getPages();
  const pageIndex = Math.min(Math.max(1, Math.round(ann.page)), pages.length) - 1;
  const page = pages[pageIndex];
  const { width, height } = page.getSize();

  const x = clamp01(ann.xPct) * width;
  // Screen coordinates run down from the top; PDF space runs up from the bottom.
  const y = height - clamp01(ann.yPct) * height;

  const [r, g, b] = STAMP_COLORS[ann.color ?? 'gray'] ?? STAMP_COLORS.gray;
  const colour = rgb(r, g, b);

  // What the embedded font can actually draw. NOT widthOfTextAtSize: fontkit
  // answers that for an unsupported code point too, using .notdef's width, so
  // it reports every character as fine and the glyph silently draws blank.
  const covered = new Set(font.getCharacterSet());
  const canDraw = (text: string): boolean =>
    [...text].every((ch) => covered.has(ch.codePointAt(0) as number));
  // Prose stays in Roboto and only the characters it lacks are replaced —
  // one odd character shouldn't cost the preparer the whole note.
  const substitute = (text: string): string =>
    [...text].map((ch) => (canDraw(ch) ? ch : '?')).join('');

  const kind = ann.kind ?? 'tickmark';

  if (kind === 'line') {
    const line = ann as LineAnnotation;
    const x2 = clamp01(line.x2Pct) * width;
    const y2 = height - clamp01(line.y2Pct) * height;
    const thickness = Number.isFinite(line.strokeWidth)
      ? Math.min(MAX_STROKE_WIDTH, Math.max(MIN_STROKE_WIDTH, line.strokeWidth))
      : 1.5;
    page.drawLine({ start: { x, y }, end: { x: x2, y: y2 }, thickness, color: colour });
  } else if (kind === 'note') {
    const note = ann as NoteAnnotation;
    const text = substitute(note.text.slice(0, MAX_NOTE_TEXT));
    const measure = (s: string): number => font.widthOfTextAtSize(s, NOTE_FONT_SIZE);
    // The box wants NOTE_MAX_WIDTH but must stay on the page: shrink it on a
    // narrow page, and slide the whole box left near the right edge.
    const boxW = Math.min(NOTE_MAX_WIDTH, width - NOTE_PADDING * 2);
    const left = Math.max(0, Math.min(x, width - boxW));
    const lines = wrapText(text, measure, boxW - NOTE_PADDING * 2);
    const boxH = lines.length * NOTE_LINE_HEIGHT + NOTE_PADDING * 2;
    // Same for the bottom edge: the box's top slides up so it stays on the page.
    const top = Math.max(Math.min(boxH, height), Math.min(y, height));
    page.drawRectangle({
      x: left, y: top - boxH, width: boxW, height: boxH,
      color: rgb(1, 0.98, 0.8), opacity: 0.92,
      borderColor: colour, borderWidth: 0.75,
    });
    lines.forEach((ln, i) => {
      page.drawText(ln, {
        x: left + NOTE_PADDING,
        y: top - NOTE_PADDING - NOTE_LINE_HEIGHT * (i + 1) + 3,
        size: NOTE_FONT_SIZE, font, color: colour,
      });
    });
  } else {
    const tm = ann as TickmarkAnnotation;
    // The symbol is one mark, so it gets a font that can render it rather than
    // a per-character substitution: Roboto, else ZapfDingbats (embedded only
    // when it is needed, so an ordinary letter tickmark doesn't drag it into
    // the file), else '?' so a stamp is at least visible as one.
    let symbolFont: PDFFont = font;
    let symbol = tm.symbol;
    if (!canDraw(symbol)) {
      // Standard fonts DO throw on a character they cannot encode, which is
      // what makes this a real check — unlike the embedded TTF's silent .notdef.
      if (await dingbatsCanEncode(symbol)) symbolFont = await doc.embedFont(StandardFonts.ZapfDingbats);
      else symbol = '?';
    }
    page.drawText(symbol, { x, y: y - 16, size: 16, font: symbolFont, color: colour });
    if (tm.note) {
      page.drawText(substitute(tm.note.slice(0, 80)), { x, y: y - 26, size: 8, font, color: colour });
    }
  }

  // Re-saving a vector PDF through pdf-lib is lossless — it is not a raster
  // re-encode — so repeated stamping does not degrade page content.
  return Buffer.from(await doc.save());
}

const IMAGE_MIME = new Set(['image/png', 'image/jpeg']);

export function isConvertibleImage(mime: string): boolean {
  return IMAGE_MIME.has(mime);
}

/**
 * Wrap an uploaded image in a PDF so every attachment is uniform — stampable,
 * ref-coded, and mergeable into the binder. Preparers photograph receipts, and
 * making them convert by hand first would just mean they don't attach them.
 *
 * pdf-lib embeds PNG and JPEG natively, so this costs no extra dependency.
 */
export async function imageToPdf(buffer: Buffer, mime: string): Promise<Buffer> {
  const doc = await PDFDocument.create();
  let image: PDFImage;
  if (mime === 'image/png') image = await doc.embedPng(buffer);
  else image = await doc.embedJpg(buffer);

  // US Letter, with the image scaled to fit inside a small margin so nothing is
  // cropped and a stamp has somewhere to land.
  const PAGE_W = 612;
  const PAGE_H = 792;
  const MARGIN = 24;
  const maxW = PAGE_W - MARGIN * 2;
  const maxH = PAGE_H - MARGIN * 2;
  const scale = Math.min(maxW / image.width, maxH / image.height, 1);
  const w = image.width * scale;
  const h = image.height * scale;

  const page = doc.addPage([PAGE_W, PAGE_H]);
  page.drawImage(image, {
    x: (PAGE_W - w) / 2,
    y: (PAGE_H - h) / 2,
    width: w,
    height: h,
  });
  return Buffer.from(await doc.save());
}

/** Page count, used to validate an annotation's page before drawing. */
export async function pdfPageCount(pdfBytes: Buffer): Promise<number> {
  const doc = await PDFDocument.load(pdfBytes);
  return doc.getPageCount();
}
