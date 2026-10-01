// Copyright 2025-2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Use is limited to qualifying small businesses. See LICENSE for terms.

/**
 * Settings → PDF engine (admin). The Statement Writer prints its PDFs with
 * the Chromium installed on the server (see server/src/lib/fs/pdfBrowser.ts).
 * This card shows whether one was found and lets the admin point at it — a
 * self-hosted firm will not edit an environment file. Leaving the path blank
 * means auto-detect.
 */

import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { fsApi, fsErrorMessage } from '../api/fs';
import { pushToast } from '../store/uiStore';

const inputCls =
  'w-full border border-gray-300 dark:border-gray-600 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white';

const SOURCE_LABEL = { setting: 'set here', env: 'from the server environment', detected: 'found automatically' } as const;

export function PdfEngineCard() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['fs-status'], queryFn: fsApi.status });
  const engine = q.data?.pdfEngine;
  const [path, setPath] = useState('');
  // The field shows only a path the admin SET; an auto-detected one is shown as status.
  const stored = engine?.source === 'setting' || (!engine?.available && engine?.source === null) ? engine?.configuredPath ?? '' : '';
  useEffect(() => { setPath(stored); }, [stored]);

  const save = useMutation({
    mutationFn: () => fsApi.setPdfEnginePath(path.trim() || null),
    onSuccess: (r) => {
      qc.setQueryData(['fs-status'], r);
      pushToast(r.pdfEngine.available ? 'PDF engine found' : 'Saved, but no Chromium was found there', r.pdfEngine.available ? 'success' : 'error');
    },
    onError: (e) => pushToast(fsErrorMessage(e, 'Save failed'), 'error'),
  });
  const test = useMutation({
    mutationFn: fsApi.testPdfEngine,
    onSuccess: (r) => pushToast(`The PDF engine works (printed a ${Math.round(r.bytes / 1024)} KB test page)`, 'success'),
    onError: (e) => pushToast(fsErrorMessage(e, 'The PDF engine test failed'), 'error'),
  });

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 px-5 py-4">
      <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-1">PDF engine</h3>
      <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
        The Statement Writer prints its PDFs with the Chromium browser installed on the server, so the PDF matches the on-screen preview.
        Every other report, and the Statement Writer&apos;s Word and Excel copies, work without it.
      </p>
      {q.isLoading ? <p className="text-sm text-gray-500 dark:text-gray-400">Checking…</p> : q.isError || !engine ? (
        <p className="text-sm text-red-600">{fsErrorMessage(q.error, 'Could not check the PDF engine.')}</p>
      ) : (
        <>
          <div className={`rounded-md px-3 py-2 text-sm mb-3 ${engine.available
            ? 'bg-green-50 text-green-800 dark:bg-green-900/30 dark:text-green-300'
            : 'bg-amber-50 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300'}`}>
            {engine.available
              ? <>Ready — <span className="font-mono text-xs break-all">{engine.path}</span> ({engine.source ? SOURCE_LABEL[engine.source] : ''})</>
              : engine.message}
          </div>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1" htmlFor="fs-chromium-path">Path to Chromium or Chrome (optional)</label>
          <input id="fs-chromium-path" className={`${inputCls} font-mono`} placeholder="Blank = find it automatically" value={path} onChange={(e) => setPath(e.target.value)} />
          <div className="mt-3 flex gap-2">
            <button onClick={() => save.mutate()} disabled={save.isPending || path.trim() === stored}
              className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50">{save.isPending ? 'Saving…' : 'Save'}</button>
            <button onClick={() => test.mutate()} disabled={test.isPending || !engine.available}
              className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-700/50 dark:text-gray-300 disabled:opacity-50">{test.isPending ? 'Printing a test page…' : 'Test'}</button>
          </div>
        </>
      )}
    </div>
  );
}
