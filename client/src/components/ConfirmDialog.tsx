// Copyright 2025-2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Use is limited to qualifying small businesses. See LICENSE for terms.

import { create } from 'zustand';
import { useEffect, useRef } from 'react';

// ── Store ────────────────────────────────────────────────────────────────────
// One modal instance lives in the app shell. Any code can call `confirmAction`
// to request a promise<boolean> — the user's choice. This avoids threading
// a confirm context through every page.

export interface ConfirmOptions {
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** 'danger' (red) for deletes/destroys; 'primary' (blue) for other. */
  tone?: 'danger' | 'primary';
}

interface PendingRequest extends ConfirmOptions {
  resolve: (v: boolean) => void;
}

interface ConfirmStore {
  pending: PendingRequest | null;
  request: (opts: ConfirmOptions) => Promise<boolean>;
  resolve: (v: boolean) => void;
}

export const useConfirmStore = create<ConfirmStore>()((set, get) => ({
  pending: null,
  request: (opts) =>
    new Promise<boolean>((resolve) => {
      set({ pending: { ...opts, resolve } });
    }),
  resolve: (v) => {
    const p = get().pending;
    if (!p) return;
    p.resolve(v);
    set({ pending: null });
  },
}));

/**
 * Drop-in replacement for window.confirm(). Returns a promise.
 *
 *   if (await confirmAction({ message: 'Delete this?', tone: 'danger' })) ...
 *
 * Keeps the call-site API nearly identical to the old `confirm()` pattern,
 * but the dialog is styled, dark-mode aware, and screen-reader friendly.
 */
export function confirmAction(opts: ConfirmOptions | string): Promise<boolean> {
  const normalized: ConfirmOptions = typeof opts === 'string' ? { message: opts } : opts;
  return useConfirmStore.getState().request(normalized);
}

// ── Component ────────────────────────────────────────────────────────────────

export function ConfirmDialog() {
  const pending = useConfirmStore((s) => s.pending);
  const resolve = useConfirmStore((s) => s.resolve);
  const confirmRef = useRef<HTMLButtonElement | null>(null);

  // Auto-focus the confirm button when the dialog opens so keyboard users can
  // hit Enter to accept or Esc to cancel without reaching for the mouse.
  useEffect(() => {
    if (pending) confirmRef.current?.focus();
  }, [pending]);

  useEffect(() => {
    if (!pending) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); resolve(false); }
      else if (e.key === 'Enter') { e.preventDefault(); resolve(true); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [pending, resolve]);

  if (!pending) return null;

  const tone = pending.tone ?? 'primary';
  const toneBtn =
    tone === 'danger'
      ? 'bg-red-600 hover:bg-red-700 text-white'
      : 'bg-blue-600 hover:bg-blue-700 text-white';

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
      className="fixed inset-0 bg-black/40 flex items-center justify-center z-[1100] p-4"
      onMouseDown={(e) => { if (e.target === e.currentTarget) resolve(false); }}
    >
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md">
        <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 id="confirm-dialog-title" className="text-base font-semibold text-gray-900 dark:text-white">
            {pending.title ?? (tone === 'danger' ? 'Confirm deletion' : 'Confirm')}
          </h2>
        </div>
        <div className="px-5 py-4 text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
          {pending.message}
        </div>
        <div className="px-5 py-3 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-2">
          <button
            onClick={() => resolve(false)}
            className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-700/50 text-gray-700 dark:text-gray-300"
          >
            {pending.cancelLabel ?? 'Cancel'}
          </button>
          <button
            ref={confirmRef}
            onClick={() => resolve(true)}
            className={`px-3 py-1.5 text-sm rounded ${toneBtn}`}
          >
            {pending.confirmLabel ?? (tone === 'danger' ? 'Delete' : 'Confirm')}
          </button>
        </div>
      </div>
    </div>
  );
}
