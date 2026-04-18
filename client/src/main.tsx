// Copyright 2025-2026 Kisaes LLC
// Licensed under the PolyForm Internal Use License 1.0.0.
// You may not distribute this software. See LICENSE for terms.

import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClient, QueryClientProvider, MutationCache, QueryCache } from '@tanstack/react-query';
import App from './App';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Toaster } from './components/Toaster';
import { ConfirmDialog } from './components/ConfirmDialog';
import { pushToast } from './store/uiStore';
import './index.css';

// Extract a human-readable message from either an ApiResult-shaped response or
// a thrown Error. Callers opt out by passing `{ showErrorToast: false }` in
// their mutation `meta`.
function messageFromResult(result: unknown): string | null {
  if (result && typeof result === 'object' && 'error' in result) {
    const err = (result as { error: { message?: string } | null }).error;
    if (err && typeof err.message === 'string') return err.message;
  }
  return null;
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 5 * 60 * 1000,
    },
    mutations: {
      // Suppress only by opting in via mutation.meta. Default is: surface.
    },
  },
  // Surface server-returned errors as toasts when the mutation didn't handle
  // them itself. Two paths:
  //   1. mutationFn rejected → onError fires → show rejection message
  //   2. mutationFn resolved with ApiResult { error: ... } → onSuccess fires
  //      here; if mutation didn't flag meta.handlesError, show toast.
  mutationCache: new MutationCache({
    onError: (error, _variables, _context, mutation) => {
      if (mutation.meta?.suppressErrorToast) return;
      const msg = error instanceof Error ? error.message : String(error);
      pushToast(msg || 'Something went wrong.', 'error');
    },
    onSuccess: (data, _variables, _context, mutation) => {
      if (mutation.meta?.suppressErrorToast) return;
      const apiErr = messageFromResult(data);
      if (apiErr) pushToast(apiErr, 'error');
    },
  }),
  queryCache: new QueryCache({
    // Don't toast every failed query — pages typically render their own
    // error state. Just log so we can diagnose. If a query really needs a
    // toast it can call pushToast explicitly.
    onError: (err) => {
      console.error('[query]', err);
    },
  }),
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <App />
        <Toaster />
        <ConfirmDialog />
      </QueryClientProvider>
    </ErrorBoundary>
  </React.StrictMode>,
);
