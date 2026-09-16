// Copyright 2025-2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Use is limited to qualifying small businesses. See LICENSE for terms.

/**
 * A small accessible dialog: labelled, Escape closes, backdrop click closes,
 * the first focusable control gets focus on open. Same shell as the local
 * Modal on the Users page.
 */

import { useEffect, useId, useRef, type ReactNode } from 'react';

interface Props {
  title: string;
  children: ReactNode;
  onClose: () => void;
  size?: 'md' | 'lg';
}

export function Modal({ title, children, onClose, size = 'md' }: Props) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    const first = panelRef.current?.querySelector<HTMLElement>('input, button:not([aria-label="Close"]), select, textarea, [tabindex]:not([tabindex="-1"])');
    first?.focus();
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={`bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full ${size === 'lg' ? 'max-w-lg' : 'max-w-md'}`}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b dark:border-gray-700">
          <h2 id={titleId} className="text-base font-semibold dark:text-white">{title}</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 text-xl leading-none">&times;</button>
        </div>
        <div className="px-5 py-4">{children}</div>
      </div>
    </div>
  );
}
