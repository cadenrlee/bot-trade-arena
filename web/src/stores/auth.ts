'use client';
import { create } from 'zustand';
import { api } from '@/lib/api';

interface User {
  id: string;
  email: string;
  username: string;
  displayName?: string;
  avatarUrl?: string;
  elo: number;
  tier: string;
  plan: string;
  totalWins: number;
  totalLosses: number;
  totalMatches: number;
  streak?: number;
  xp?: number;
  level?: number;
  credits?: number;
}

interface AuthState {
  user: User | null;
  token: string | null;
  refreshToken: string | null;
  isLoading: boolean;
  error: string | null;
  login: (login: string, password: string) => Promise<void>;
  register: (email: string, username: string, password: string) => Promise<void>;
  logout: () => void;
  loadFromStorage: () => void;
  refreshUser: () => Promise<void>;
  clearError: () => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  token: null,
  refreshToken: null,
  isLoading: false,
  error: null,

  clearError: () => set({ error: null }),

  login: async (login, password) => {
    set({ isLoading: true, error: null });
    try {
      const res = await api.login({ login, password });
      api.setToken(res.accessToken);
      localStorage.setItem('bta_token', res.accessToken);
      localStorage.setItem('bta_refresh', res.refreshToken);
      set({ user: res.user, token: res.accessToken, refreshToken: res.refreshToken, isLoading: false });
    } catch (err: any) {
      set({ isLoading: false, error: err.message || 'Login failed' });
      throw err;
    }
  },

  register: async (email, username, password) => {
    set({ isLoading: true, error: null });
    try {
      const res = await api.register({ email, username, password });
      api.setToken(res.accessToken);
      localStorage.setItem('bta_token', res.accessToken);
      localStorage.setItem('bta_refresh', res.refreshToken);
      set({ user: res.user, token: res.accessToken, refreshToken: res.refreshToken, isLoading: false });
    } catch (err: any) {
      set({ isLoading: false, error: err.message || 'Registration failed' });
      throw err;
    }
  },

  logout: () => {
    api.setToken(null);
    localStorage.removeItem('bta_token');
    localStorage.removeItem('bta_refresh');
    set({ user: null, token: null, refreshToken: null, error: null });
  },

  refreshUser: async () => {
    try {
      const user = await api.getMe();
      set({ user });
    } catch { /* silent */ }
  },

  loadFromStorage: () => {
    const token = localStorage.getItem('bta_token');
    const refreshToken = localStorage.getItem('bta_refresh');
    if (token) {
      api.setToken(token);
      set({ token, refreshToken });
      // Fetch fresh user profile
      api.getMe().then(user => set({ user })).catch(async () => {
        // Token expired — try refresh
        if (refreshToken) {
          try {
            const res = await api.refresh(refreshToken);
            api.setToken(res.accessToken);
            localStorage.setItem('bta_token', res.accessToken);
            localStorage.setItem('bta_refresh', res.refreshToken);
            set({ token: res.accessToken, refreshToken: res.refreshToken });
            const user = await api.getMe();
            set({ user });
          } catch {
            // Refresh failed — log out
            api.setToken(null);
            localStorage.removeItem('bta_token');
            localStorage.removeItem('bta_refresh');
            set({ token: null, user: null, refreshToken: null });
          }
        } else {
          api.setToken(null);
          localStorage.removeItem('bta_token');
          set({ token: null, user: null });
        }
      });
    }
  },
}));
