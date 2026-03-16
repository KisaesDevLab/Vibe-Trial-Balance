import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// Font size range: 11–18px, default 14
const MIN_FONT = 11;
const MAX_FONT = 18;

export interface AuthUser {
  id: number;
  username: string;
  displayName: string;
  role: string;
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
}

export const useUIStore = create<UIStore>()(
  persist(
    (set) => ({
      selectedClientId: null,
      setSelectedClientId: (id) => set({ selectedClientId: id, selectedPeriodId: null }),
      selectedPeriodId: null,
      setSelectedPeriodId: (id) => set({ selectedPeriodId: id }),
      fontSize: 14,
      increaseFontSize: () => set((s) => ({ fontSize: Math.min(MAX_FONT, s.fontSize + 1) })),
      decreaseFontSize: () => set((s) => ({ fontSize: Math.max(MIN_FONT, s.fontSize - 1) })),
    }),
    { name: 'ui-prefs', partialize: (s) => ({ fontSize: s.fontSize }) },
  ),
);
