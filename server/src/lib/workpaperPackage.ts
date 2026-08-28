// Copyright 2025-2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Use is limited to qualifying small businesses. See LICENSE for terms.

/**
 * Building the merged workpaper binder.
 *
 * Extracted from routes/pdfReports.ts so both the download endpoint and the
 * "save to Documents" endpoint produce byte-identical output from one code
 * path.
 *
 * The optional attachment merge is cheap here because attachments are stored
 * already stamped: it is a straight copyPages with no render step.
 */

import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import type { Knex } from 'knex';
import { generateWorkpaperTocPdf, type TocEntry } from '../pdf/reportGenerators';
import { readDocumentBuffer, type DocumentRow } from './documentStore';

/** Two rebuilds settle the numbering; the third is belt and braces. */
const TOC_REBUILD_LIMIT = 3;

export interface ReportGenerator {
  label: string;
  generate: (periodId: number) => Promise<Buffer>;
}

export interface BuildPackageOptions {
  includeAttachments?: boolean;
}

export interface BuildPackageResult {
  buffer: Buffer;
  /** Attachments that could not be read or parsed — reported, never fatal. */
  skippedAttachments: Array<{ refCode: string; reason: string }>;
}

export async function buildWorkpaperPackage(
  db: Knex,
  periodId: number,
  reportIds: string[],
  generators: Record<string, ReportGenerator>,
  opts: BuildPackageOptions = {},
): Promise<BuildPackageResult> {
  // Build every selected report first: the contents page can't be written
  // until each one's page count is known.
  const built: Array<{ label: string; doc: PDFDocument; pageCount: number }> = [];
  for (const reportId of reportIds) {
    const report = generators[reportId];
    if (!report) continue;
    const srcDoc = await PDFDocument.load(await report.generate(periodId));
    built.push({ label: report.label, doc: srcDoc, pageCount: srcDoc.getPageCount() });
  }
  if (built.length === 0) {
    throw Object.assign(new Error('None of the requested reports exist'), {
      status: 400,
      code: 'VALIDATION_ERROR',
    });
  }

  const skipped: Array<{ refCode: string; reason: string }> = [];
  const attachmentEntries: Array<{ label: string; doc: PDFDocument; pageCount: number; refCode: string; sourceName: string }> = [];

  if (opts.includeAttachments) {
    const rows = await db('lead_sheet_attachments as a')
      .join('client_documents as d', 'd.id', 'a.document_id')
      .where('a.period_id', periodId)
      .whereNull('a.deleted_at')
      .orderBy('a.ref_code', 'asc')
      .select('a.ref_code', 'a.source_file_name', 'd.*');

    for (const r of rows as Array<Record<string, unknown>>) {
      const refCode = r.ref_code as string;
      try {
        const bytes = await readDocumentBuffer(r as unknown as DocumentRow);
        const doc = await PDFDocument.load(bytes);
        attachmentEntries.push({
          label: `${refCode} — ${r.source_file_name || 'attachment'}`,
          doc,
          pageCount: doc.getPageCount(),
          refCode,
          sourceName: (r.source_file_name as string) || 'attachment',
        });
      } catch (err) {
        // One corrupt file must never fail a 200-page binder.
        skipped.push({ refCode, reason: (err as Error).message });
      }
    }
  }

  const buildToc = (tocPageCount: number): Promise<Buffer> => {
    const entries: TocEntry[] = [];
    let cursor = tocPageCount + 1;
    for (const b of built) {
      entries.push({ label: b.label, startPage: cursor, pageCount: b.pageCount });
      cursor += b.pageCount;
    }
    for (const a of attachmentEntries) {
      entries.push({ label: a.label, startPage: cursor, pageCount: a.pageCount });
      cursor += a.pageCount;
    }
    return generateWorkpaperTocPdf(db, periodId, entries);
  };

  // The contents page numbers itself, so its own length shifts every number on
  // it. Assume one page and rebuild if that was wrong. Attachments can add
  // hundreds of pages, which is exactly when the TOC crosses onto a second page.
  let tocPageCount = 1;
  let tocBuffer = await buildToc(tocPageCount);
  for (let attempt = 0; attempt < TOC_REBUILD_LIMIT; attempt++) {
    const actual = (await PDFDocument.load(tocBuffer)).getPageCount();
    if (actual === tocPageCount) break;
    tocPageCount = actual;
    tocBuffer = await buildToc(tocPageCount);
  }

  const merged = await PDFDocument.create();
  const tocDoc = await PDFDocument.load(tocBuffer);
  for (const page of await merged.copyPages(tocDoc, tocDoc.getPageIndices())) merged.addPage(page);
  for (const b of built) {
    for (const page of await merged.copyPages(b.doc, b.doc.getPageIndices())) merged.addPage(page);
  }

  if (attachmentEntries.length > 0) {
    const font = await merged.embedFont(StandardFonts.Helvetica);
    for (const a of attachmentEntries) {
      for (const page of await merged.copyPages(a.doc, a.doc.getPageIndices())) {
        const added = merged.addPage(page);
        // Stamp the provenance so a page pulled out of the binder still says
        // where it came from.
        const { height } = added.getSize();
        added.drawText(`${a.refCode} — ${a.sourceName}`.slice(0, 90), {
          x: 18,
          y: height - 16,
          size: 7,
          font,
          color: rgb(0.4, 0.4, 0.4),
        });
      }
    }
  }

  return { buffer: Buffer.from(await merged.save()), skippedAttachments: skipped };
}
