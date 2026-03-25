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
}

interface AuthState {
  user: User | null;
  token: string | null;
  refreshToken: string | null;
  isLoading: boolean;
  login: (login: string, password: string) => Promise<void>;
  register: (email: string, username: string, password: string) => Promise<void>;
  logout: () => void;
  loadFromStorage: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: null,
  refreshToken: null,
  isLoading: false,

  login: async (login, password) => {
    set({ isLoading: true });
    try {
      const res = await api.login({ login, password });
      api.setToken(res.accessToken);
      localStorage.setItem('bta_token', res.accessToken);
      localStorage.setItem('bta_refresh', res.refreshToken);
      set({ user: res.user, token: res.accessToken, refreshToken: res.refreshToken, isLoading: false });
    } catch (err) {
      set({ isLoading: false });
      throw err;
    }
  },

  register: async (email, username, password) => {
    set({ isLoading: true });
    try {
      const res = await api.register({ email, username, password });
      api.setToken(res.accessToken);
      localStorage.setItem('bta_token', res.accessToken);
      localStorage.setItem('bta_refresh', res.refreshToken);
      set({ user: res.user, token: res.accessToken, refreshToken: res.refreshToken, isLoading: false });
    } catch (err) {
      set({ isLoading: false });
      throw err;
    }
  },

  logout: () => {
    api.setToken(null);
    localStorage.removeItem('bta_token');
    localStorage.removeItem('bta_refresh');
    set({ user: null, token: null, refreshToken: null });
  },

  loadFromStorage: () => {
    const token = localStorage.getItem('bta_token');
    const refreshToken = localStorage.getItem('bta_refresh');
    if (token) {
      api.setToken(token);
      set({ token, refreshToken });
      // Fetch user profile
      api.getMe().then(user => set({ user })).catch(() => {
        api.setToken(null);
        localStorage.removeItem('bta_token');
        set({ token: null, user: null });
      });
    }
  },
}));
