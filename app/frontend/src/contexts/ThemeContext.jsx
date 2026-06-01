/**
 * ThemeContext — Manages light/dark theme state.
 *
 * Persists preference in localStorage.
 * Applies 'dark' class to <html> element.
 *
 * @module contexts/ThemeContext
 */

import { createContext, useContext, useState, useEffect, useCallback } from 'react';

/** @type {React.Context} */
const ThemeContext = createContext(null);

/** localStorage key for theme preference */
const THEME_KEY = 'cloudscope_theme';

/**
 * ThemeProvider — wraps app with theme state.
 *
 * @param {object} props
 * @param {React.ReactNode} props.children
 * @returns {JSX.Element}
 */
export function ThemeProvider({ children }) {
  const [isDark, setIsDark] = useState(() => {
    try {
      const stored = localStorage.getItem(THEME_KEY);
      if (stored !== null) return stored === 'dark';
      // Default to system preference
      return window.matchMedia('(prefers-color-scheme: dark)').matches;
    } catch {
      return true; // fallback to dark
    }
  });

  // Sync 'dark' class on <html>
  useEffect(() => {
    const root = document.documentElement;
    if (isDark) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    try {
      localStorage.setItem(THEME_KEY, isDark ? 'dark' : 'light');
    } catch (err) {
      console.error('[ThemeContext] Failed to persist theme:', err);
    }
  }, [isDark]);

  /**
   * Toggle between light and dark mode.
   */
  const toggleTheme = useCallback(() => {
    setIsDark((prev) => !prev);
  }, []);

  return (
    <ThemeContext.Provider value={{ isDark, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

/**
 * Custom hook to access theme context.
 *
 * @returns {{ isDark: boolean, toggleTheme: function }}
 * @throws {Error} If used outside ThemeProvider
 */
export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
