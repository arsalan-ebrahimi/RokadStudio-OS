import { create } from 'zustand';

interface ThemeStore {
  isDark: boolean;
  toggleTheme: () => void;
  setTheme: (dark: boolean) => void;
}

const STORAGE_KEY = 'rokad_theme';

export const getInitialTheme = (): boolean => {
  if (typeof window === 'undefined') return false;
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'dark') return true;
    if (saved === 'light') return false;
    return (
      document.documentElement.classList.contains('dark') ||
      window.matchMedia('(prefers-color-scheme: dark)').matches
    );
  } catch {
    return false;
  }
};

const applyThemeToDOM = (isDark: boolean) => {
  if (typeof document === 'undefined') return;
  if (isDark) {
    document.documentElement.classList.add('dark');
  } else {
    document.documentElement.classList.remove('dark');
  }
};

export const useTheme = create<ThemeStore>((set) => {
  const initialDark = getInitialTheme();
  applyThemeToDOM(initialDark);

  return {
    isDark: initialDark,
    toggleTheme: () => {
      set((state) => {
        const next = !state.isDark;
        try {
          localStorage.setItem(STORAGE_KEY, next ? 'dark' : 'light');
        } catch {}
        applyThemeToDOM(next);
        return { isDark: next };
      });
    },
    setTheme: (dark: boolean) => {
      try {
        localStorage.setItem(STORAGE_KEY, dark ? 'dark' : 'light');
      } catch {}
      applyThemeToDOM(dark);
      set({ isDark: dark });
    },
  };
});
