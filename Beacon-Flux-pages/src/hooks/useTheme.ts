import { useCallback, useEffect, useState } from 'react';
import {
  applyTheme,
  getInitialTheme,
  setStoredTheme,
  type Theme,
} from '../lib/theme';

export function useTheme() {
  const [theme, setThemeState] = useState<Theme>(() => getInitialTheme());

  // Apply on mount + whenever it changes
  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  // Follow system changes ONLY if the user hasn't explicitly chosen
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = (e: MediaQueryListEvent) => {
      // Only follow system if no explicit stored preference
      try {
        if (!localStorage.getItem('theme')) {
          const next: Theme = e.matches ? 'dark' : 'light';
          setThemeState(next);
          applyTheme(next);
        }
      } catch {
        /* ignore */
      }
    };
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  const setTheme = useCallback((next: Theme) => {
    setThemeState(next);
    setStoredTheme(next);
  }, []);

  const toggleTheme = useCallback(() => {
    setThemeState((prev) => {
      const next: Theme = prev === 'dark' ? 'light' : 'dark';
      setStoredTheme(next);
      return next;
    });
  }, []);

  return { theme, setTheme, toggleTheme };
}