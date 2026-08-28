// Copyright 2025-2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Use is limited to qualifying small businesses. See LICENSE for terms.

/**
 * PDF work for lead sheet attachments: converting an uploaded image into a PDF,
 * and burning tickmark stamps into the stored file.
 *
 * Stamps are BURNED IN, not applied at download. The bucket is browsable, and a
 * workpaper archive whose tickmarks exist only inside the app is not an archive
 * — open A001.pdf from the B2 console or a mounted drive and the review marks
 * must be there.
 *
 * The accepted consequence: a stamp cannot be removed. There is no pristine
 * copy to re-render from, so the UI must treat placing a mark as permanent.
 *
 * Font note: pdf-lib's StandardFonts are WinAnsi-encoded, and this app's FIRST
 * seeded system tickmark is '✓' (U+2713), which is not in WinAnsi — drawText
 * throws on it. So a real TTF is embedded via fontkit, reusing the Roboto
 * buffer PdfTemplateService already decodes rather than loading a second copy.
 */

import { PDFDocument, rgb, type PDFFont, type PDFImage } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import { ROBOTO_MEDIUM } from '../pdf/PdfTemplateService';

export interface StampAnnotation {
  id: string;
  /** 1-based. */
  page: number;
  /** 0..1 from the left edge. */
  xPct: number;
  /** 0..1 from the TOP edge — converted to pdf-lib's bottom origin at render. */
  yPct: number;
  symbol: string;
  color: string | null;
  note: string | null;
  createdBy?: number | null;
  createdAt?: string;
}

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
 * Draw one annotation onto an already-loaded document.
 *
 * Only the NEW mark is drawn — existing ones are already part of the page
 * content, and re-drawing them would double-ink the file.
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

  // A glyph the embedded font can't map would otherwise throw and fail the
  // whole upload; degrade to '?' instead.
  const safe = (text: string): string => {
    try {
      font.widthOfTextAtSize(text, 16);
      return text;
    } catch {
      return '?';
    }
  };

  page.drawText(safe(ann.symbol), { x, y: y - 16, size: 16, font, color: colour });
  if (ann.note) {
    page.drawText(safe(ann.note.slice(0, 80)), { x, y: y - 26, size: 8, font, color: colour });
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
