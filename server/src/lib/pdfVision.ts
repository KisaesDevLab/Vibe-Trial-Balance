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

/**
 * Renders the first `maxPages` pages of a PDF buffer to base64 PNG strings.
 * Returns an array of base64-encoded PNGs, one per page.
 */
export async function renderPdfToImages(pdfBuffer: Buffer, maxPages = 6): Promise<string[]> {
  const tmpDir = await mkdtemp(path.join(tmpdir(), 'tb-pdf-'));
  const pdfPath = path.join(tmpDir, 'input.pdf');

  try {
    await writeFile(pdfPath, pdfBuffer);

    try {
      await execFileAsync('pdftoppm', [
        '-png',
        '-r', '150',           // 150 DPI — good quality/size tradeoff
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
      .filter((f) => f.endsWith('.png'))
      .sort();

    return await Promise.all(
      files.map((f) => readFile(path.join(tmpDir, f)).then((buf) => buf.toString('base64'))),
    );
  } finally {
    await rm(tmpDir, { recursive: true, force: true }).catch(() => {});
  }
}
