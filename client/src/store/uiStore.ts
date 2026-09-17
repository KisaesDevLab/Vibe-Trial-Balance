// Copyright 2025-2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Use is limited to qualifying small businesses. See LICENSE for terms.

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
  /** The firm requires a second factor and this user has none yet. */
  mustEnrolTwoFactor?: boolean;
  twoFactor?: { totpEnabled: boolean; passkeyCount: number };
}

export type AuthObligation = 'PASSWORD_CHANGE_REQUIRED' | 'TWO_FACTOR_ENROLMENT_REQUIRED';

interface AuthStore {
  token: string | null;
  user: AuthUser | null;
  /** The session came from single sign-on (token arrived on /login#sso_token); sign-out tells the SSO layer. */
  sso: boolean;
  setAuth: (token: string, user: AuthUser, sso?: boolean) => void;
  clearAuth: () => void;
  /** Patch the signed-in user (after a password change, an enrolment, or a 403 obligation code). */
  updateUser: (patch: Partial<AuthUser>) => void;
  /** The server refused a request until the user finishes a step; ProtectedRoute reads the flag. */
  markObligation: (code: AuthObligation) => void;
}

export const useAuthStore = create<AuthStore>()(
  persist(
    (set) => ({
      token: null,
      user: null,
      sso: false,
      setAuth: (token, user, sso = false) => set({ token, user, sso }),
      clearAuth: () => set({ token: null, user: null, sso: false }),
      updateUser: (patch) => set((s) => (s.user ? { user: { ...s.user, ...patch } } : {})),
      markObligation: (code) => set((s) => {
        if (!s.user) return {};
        return code === 'PASSWORD_CHANGE_REQUIRED'
          ? { user: { ...s.user, mustChangePassword: true } }
          : { user: { ...s.user, mustEnrolTwoFactor: true } };
      }),
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
  /** Trial Balance grid view toggles (Single / PY / Tax / Non-zero only). */
  tbView: TbView;
  setTbView: (patch: Partial<TbView>) => void;
  /** Sub-group the financial statements by lead sheet. Has no effect on a
   *  chart of accounts with no lead sheets mapped — the page hides the control. */
  fsGroupByLeadSheet: boolean;
  setFsGroupByLeadSheet: (v: boolean) => void;
  /** Rows per page on the Storage page's Client folders table (25 / 50 / 100).
   *  A standing preference; the search, status filter and page number are not. */
  storageLinksPageSize: number;
  setStorageLinksPageSize: (n: number) => void;
}

export interface TbView {
  singleColumn: boolean;
  showPY: boolean;
  showTax: boolean;
  /** Hide accounts whose every balance is zero. Lives here with the other view
   *  toggles because it is a standing preference, not a per-visit filter. */
  nonZeroOnly: boolean;
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
      tbView: { singleColumn: false, showPY: false, showTax: true, nonZeroOnly: false },
      setTbView: (patch) => set((s) => ({ tbView: { ...s.tbView, ...patch } })),
      fsGroupByLeadSheet: false,
      setFsGroupByLeadSheet: (v) => set({ fsGroupByLeadSheet: v }),
      storageLinksPageSize: 25,
      setStorageLinksPageSize: (n) => set({ storageLinksPageSize: n }),
    }),
    {
      name: 'ui-prefs',
      partialize: (s) => ({ fontSize: s.fontSize, selectedClientId: s.selectedClientId, selectedPeriodId: s.selectedPeriodId, isDarkMode: s.isDarkMode, tbView: s.tbView, fsGroupByLeadSheet: s.fsGroupByLeadSheet, storageLinksPageSize: s.storageLinksPageSize }),
      // A stored copy written before tbView existed has no such key; keep the
      // defaults for it. The same spread covers a copy written before
      // nonZeroOnly joined the group.
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<UIStore>;
        return { ...current, ...p, tbView: { ...current.tbView, ...(p.tbView ?? {}) } };
      },
    },
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
