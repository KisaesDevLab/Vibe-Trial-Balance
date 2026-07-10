// Copyright 2025-2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Use is limited to qualifying small businesses. See LICENSE for terms.

import { useEffect } from 'react';
import { confirmAction } from '../components/ConfirmDialog';

/**
 * Guard an in-progress edit against tab close / refresh. When `dirty` is true,
 * the browser's standard "Leave site?" dialog fires on `beforeunload`.
 *
 * This is only the tab-close guard. For in-app navigation (react-router
 * clicks, back button) dialogs should offer their own Cancel-with-confirm
 * path — `confirmDiscard` is a small helper you can call on Cancel/X.
 */
export function useUnsavedGuard(dirty: boolean): void {
  useEffect(() => {
    if (!dirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      // Required for Chrome; the string is not shown by modern browsers.
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [dirty]);
}

/**
 * Prompt the user before discarding an in-progress edit. Returns a promise
 * that resolves to true if the user confirmed discard (or wasn't dirty), false
 * to keep the dialog open. Uses the app's styled ConfirmDialog.
 */
export async function confirmDiscard(dirty: boolean, message = 'Discard unsaved changes?'): Promise<boolean> {
  if (!dirty) return true;
  return confirmAction({
    title: 'Discard changes?',
    message,
    confirmLabel: 'Discard',
    cancelLabel: 'Keep editing',
    tone: 'danger',
  });
}
