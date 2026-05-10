// Copyright 2025-2026 Kisaes LLC
// Licensed under the PolyForm Internal Use License 1.0.0.
// You may not distribute this software. See LICENSE for terms.

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// Font size range: 11–36px, default 16, step 2 above 18
const MIN_FONT = 11;
const MAX_FONT = 36;

export interface AuthUser {
  id: number;
  username: string;
  displayName: string;
  email?: string | null;
  role: string;
  mustChangePassword?: boolean;
}

interface AuthStore {
  token: string | null;
  user: AuthUser | null;
  setAuth: (token: string, user: AuthUser) => void;
  clearAuth: () => void;
}

export const useAuthStore = create<AuthStore>()(
  persist(
    (set) => ({
      token: null,
      user: null,
      setAuth: (token, user) => set({ token, user }),
      clearAuth: () => set({ token: null, user: null }),
    }),
    { name: 'auth' },
  ),
);

interface UIStore {
  selectedClientId: number | null;
  setSelectedClientId: (id: number | null) => void;
  selectedPeriodId: number | null;
  setSelectedPeriodId: (id: number | null) => void;
  fontSize: number;
  increaseFontSize: () => void;
  decreaseFontSize: () => void;
  isDarkMode: boolean;
  toggleDarkMode: () => void;
}

export const useUIStore = create<UIStore>()(
  persist(
    (set) => ({
      selectedClientId: null,
      setSelectedClientId: (id) => set({ selectedClientId: id, selectedPeriodId: null }),
      selectedPeriodId: null,
      setSelectedPeriodId: (id) => set({ selectedPeriodId: id }),
      fontSize: 16,
      increaseFontSize: () => set((s) => {
        const step = s.fontSize >= 18 ? 2 : 1;
        return { fontSize: Math.min(MAX_FONT, s.fontSize + step) };
      }),
      decreaseFontSize: () => set((s) => {
        const step = s.fontSize > 18 ? 2 : 1;
        return { fontSize: Math.max(MIN_FONT, s.fontSize - step) };
      }),
      isDarkMode: false,
      toggleDarkMode: () => set((s) => ({ isDarkMode: !s.isDarkMode })),
    }),
    { name: 'ui-prefs', partialize: (s) => ({ fontSize: s.fontSize, selectedClientId: s.selectedClientId, selectedPeriodId: s.selectedPeriodId, isDarkMode: s.isDarkMode }) },
  ),
);

// ── Global toast queue ──────────────────────────────────────────────────────
// Every mutation error is surfaced here. The Toaster component (rendered once
// at app root) listens and shows each toast for ~5s. Zustand store rather than
// context so non-component code (apiFetch fallbacks, QueryClient onError) can
// enqueue without a hook.

export type ToastType = 'success' | 'error' | 'info';

export interface ToastItem {
  id: number;
  type: ToastType;
  message: string;
}

interface ToastStore {
  items: ToastItem[];
  push: (message: string, type?: ToastType) => void;
  dismiss: (id: number) => void;
}

let __toastCounter = 0;
export const useToastStore = create<ToastStore>()((set) => ({
  items: [],
  push: (message, type = 'info') => {
    const id = ++__toastCounter;
    set((s) => ({ items: [...s.items, { id, type, message }] }));
    setTimeout(() => set((s) => ({ items: s.items.filter((t) => t.id !== id) })), 5000);
  },
  dismiss: (id) => set((s) => ({ items: s.items.filter((t) => t.id !== id) })),
}));

/** Enqueue a toast from outside React (e.g. QueryClient default handlers). */
export function pushToast(message: string, type: ToastType = 'info'): void {
  useToastStore.getState().push(message, type);
}
