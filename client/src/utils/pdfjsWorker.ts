// Copyright 2025-2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Use is limited to qualifying small businesses. See LICENSE for terms.

/**
 * Where pdf.js loads its worker from. Shared by every pdf.js viewer in the
 * app (the lead sheet attachment viewer, the Statement Writer's exact-PDF
 * proof) so there is one worker URL per page load.
 *
 * The worker asset is a `.mjs`. A browser that once received it with the
 * wrong Content-Type keeps that stored type forever: the cache entry is
 * revalidated with If-Modified-Since, and a 304 carries no Content-Type to
 * replace it with — so fixing the server (the `\.mjs$` location in both
 * nginx configs) is not enough for an already-poisoned browser. Fetching the
 * bytes and re-wrapping them in a Blob makes the server's label irrelevant:
 * pdf.js gets an origin-local blob: URL, which it treats as same-origin and
 * uses verbatim. Keep both — the nginx block is what a fresh browser needs,
 * the blob is what a poisoned one needs.
 *
 * Callers must import pdf.js itself lazily (`await import('pdfjs-dist')`
 * inside an effect, in a component that is itself React.lazy): a top-level
 * import would add ~1 MB to the initial bundle.
 */
let workerSrcPromise: Promise<string> | null = null;

export function loadPdfWorkerSrc(): Promise<string> {
  workerSrcPromise ??= (async () => {
    // Vite rewrites this to the emitted asset URL at build time.
    const workerUrl = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default;
    // The Vite dev server rewrites modules it serves (it injects an import of
    // /@vite/client), and an import with a root-relative specifier cannot
    // resolve from a blob: URL. Dev has no stale-cache problem to work
    // around, so let pdf.js load the worker by its URL there.
    if (import.meta.env.DEV) return workerUrl;
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
