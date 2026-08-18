// Copyright 2025-2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Use is limited to qualifying small businesses. See LICENSE for terms.

/**
 * Vision-mode PDF rendering via pdftoppm (poppler-utils).
 *
 * Converts PDF pages to PNG images so they can be sent to a vision-capable LLM.
 * Requires: sudo apt install poppler-utils  (on the Raspberry Pi server)
 *
 * On Windows dev machines pdftoppm is typically not installed — the caller
 * should catch PdftoppmNotFoundError and fall back gracefully.
 */

import { execFile } from 'child_process';
import { promisify } from 'util';
import { writeFile, readdir, readFile, rm, mkdtemp } from 'fs/promises';
import { tmpdir } from 'os';
import path from 'path';

const execFileAsync = promisify(execFile);

export class PdftoppmNotFoundError extends Error {
  constructor() {
    super('pdftoppm not found — install poppler-utils: sudo apt install poppler-utils');
    this.name = 'PdftoppmNotFoundError';
  }
}

export interface RenderOptions {
  /** Default 150 — good quality/size tradeoff for vision models. */
  dpi?: number;
  /** Default 'png'. Use 'jpeg' for lightweight UI previews. */
  format?: 'png' | 'jpeg';
  /** JPEG quality 1–100 (default 75). Ignored for PNG. */
  jpegQuality?: number;
}

/**
 * Renders the first `maxPages` pages of a PDF buffer to base64 image strings
 * (PNG by default, or JPEG via `opts.format`). Returns one entry per page.
 */
export async function renderPdfToImages(pdfBuffer: Buffer, maxPages = 6, opts: RenderOptions = {}): Promise<string[]> {
  const tmpDir = await mkdtemp(path.join(tmpdir(), 'tb-pdf-'));
  const pdfPath = path.join(tmpDir, 'input.pdf');
  const format = opts.format ?? 'png';
  const ext = format === 'jpeg' ? '.jpg' : '.png';

  try {
    await writeFile(pdfPath, pdfBuffer);

    try {
      await execFileAsync('pdftoppm', [
        format === 'jpeg' ? '-jpeg' : '-png',
        ...(format === 'jpeg' ? ['-jpegopt', `quality=${opts.jpegQuality ?? 75}`] : []),
        '-r', String(opts.dpi ?? 150),
        '-l', String(maxPages), // render at most maxPages pages
        pdfPath,
        path.join(tmpDir, 'page'),
      ]);
    } catch (err) {
      const e = err as NodeJS.ErrnoException;
      if (e.code === 'ENOENT' || e.message?.includes('not found') || e.message?.includes('ENOENT')) {
        throw new PdftoppmNotFoundError();
      }
      throw err;
    }

    const files = (await readdir(tmpDir))
      .filter((f) => f.endsWith(ext))
      .sort();

    return await Promise.all(
      files.map((f) => readFile(path.join(tmpDir, f)).then((buf) => buf.toString('base64'))),
    );
  } finally {
    await rm(tmpDir, { recursive: true, force: true }).catch(() => {});
  }
}
