// Copyright 2025-2026 Kisaes LLC
// Licensed under the PolyForm Internal Use License 1.0.0.
// You may not distribute this software. See LICENSE for terms.

import { pushToast } from '../store/uiStore';

// Per-kind size ceilings. Values picked to match what the server can reasonably
// parse without OOM on a Pi and to catch obvious misdrops (e.g. a 2 GB video
// pasted into the CSV upload).
export const MAX_SIZES = {
  csv: 50 * 1024 * 1024,      // 50 MB
  excel: 100 * 1024 * 1024,   // 100 MB
  pdf: 50 * 1024 * 1024,      // 50 MB
  ofx: 50 * 1024 * 1024,      // 50 MB
  backup: 2 * 1024 * 1024 * 1024, // 2 GB — server can stream larger, but alert anyway
  document: 50 * 1024 * 1024, // 50 MB
} as const;

export type FileKind = keyof typeof MAX_SIZES;

function fmtBytes(n: number): string {
  if (n >= 1024 * 1024 * 1024) return `${(n / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  if (n >= 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`;
  if (n >= 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${n} B`;
}

/**
 * Returns true if the file is acceptable. On failure, pushes an error toast
 * describing the limit and returns false so the caller can short-circuit.
 */
export function checkFileSize(file: File, kind: FileKind): boolean {
  const max = MAX_SIZES[kind];
  if (file.size > max) {
    pushToast(
      `"${file.name}" is ${fmtBytes(file.size)} — over the ${fmtBytes(max)} limit for this upload.`,
      'error',
    );
    return false;
  }
  return true;
}
