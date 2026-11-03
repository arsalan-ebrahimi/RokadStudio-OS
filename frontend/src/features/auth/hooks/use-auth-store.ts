import { create } from 'zustand';
import { TOKEN_STORAGE_KEY, USER_STORAGE_KEY } from '@/shared/config/constants';
import type { User, Role } from '@/shared/types/models';
import { loginWithCode, fetchCurrentUser } from '../api/auth-api';

interface AuthState {
  token: string | null;
  user: User | null;
  isLoading: boolean;
  login: (code: string) => Promise<User>;
  logout: () => void;
  init: () => Promise<void>;
  hasRole: (roles: Role[]) => boolean;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  token: localStorage.getItem(TOKEN_STORAGE_KEY),
  user: JSON.parse(localStorage.getItem(USER_STORAGE_KEY) || 'null'),
  isLoading: Boolean(localStorage.getItem(TOKEN_STORAGE_KEY)),

  login: async (code: string) => {
    const { token, user } = await loginWithCode(code);
    localStorage.setItem(TOKEN_STORAGE_KEY, token);
    localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
    set({ token, user, isLoading: false });
    return user;
  },

  logout: () => {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    localStorage.removeItem(USER_STORAGE_KEY);
    set({ token: null, user: null, isLoading: false });
  },

  init: async () => {
    const token = localStorage.getItem(TOKEN_STORAGE_KEY);
    if (!token) {
      set({ isLoading: false, user: null, token: null });
      return;
    }
    try {
      const user = await fetchCurrentUser();
      localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
      set({ user, token, isLoading: false });
    } catch {
      localStorage.removeItem(TOKEN_STORAGE_KEY);
      localStorage.removeItem(USER_STORAGE_KEY);
      set({ token: null, user: null, isLoading: false });
    }
  },

  hasRole: (roles: Role[]) => {
    const current = get().user;
    return current ? roles.includes(current.role) : false;
  },
}));

