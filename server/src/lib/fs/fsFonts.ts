// Copyright 2025-2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Use is limited to qualifying small businesses. See LICENSE for terms.

// Loads the bundled OFL font files (server/assets/fs-fonts) for PDF
// embedding and for the preview's font route. Resolved from FS_FONT_DIR,
// else relative to this module in both the src (tsx) and dist layouts,
// else relative to the working directory (PM2 runs in server/, the Docker
// image in /app). Bytes are cached per file.

import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { FS_FONT_FILES, fsFont, type FsFontKey } from './engine';

let fontDir: string | null = null;

export function fsFontDir(): string {
  if (fontDir) return fontDir;
  const candidates = [
    process.env['FS_FONT_DIR'],
    path.resolve(__dirname, '../../../assets/fs-fonts'),    // src/lib/fs or dist/lib/fs → server/assets
    path.resolve(process.cwd(), 'assets/fs-fonts'),
    path.resolve(process.cwd(), 'server/assets/fs-fonts'),
  ].filter((p): p is string => !!p);
  for (const c of candidates) {
    if (existsSync(path.join(c, 'LiberationSerif-Regular.ttf'))) {
      fontDir = c;
      return c;
    }
  }
  throw new Error(`Financial-statement fonts not found (looked in ${candidates.join(', ')})`);
}

const bytesCache = new Map<string, Buffer>();

export function fsFontBytes(file: string): Buffer {
  if (!FS_FONT_FILES.has(file)) throw new Error(`Unknown font file ${file}`);
  let b = bytesCache.get(file);
  if (!b) {
    b = readFileSync(path.join(fsFontDir(), file));
    bytesCache.set(file, b);
  }
  return b;
}

export function fsFontDataFiles(key: FsFontKey): Record<string, string> {
  const out: Record<string, string> = {};
  for (const f of fsFont(key).faces) out[f.file] = fsFontBytes(f.file).toString('base64');
  return out;
}
