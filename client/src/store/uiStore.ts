import { create } from 'zustand';
import { persist } from 'zustand/middleware';

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
}

export const useUIStore = create<UIStore>((set) => ({
  selectedClientId: null,
  setSelectedClientId: (id) => set({ selectedClientId: id }),
}));
