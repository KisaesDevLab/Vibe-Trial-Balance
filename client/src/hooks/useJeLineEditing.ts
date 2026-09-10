// Copyright 2025-2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Use is limited to qualifying small businesses. See LICENSE for terms.

import { useCallback, useRef } from 'react';
import { balancingPlug, centsToAmountInput, type JeLineInput } from '../utils/jeLines';

/**
 * Shared keyboard/mouse ergonomics for the journal-entry line editors
 * (New JE dialog, Edit JE dialog, and both forms on the Journal Entries page).
 *
 * Two behaviours, both driven from the line table:
 *
 *  1. `focusDebit(idx)` — after an account is committed in the row's dropdown
 *     (click or Enter), focus lands on that row's Debit box with its text
 *     selected, so the amount can be typed straight away. Rows are addressed
 *     through a `data-je-debit` attribute rather than a ref-per-row: the
 *     dialogs key rows by a stable `_key`, so an index-keyed ref map would go
 *     stale after a mid-edit row removal.
 *
 *  2. `fillBalance(lines, setLines)` — the plug. Puts whatever the entry is out
 *     of balance by onto the LAST row, in whichever column brings debits and
 *     credits level, clearing the opposite column. The last row's own amounts
 *     are excluded from that arithmetic, so the result is idempotent: clicking
 *     twice lands on the same figure instead of doubling it. When the other
 *     rows already foot, the last row IS the imbalance, so it is cleared.
 *
 * `focusDebit` defers to the next frame because the selection unmounts the
 * dropdown; focusing before React commits that removal would hand focus back
 * to <body> when the highlighted option disappears.
 */
export function useJeLineEditing<T extends JeLineInput>() {
  const linesBodyRef = useRef<HTMLTableSectionElement>(null);

  const focusDebit = useCallback((idx: number) => {
    requestAnimationFrame(() => {
      const el = linesBodyRef.current?.querySelector<HTMLInputElement>(
        `input[data-je-debit="${idx}"]`,
      );
      if (!el) return;
      el.focus();
      el.select();
    });
  }, []);

  const fillBalance = useCallback(
    (lines: T[], setLines: (updater: (prev: T[]) => T[]) => void) => {
      const idx = lines.length - 1;
      if (idx < 0) return;
      const plug = balancingPlug(lines, idx);
      const amount = plug ? centsToAmountInput(plug.cents) : '';
      setLines((prev) =>
        prev.map((l, i) =>
          i === idx
            ? {
                ...l,
                debit: plug?.side === 'debit' ? amount : '',
                credit: plug?.side === 'credit' ? amount : '',
              }
            : l,
        ),
      );
    },
    [],
  );

  return { linesBodyRef, focusDebit, fillBalance };
}
