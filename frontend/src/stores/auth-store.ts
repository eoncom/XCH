import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User, LoginCredentials } from '@/types';

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (credentials: LoginCredentials) => Promise<void>;
  logout: () => Promise<void>;
  checkSession: () => Promise<void>;
  setUser: (user: User) => void;
}

// When empty, API calls use relative URLs (same origin via nginx proxy)
const API_URL = process.env.NEXT_PUBLIC_API_URL || '';

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      isAuthenticated: false,
      isLoading: false,

      login: async (credentials: LoginCredentials) => {
        set({ isLoading: true });
        try {
          // ✅ Cookies HTTP-only gérés automatiquement par fetch credentials: 'include'
          const response = await fetch(`${API_URL}/api/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include', // ✅ CRITICAL - sends/receives cookies
            body: JSON.stringify(credentials),
          });

          if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'Login failed');
          }

          const { user } = await response.json();

          // ✅ Store only user data (tokens are in HTTP-only cookies)
          localStorage.setItem('user', JSON.stringify(user));

          set({
            user,
            isAuthenticated: true,
            isLoading: false,
          });
        } catch (error: any) {
          set({ isLoading: false });
          throw error;
        }
      },

      logout: async () => {
        try {
          // ✅ Call backend to clear HTTP-only cookies
          await fetch(`${API_URL}/api/auth/logout`, {
            method: 'POST',
            credentials: 'include',
          });
        } catch (error) {
          console.error('Logout API call failed:', error);
        }

        // Clear local cache
        localStorage.removeItem('user');

        set({
          user: null,
          isAuthenticated: false,
        });
      },

      checkSession: async () => {
        set({ isLoading: true });
        try {
          // ✅ Verify session via accessToken cookie (automatic)
          const response = await fetch(`${API_URL}/api/auth/session`, {
            credentials: 'include',
          });

          if (response.ok) {
            const { user } = await response.json();
            localStorage.setItem('user', JSON.stringify(user));
            set({ user, isAuthenticated: true, isLoading: false });
          } else {
            // Session expired or invalid
            localStorage.removeItem('user');
            set({ user: null, isAuthenticated: false, isLoading: false });
          }
        } catch (error) {
          console.error('Session check failed:', error);
          localStorage.removeItem('user');
          set({ user: null, isAuthenticated: false, isLoading: false });
        }
      },

      setUser: (user: User) => {
        localStorage.setItem('user', JSON.stringify(user));
        set({ user });
      },
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({
        user: state.user,
        // ✅ DO NOT persist isAuthenticated (calculated via session check)
        // ✅ DO NOT persist isLoading (prevents form lock on page refresh)
      }),
      // ✅ Reset isLoading to false on hydration (prevents stuck loading state)
      onRehydrateStorage: () => (state) => {
        if (state) {
          state.isLoading = false;
        }
      },
    }
  )
);
