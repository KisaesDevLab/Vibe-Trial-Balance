// Copyright 2025-2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Use is limited to qualifying small businesses. See LICENSE for terms.

/**
 * The circular-arrow beside a page title: refetch everything this page shows.
 *
 * It marks the WHOLE query cache stale and refetches every query currently
 * mounted (TanStack's default `refetchType: 'active'`), so no page has to
 * enumerate its own keys — the thing that let views go stale in the first
 * place was each mutation hand-picking which keys to invalidate. Queries on
 * other pages are only marked stale and refetch when next shown.
 *
 * The icon spins while ANY query is fetching, which doubles as a "data is
 * refreshing" hint for background refetches (tab focus, the 30 s stale window).
 */

import { useState } from 'react';
import { useIsFetching, useQueryClient } from '@tanstack/react-query';
import { pushToast } from '../store/uiStore';

interface RefreshButtonProps {
  className?: string;
  /** Tooltip / accessible name. */
  label?: string;
  /** Skip the confirmation toast (for a header that already reports fetch state). */
  silent?: boolean;
}

export function RefreshButton({ className = '', label = 'Refresh this page', silent = false }: RefreshButtonProps) {
  const qc = useQueryClient();
  const fetching = useIsFetching();
  const [busy, setBusy] = useState(false);
  const spinning = busy || fetching > 0;

  const refresh = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await qc.invalidateQueries();
      if (!silent) pushToast('Refreshed', 'success');
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      type="button"
      onClick={refresh}
      disabled={busy}
      title={label}
      aria-label={label}
      className={`inline-flex items-center justify-center align-middle ml-2 w-6 h-6 rounded text-gray-400 hover:text-gray-700 hover:bg-gray-100 dark:text-gray-500 dark:hover:text-gray-200 dark:hover:bg-gray-700 disabled:opacity-60 disabled:cursor-default ${className}`}
    >
      <svg
        className={`w-4 h-4 ${spinning ? 'animate-spin' : ''}`}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M21 12a9 9 0 1 1-2.64-6.36" />
        <polyline points="21 3 21 9 15 9" />
      </svg>
    </button>
  );
}
