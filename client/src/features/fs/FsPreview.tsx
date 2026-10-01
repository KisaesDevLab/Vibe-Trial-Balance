// Copyright 2025-2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Use is limited to qualifying small businesses. See LICENSE for terms.

// Right-hand preview for the statement editor. "Live" renders the engine's
// HTML — paper-sized sheets — in a sandboxed, script-free iframe (fonts come
// from the public /fs-fonts route); "Exact PDF" asks the server for the real
// PDF of the unsaved draft and draws it with pdf.js, so page breaks, table of
// contents page numbers and embedded fonts are exactly what prints.

import { useEffect, useRef, useState } from 'react';
import { Spinner } from '../../components/Spinner';
import { loadPdfWorkerSrc } from '../../utils/pdfjsWorker';

export function FsLivePreview({ html }: { html: string }) {
  const ref = useRef<HTMLIFrameElement>(null);
  const scroll = useRef(0);
  const [doc, setDoc] = useState(html);
  // Debounce re-renders while typing; keep the reader's scroll position.
  useEffect(() => {
    const t = setTimeout(() => {
      scroll.current = ref.current?.contentWindow?.scrollY ?? scroll.current;
      setDoc(html);
    }, 150);
    return () => clearTimeout(t);
  }, [html]);
  return (
    <iframe
      ref={ref}
      title="Financial statements preview"
      className="w-full h-full border-0 bg-gray-200"
      // No allow-scripts: the document is engine-built HTML plus the firm's
      // letter, and nothing in it may run. allow-same-origin is what lets the
      // parent restore the scroll position.
      sandbox="allow-same-origin"
      srcDoc={doc}
      onLoad={() => ref.current?.contentWindow?.scrollTo(0, scroll.current)}
    />
  );
}

export interface PdfProofState { blob: Blob | null; loading: boolean; error: string | null }

export function FsPdfProof({ blob, loading, error }: PdfProofState) {
  const container = useRef<HTMLDivElement>(null);
  const [pages, setPages] = useState(0);
  const [renderError, setRenderError] = useState<string | null>(null);

  useEffect(() => {
    const host = container.current;
    if (!host) return;
    host.innerHTML = '';
    setPages(0);
    setRenderError(null);
    if (!blob) return;
    let cancelled = false;
    let task: { destroy: () => Promise<void> } | null = null;
    (async () => {
      // Lazy, so pdf.js stays out of the initial bundle (and out of this
      // editor's chunk until someone asks for the proof).
      const pdfjs = await import('pdfjs-dist');
      pdfjs.GlobalWorkerOptions.workerSrc = await loadPdfWorkerSrc();
      const loadingTask = pdfjs.getDocument({ data: await blob.arrayBuffer() });
      task = loadingTask;
      const loaded = await loadingTask.promise;
      if (cancelled) return;
      setPages(loaded.numPages);
      for (let i = 1; i <= loaded.numPages; i++) {
        const page = await loaded.getPage(i);
        if (cancelled) return;
        const viewport = page.getViewport({ scale: 1.3 });
        const canvas = document.createElement('canvas');
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        canvas.className = 'mx-auto mb-6 shadow bg-white max-w-full';
        host.appendChild(canvas);
        await page.render({ canvas, canvasContext: canvas.getContext('2d')!, viewport }).promise;
      }
    })().catch((e: unknown) => {
      if (!cancelled) setRenderError(e instanceof Error ? e.message : 'Could not display the PDF.');
    });
    return () => {
      cancelled = true;
      // Destroys the document AND terminates its worker; without this every
      // refresh would leak a worker thread.
      void task?.destroy();
    };
  }, [blob]);

  const shown = error ?? renderError;
  return (
    <div className="h-full overflow-y-auto bg-gray-200 p-6">
      {loading && <div className="flex justify-center py-16"><Spinner size="lg" /></div>}
      {shown && <div className="mx-auto max-w-xl rounded-md bg-red-50 border border-red-200 p-3 text-sm text-red-700">{shown}</div>}
      {!loading && !shown && pages > 0 && <p className="text-center text-xs text-gray-600 mb-3">{pages} page{pages === 1 ? '' : 's'} — exactly as the PDF will print</p>}
      <div ref={container} />
    </div>
  );
}
