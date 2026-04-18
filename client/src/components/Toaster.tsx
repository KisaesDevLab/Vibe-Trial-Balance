// Copyright 2025-2026 Kisaes LLC
// Licensed under the PolyForm Internal Use License 1.0.0.
// You may not distribute this software. See LICENSE for terms.

import { useToastStore } from '../store/uiStore';

export function Toaster() {
  const items = useToastStore((s) => s.items);
  const dismiss = useToastStore((s) => s.dismiss);

  if (items.length === 0) return null;

  return (
    <div
      aria-live="polite"
      aria-atomic="true"
      className="fixed top-4 right-4 z-[1000] flex flex-col gap-2 max-w-sm w-full pointer-events-none"
    >
      {items.map((t) => {
        const base = 'pointer-events-auto rounded-lg shadow-lg px-4 py-3 text-sm flex items-start gap-3';
        const tone =
          t.type === 'error'
            ? 'bg-red-600 text-white'
            : t.type === 'success'
              ? 'bg-green-600 text-white'
              : 'bg-gray-800 text-white dark:bg-gray-700';
        return (
          <div key={t.id} className={`${base} ${tone}`} role={t.type === 'error' ? 'alert' : 'status'}>
            <span className="flex-1 break-words">{t.message}</span>
            <button
              onClick={() => dismiss(t.id)}
              aria-label="Dismiss notification"
              className="text-white/80 hover:text-white text-lg leading-none -mt-0.5"
            >
              &times;
            </button>
          </div>
        );
      })}
    </div>
  );
}
