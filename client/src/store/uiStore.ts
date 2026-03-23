import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// Font size range: 11–36px, default 16, step 2 above 18
const MIN_FONT = 11;
const MAX_FONT = 36;

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
