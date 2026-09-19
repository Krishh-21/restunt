import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { AuthUser } from '@dinely/types';

interface AuthState {
  token: string | null;
  user: AuthUser | null;
  outletId: string | null;
  setAuth: (token: string, user: AuthUser, outletId: string) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      user: null,
      outletId: null,
      setAuth: (token, user, outletId) => set({ token, user, outletId }),
      logout: () => set({ token: null, user: null, outletId: null }),
    }),
    { name: 'dinely-auth' }
  )
);
