// Copyright 2025-2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Use is limited to qualifying small businesses. See LICENSE for terms.

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/**
 * Unsaved Transaction Entry rows, kept in browser storage so that leaving the
 * page (or a scanned-sheet import followed by a detour to another screen) does
 * not silently discard work. Nothing here is written to the server — the
 * register's Save is still the only path that posts a transaction; this is
 * the draft that survives until then.
 *
 * Keyed per client + period, because the register itself is: a draft typed
 * against one period must not surface under another.
 */
export interface RegisterDraftRow {
  sourceAccountId: number | null;
  date: string;
  ref: string;
  payee: string;
  accountId: number | null;
  amountStr: string;
}

interface RegisterDraftStore {
  drafts: Record<string, RegisterDraftRow[]>;
  setDrafts: (key: string, rows: RegisterDraftRow[]) => void;
  clearDrafts: (key: string) => void;
}

export const draftKey = (clientId: number, periodId: number | null): string =>
  `${clientId}:${periodId ?? 'none'}`;

export const useRegisterDraftStore = create<RegisterDraftStore>()(
  persist(
    (set) => ({
      drafts: {},
      setDrafts: (key, rows) =>
        set((s) => {
          if (rows.length === 0) {
            if (!(key in s.drafts)) return s;
            const { [key]: _gone, ...rest } = s.drafts;
            return { drafts: rest };
          }
          return { drafts: { ...s.drafts, [key]: rows } };
        }),
      clearDrafts: (key) =>
        set((s) => {
          if (!(key in s.drafts)) return s;
          const { [key]: _gone, ...rest } = s.drafts;
          return { drafts: rest };
        }),
    }),
    { name: 'register-drafts' },
  ),
);
