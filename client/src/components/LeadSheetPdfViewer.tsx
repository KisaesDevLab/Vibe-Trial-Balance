// Copyright 2025-2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Use is limited to qualifying small businesses. See LICENSE for terms.

/**
 * Attachment viewer with click-to-place tickmark stamping.
 *
 * Two consequences of stamps being burned into the stored file:
 *   - Existing marks arrive as page CONTENT, already drawn. There is no overlay
 *     of previous stamps to render or remove — only the pending placement.
 *   - Placing a mark is permanent, so it takes a confirmation and there is no
 *     per-chip delete control.
 *
 * pdfjs is imported lazily inside the effect, and this whole component is
 * lazy-loaded by its caller: a top-level import would add ~1 MB to the initial
 * bundle for a feature most page loads never touch.
 *
 * The document is opened once per attachment (and once more after a stamp, to
 * pick up the rewritten bytes); paging and resizing only re-render an already
 * parsed page rather than re-downloading the file.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import {
  fetchAttachmentBytes,
  addAnnotation,
  type LeadSheetAttachment,
} from '../api/leadSheetAttachments';
import { TICKMARK_COLOR_CLASSES, type Tickmark, type TickmarkColor } from '../api/tickmarks';
import { pushToast } from '../store/uiStore';
import { confirmAction } from './ConfirmDialog';

interface Props {
  attachment: LeadSheetAttachment;
  tickmarks: Tickmark[];
  onClose: () => void;
  onStamped: () => void;
}

/**
 * The pdf.js worker, fetched once and handed to pdfjs as a blob: URL.
 *
 * Loading it by its own https URL is what kept breaking in production with
 * "Setting up fake worker failed: Failed to fetch dynamically imported
 * module". The asset is a `.mjs`, a browser refuses to execute a module script
 * unless the Content-Type says JavaScript, and any browser that fetched it
 * while the server still answered `application/octet-stream` keeps that stored
 * Content-Type indefinitely: the entry revalidates with If-Modified-Since, and
 * a 304 carries no Content-Type to replace it with. Fixing the server (nginx
 * `location ~ \.mjs$`) therefore does NOT repair a browser that already cached
 * the bad response — the file has to be fetched under a different cache key,
 * or its type has to stop mattering.
 *
 * Re-wrapping the bytes in a Blob does the latter: what the server labelled the
 * response is irrelevant, only the bytes are used, and the worker is created
 * from an origin-local blob: URL, which pdf.js treats as same-origin and uses
 * verbatim.
 */
let workerSrcPromise: Promise<string> | null = null;

function loadWorkerSrc(): Promise<string> {
  workerSrcPromise ??= (async () => {
    // Vite rewrites this to the emitted asset URL at build time.
    const workerUrl = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default;
    try {
      const res = await fetch(workerUrl);
      if (!res.ok) throw new Error(`worker asset responded ${res.status}`);
      const bytes = await res.arrayBuffer();
      return URL.createObjectURL(new Blob([bytes], { type: 'text/javascript' }));
    } catch {
      // Blob workers are blocked by a `worker-src` CSP without `blob:`; fall
      // back to letting pdfjs load the asset by URL the ordinary way.
      return workerUrl;
    }
  })();
  return workerSrcPromise;
}

// Padding of the scroll container, so a fitted page doesn't touch the edges.
const PAGE_GUTTER = 32;

function fitScale(pageWidth: number, containerWidth: number): number {
  if (!containerWidth || !pageWidth) return 1.4;
  return Math.min(3, Math.max(0.5, (containerWidth - PAGE_GUTTER) / pageWidth));
}

export function LeadSheetPdfViewer({ attachment, tickmarks, onClose, onStamped }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null);
  const [pageNum, setPageNum] = useState(1);
  const [pageCount, setPageCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedMark, setSelectedMark] = useState<number | null>(null);
  const [note, setNote] = useState('');
  const [placing, setPlacing] = useState(false);
  const [containerWidth, setContainerWidth] = useState(0);
  // Bumped after a stamp so the document reloads from the updated bytes.
  const [version, setVersion] = useState(0);
  // pdfjs throws "Cannot use the same canvas during multiple render()
  // operations" if a second render starts while one is live — which happens on
  // a fast double Next, or when a resize lands mid-render.
  const renderTaskRef = useRef<{ cancel: () => void } | null>(null);

  // Fit the page to the width of the viewer. A vertical scrollbar appearing or
  // disappearing moves this by ~15px, so ignore small deltas: reacting to them
  // would let the scale oscillate between two values forever.
  useEffect(() => {
    const el = wrapRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width ?? 0;
      setContainerWidth((prev) => (Math.abs(w - prev) > 24 ? w : prev));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Open the document. Re-runs only for a different attachment or after a
  // stamp — not for paging or resizing.
  useEffect(() => {
    let cancelled = false;
    let task: { promise: Promise<PDFDocumentProxy>; destroy: () => Promise<void> } | null = null;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        // Lazy so pdfjs stays out of the initial bundle.
        const pdfjs = await import('pdfjs-dist');
        pdfjs.GlobalWorkerOptions.workerSrc = await loadWorkerSrc();
        const bytes = await fetchAttachmentBytes(attachment.id);
        if (cancelled) return;
        task = pdfjs.getDocument({ data: bytes });
        const loaded = await task.promise;
        if (cancelled) {
          void task.destroy();
          return;
        }
        setDoc(loaded);
        setPageCount(loaded.numPages);
        setPageNum((p) => Math.min(p, loaded.numPages));
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Could not open this PDF.');
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
      // Destroys the document AND terminates its worker; without this every
      // reload would leak a worker thread.
      void task?.destroy();
      setDoc(null);
    };
  }, [attachment.id, version]);

  // Render the current page at the current width.
  useEffect(() => {
    if (!doc) return;
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const page = await doc.getPage(Math.min(pageNum, doc.numPages));
        if (cancelled) return;
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext('2d');
        if (!canvas || !ctx) return;
        const viewport = page.getViewport({
          scale: fitScale(page.getViewport({ scale: 1 }).width, containerWidth),
        });
        canvas.width = viewport.width;
        canvas.height = viewport.height;

        renderTaskRef.current?.cancel();
        const task = page.render({ canvas, canvasContext: ctx, viewport });
        renderTaskRef.current = task;
        await task.promise;
        renderTaskRef.current = null;
      } catch (err) {
        // A cancelled render is expected, not a failure to surface.
        if ((err as { name?: string })?.name === 'RenderingCancelledException') return;
        if (!cancelled) setError(err instanceof Error ? err.message : 'Could not render this PDF.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
      renderTaskRef.current?.cancel();
      renderTaskRef.current = null;
    };
  }, [doc, pageNum, containerWidth]);

  const handleClick = useCallback(
    async (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (selectedMark === null || placing) return;
      const rect = e.currentTarget.getBoundingClientRect();
      const xPct = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
      const yPct = Math.min(1, Math.max(0, (e.clientY - rect.top) / rect.height));
      const mark = tickmarks.find((t) => t.id === selectedMark);

      const ok = await confirmAction({
        message: `Stamp "${mark?.symbol ?? ''}" here? Tickmarks are written into the stored PDF and cannot be removed.`,
        confirmLabel: 'Stamp',
      });
      if (!ok) return;

      setPlacing(true);
      const res = await addAnnotation(attachment.id, {
        page: pageNum,
        xPct,
        yPct,
        tickmarkId: selectedMark,
        note: note.trim() || undefined,
      });
      setPlacing(false);
      if (res.error) { pushToast(res.error.message, 'error'); return; }
      pushToast('Tickmark stamped.', 'success');
      setNote('');
      setVersion((v) => v + 1);
      onStamped();
    },
    [attachment.id, note, onStamped, pageNum, placing, selectedMark, tickmarks],
  );

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex">
      <div className="bg-white dark:bg-gray-800 shadow-xl w-full h-full flex flex-col">
        <div className="flex items-center justify-between px-5 py-3 border-b dark:border-gray-700">
          <div>
            <h2 className="text-base font-semibold dark:text-white">
              <span className="font-mono mr-2">{attachment.ref_code}</span>
              <span className="font-normal text-gray-500 dark:text-gray-400 text-sm">{attachment.source_file_name}</span>
            </h2>
          </div>
          <button onClick={onClose} aria-label="Close" className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 text-xl leading-none">&times;</button>
        </div>

        <div className="flex-1 min-h-0 flex">
          {/* Canvas */}
          <div ref={wrapRef} className="relative flex-1 overflow-auto bg-gray-100 dark:bg-gray-900 p-4 flex justify-center">
            {error ? (
              <p className="text-sm text-red-600 dark:text-red-400 self-center">{error}</p>
            ) : (
              <canvas
                ref={canvasRef}
                onClick={(e) => void handleClick(e)}
                className={`shadow-md bg-white max-w-full h-auto ${selectedMark !== null ? 'cursor-crosshair' : ''}`}
              />
            )}
            {loading && !error && (
              <p className="absolute inset-x-0 top-1/2 text-center text-sm text-gray-400">Rendering…</p>
            )}
          </div>

          {/* Palette */}
          <div className="w-60 shrink-0 border-l border-gray-200 dark:border-gray-700 p-4 space-y-4 overflow-y-auto">
            <div>
              <h3 className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase mb-2">Place a tickmark</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                Pick a mark, then click the page. Stamps are written into the stored PDF and
                <strong> cannot be removed</strong>.
              </p>
              <div className="flex flex-wrap gap-1.5">
                {tickmarks.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setSelectedMark(selectedMark === t.id ? null : t.id)}
                    title={t.description}
                    className={`w-8 h-8 rounded text-sm font-bold ${TICKMARK_COLOR_CLASSES[t.color as TickmarkColor] ?? TICKMARK_COLOR_CLASSES.gray} ${
                      selectedMark === t.id ? 'ring-2 ring-blue-500' : ''
                    }`}
                  >
                    {t.symbol}
                  </button>
                ))}
                {tickmarks.length === 0 && (
                  <p className="text-xs text-gray-400 dark:text-gray-500">No tickmarks defined for this client.</p>
                )}
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Note (optional)</label>
              <input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                maxLength={200}
                placeholder="Printed beside the mark"
                className="w-full border border-gray-300 dark:border-gray-600 rounded px-2 py-1.5 text-xs dark:bg-gray-700 dark:text-white"
              />
            </div>

            {attachment.annotations?.length > 0 && (
              <div>
                <h3 className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase mb-2">
                  Already stamped ({attachment.annotations.length})
                </h3>
                <ul className="space-y-1">
                  {attachment.annotations.map((a) => (
                    <li key={a.id} className="text-xs text-gray-600 dark:text-gray-400 flex items-center gap-1.5">
                      <span className={`inline-flex items-center justify-center w-5 h-5 rounded text-[10px] font-bold ${TICKMARK_COLOR_CLASSES[(a.color ?? 'gray') as TickmarkColor] ?? TICKMARK_COLOR_CLASSES.gray}`}>
                        {a.symbol}
                      </span>
                      p{a.page}
                      {a.note && <span className="truncate">— {a.note}</span>}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>

        <div className="px-5 py-3 border-t dark:border-gray-700 flex items-center gap-3">
          <button
            onClick={() => setPageNum((p) => Math.max(1, p - 1))}
            disabled={pageNum <= 1}
            className="px-2.5 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded disabled:opacity-40 dark:text-gray-300"
          >
            ← Prev
          </button>
          <span className="text-xs text-gray-600 dark:text-gray-400">
            Page {pageNum}{pageCount ? ` of ${pageCount}` : ''}
          </span>
          <button
            onClick={() => setPageNum((p) => (pageCount ? Math.min(pageCount, p + 1) : p))}
            disabled={!pageCount || pageNum >= pageCount}
            className="px-2.5 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded disabled:opacity-40 dark:text-gray-300"
          >
            Next →
          </button>
          {placing && <span className="text-xs text-gray-500 dark:text-gray-400">Stamping…</span>}
        </div>
      </div>
    </div>
  );
}
