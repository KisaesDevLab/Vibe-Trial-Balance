// Copyright 2025-2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Use is limited to qualifying small businesses. See LICENSE for terms.

/**
 * Attachment viewer with three annotation tools: click-to-place tickmark
 * stamps, click-to-place text notes, and drag-to-draw lines.
 *
 * Two consequences of annotations being burned into the stored file:
 *   - Existing marks arrive as page CONTENT, already drawn. There is no overlay
 *     of previous annotations to render or remove — only the pending one (the
 *     line being dragged) is drawn on the SVG overlay, and it disappears the
 *     moment the re-rendered page carries the real ink.
 *   - Placing anything is permanent, so it takes a confirmation and there is no
 *     per-item delete control.
 *
 * pdfjs is imported lazily inside the effect, and this whole component is
 * lazy-loaded by its caller: a top-level import would add ~1 MB to the initial
 * bundle for a feature most page loads never touch.
 *
 * The document is opened once per attachment (and once more after a stamp, to
 * pick up the rewritten bytes); paging and resizing only re-render an already
 * parsed page rather than re-downloading the file.
 */

import { useEffect, useRef, useState } from 'react';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import {
  fetchAttachmentBytes,
  addAnnotation,
  MAX_NOTE_TEXT,
  type AddAnnotationInput,
  type AnnotationColor,
  type AttachmentAnnotation,
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

type Tool = 'tickmark' | 'note' | 'line';

const TOOLS: Array<{ id: Tool; label: string }> = [
  { id: 'tickmark', label: 'Tickmark' },
  { id: 'note', label: 'Note' },
  { id: 'line', label: 'Line' },
];

const COLORS: AnnotationColor[] = ['red', 'blue', 'green', 'purple', 'amber', 'gray'];

/** Preview stroke colours for the SVG overlay — the PDF uses its own RGB table. */
const SVG_STROKE: Record<AnnotationColor, string> = {
  gray: '#595959', blue: '#1f61d9', green: '#178c45', red: '#db2626', purple: '#7d3bd4', amber: '#c9800d',
};

const STROKES: Array<{ label: string; width: number }> = [
  { label: 'Thin', width: 1 },
  { label: 'Medium', width: 2 },
  { label: 'Thick', width: 3.5 },
];

/** Drags shorter than this (fraction of the page) are treated as accidental clicks. */
const MIN_LINE_LENGTH = 0.01;

interface Pt { x: number; y: number }
interface Drag { start: Pt; end: Pt }

function describe(a: AttachmentAnnotation): { label: string; detail: string | null } {
  switch (a.kind ?? 'tickmark') {
    case 'note': {
      const text = (a as { text: string }).text;
      return { label: 'Note', detail: text };
    }
    case 'line':
      return { label: 'Line', detail: null };
    default: {
      const t = a as { symbol: string; note: string | null };
      return { label: t.symbol, detail: t.note };
    }
  }
}

export function LeadSheetPdfViewer({ attachment, tickmarks, onClose, onStamped }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const pageRef = useRef<HTMLDivElement | null>(null);
  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null);
  const [pageNum, setPageNum] = useState(1);
  const [pageCount, setPageCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tool, setTool] = useState<Tool>('tickmark');
  const [selectedMark, setSelectedMark] = useState<number | null>(null);
  const [note, setNote] = useState('');
  const [noteText, setNoteText] = useState('');
  const [color, setColor] = useState<AnnotationColor>('red');
  const [strokeWidth, setStrokeWidth] = useState(STROKES[1].width);
  const [drag, setDrag] = useState<Drag | null>(null);
  const [placing, setPlacing] = useState(false);
  const [containerWidth, setContainerWidth] = useState(0);
  // Bumped after a burn so the document reloads from the updated bytes.
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

  /** Pointer position as a 0..1 fraction of the displayed page. */
  const toPct = (e: { clientX: number; clientY: number }): Pt => {
    const rect = pageRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0 || rect.height === 0) return { x: 0, y: 0 };
    return {
      x: Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width)),
      y: Math.min(1, Math.max(0, (e.clientY - rect.top) / rect.height)),
    };
  };

  const burn = async (input: AddAnnotationInput, successMessage: string): Promise<boolean> => {
    setPlacing(true);
    const res = await addAnnotation(attachment.id, input);
    setPlacing(false);
    if (res.error) { pushToast(res.error.message, 'error'); return false; }
    pushToast(successMessage, 'success');
    setVersion((v) => v + 1);
    onStamped();
    return true;
  };

  const placeTickmark = async (p: Pt) => {
    if (selectedMark === null) return;
    const mark = tickmarks.find((t) => t.id === selectedMark);
    const ok = await confirmAction({
      message: `Stamp "${mark?.symbol ?? ''}" here? Tickmarks are written into the stored PDF and cannot be removed.`,
      confirmLabel: 'Stamp',
    });
    if (!ok) return;
    const done = await burn(
      { kind: 'tickmark', page: pageNum, xPct: p.x, yPct: p.y, tickmarkId: selectedMark, note: note.trim() || undefined },
      'Tickmark stamped.',
    );
    if (done) setNote('');
  };

  const placeNote = async (p: Pt) => {
    const text = noteText.trim();
    if (!text) { pushToast('Type the note first, then click where it goes.', 'error'); return; }
    const ok = await confirmAction({
      message: `Add this note here? Notes are written into the stored PDF and cannot be removed.\n\n“${text.length > 120 ? `${text.slice(0, 120)}…` : text}”`,
      confirmLabel: 'Add note',
    });
    if (!ok) return;
    const done = await burn(
      { kind: 'note', page: pageNum, xPct: p.x, yPct: p.y, text, color },
      'Note added.',
    );
    if (done) setNoteText('');
  };

  const placeLine = async (d: Drag) => {
    const ok = await confirmAction({
      message: 'Draw this line? Lines are written into the stored PDF and cannot be removed.',
      confirmLabel: 'Draw',
    });
    if (!ok) return;
    await burn(
      { kind: 'line', page: pageNum, xPct: d.start.x, yPct: d.start.y, x2Pct: d.end.x, y2Pct: d.end.y, strokeWidth, color },
      'Line drawn.',
    );
  };

  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (placing || loading) return;
    if (tool === 'tickmark') void placeTickmark(toPct(e));
    else if (tool === 'note') void placeNote(toPct(e));
    // Lines are placed on pointer up, not click.
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (tool !== 'line' || placing || loading || e.button !== 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const p = toPct(e);
    setDrag({ start: p, end: p });
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!drag) return;
    setDrag({ start: drag.start, end: toPct(e) });
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!drag) return;
    e.currentTarget.releasePointerCapture(e.pointerId);
    const finished = { start: drag.start, end: toPct(e) };
    setDrag(null);
    const len = Math.hypot(finished.end.x - finished.start.x, finished.end.y - finished.start.y);
    if (len < MIN_LINE_LENGTH) return;
    void placeLine(finished);
  };

  const armed =
    (tool === 'tickmark' && selectedMark !== null) ||
    (tool === 'note' && noteText.trim().length > 0) ||
    tool === 'line';

  const annotationCount = attachment.annotations?.length ?? 0;

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
          {/* Page */}
          <div ref={wrapRef} className="relative flex-1 overflow-auto bg-gray-100 dark:bg-gray-900 p-4 flex justify-center">
            {error ? (
              <p className="text-sm text-red-600 dark:text-red-400 self-center">{error}</p>
            ) : (
              // self-start: with the default `stretch` the wrapper would grow to
              // the container's height and the overlay would sit taller than the
              // page it is meant to cover.
              <div
                ref={pageRef}
                onClick={handleClick}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerCancel={() => setDrag(null)}
                className={`relative self-start max-w-full shadow-md bg-white select-none ${armed ? 'cursor-crosshair' : ''} ${
                  drag ? 'touch-none' : ''
                }`}
              >
                <canvas ref={canvasRef} className="block max-w-full h-auto" />
                {/* Pending-line preview. Percent viewBox so the drag maps 1:1
                    onto the page whatever size the canvas is displayed at. */}
                {drag && (
                  <svg
                    className="absolute inset-0 w-full h-full pointer-events-none"
                    viewBox="0 0 100 100"
                    preserveAspectRatio="none"
                  >
                    <line
                      x1={drag.start.x * 100} y1={drag.start.y * 100}
                      x2={drag.end.x * 100} y2={drag.end.y * 100}
                      stroke={SVG_STROKE[color]}
                      strokeWidth={strokeWidth * 1.4}
                      strokeLinecap="round"
                      vectorEffect="non-scaling-stroke"
                    />
                  </svg>
                )}
              </div>
            )}
            {loading && !error && (
              <p className="absolute inset-x-0 top-1/2 text-center text-sm text-gray-400">Rendering…</p>
            )}
          </div>

          {/* Palette */}
          <div className="w-64 shrink-0 border-l border-gray-200 dark:border-gray-700 p-4 space-y-4 overflow-y-auto">
            <div>
              <h3 className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase mb-2">Annotate</h3>
              <div className="flex rounded border border-gray-300 dark:border-gray-600 overflow-hidden text-xs">
                {TOOLS.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => { setTool(t.id); setDrag(null); }}
                    className={`flex-1 py-1.5 ${
                      tool === t.id
                        ? 'bg-blue-600 text-white'
                        : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600'
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                {tool === 'tickmark' && 'Pick a mark, then click the page.'}
                {tool === 'note' && 'Type the note, then click where its top-left corner goes.'}
                {tool === 'line' && 'Press and drag on the page to draw a straight line.'}
                {' '}Annotations are written into the stored PDF and <strong>cannot be removed</strong>.
              </p>
            </div>

            {tool === 'tickmark' && (
              <>
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
                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Caption (optional)</label>
                  <input
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    maxLength={200}
                    placeholder="Printed beside the mark"
                    className="w-full border border-gray-300 dark:border-gray-600 rounded px-2 py-1.5 text-xs dark:bg-gray-700 dark:text-white"
                  />
                </div>
              </>
            )}

            {tool === 'note' && (
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Note text</label>
                <textarea
                  value={noteText}
                  onChange={(e) => setNoteText(e.target.value.slice(0, MAX_NOTE_TEXT))}
                  rows={5}
                  placeholder="e.g. Agreed to bank statement; see A002."
                  className="w-full border border-gray-300 dark:border-gray-600 rounded px-2 py-1.5 text-xs dark:bg-gray-700 dark:text-white resize-y"
                />
                <p className="text-[10px] text-gray-400 dark:text-gray-500 text-right">{noteText.length}/{MAX_NOTE_TEXT}</p>
              </div>
            )}

            {tool === 'line' && (
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Thickness</label>
                <div className="flex rounded border border-gray-300 dark:border-gray-600 overflow-hidden text-xs">
                  {STROKES.map((s) => (
                    <button
                      key={s.width}
                      onClick={() => setStrokeWidth(s.width)}
                      className={`flex-1 py-1.5 ${
                        strokeWidth === s.width
                          ? 'bg-gray-700 text-white dark:bg-gray-200 dark:text-gray-900'
                          : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600'
                      }`}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {tool !== 'tickmark' && (
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Colour</label>
                <div className="flex flex-wrap gap-1.5">
                  {COLORS.map((c) => (
                    <button
                      key={c}
                      onClick={() => setColor(c)}
                      title={c}
                      aria-label={c}
                      aria-pressed={color === c}
                      className={`w-7 h-7 rounded-full border-2 ${
                        color === c ? 'border-blue-500 ring-2 ring-blue-300' : 'border-transparent'
                      }`}
                      style={{ backgroundColor: SVG_STROKE[c] }}
                    />
                  ))}
                </div>
              </div>
            )}

            {annotationCount > 0 && (
              <div>
                <h3 className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase mb-2">
                  Already on this file ({annotationCount})
                </h3>
                <ul className="space-y-1">
                  {attachment.annotations.map((a) => {
                    const { label, detail } = describe(a);
                    const isTick = (a.kind ?? 'tickmark') === 'tickmark';
                    return (
                      <li key={a.id} className="text-xs text-gray-600 dark:text-gray-400 flex items-center gap-1.5 min-w-0">
                        <span
                          className={`inline-flex items-center justify-center shrink-0 h-5 rounded text-[10px] font-bold ${
                            isTick ? 'w-5' : 'px-1.5'
                          } ${TICKMARK_COLOR_CLASSES[(a.color ?? 'gray') as TickmarkColor] ?? TICKMARK_COLOR_CLASSES.gray}`}
                        >
                          {label}
                        </span>
                        <span className="shrink-0">p{a.page}</span>
                        {detail && <span className="truncate" title={detail}>— {detail}</span>}
                      </li>
                    );
                  })}
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
          {placing && <span className="text-xs text-gray-500 dark:text-gray-400">Saving…</span>}
        </div>
      </div>
    </div>
  );
}
