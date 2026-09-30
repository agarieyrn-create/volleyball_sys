import React, { createContext, useContext, useEffect, useState } from 'react';
import { DEFAULT_THEME_ID, getTheme, THEMES, ThemeConfig, ThemeId } from '../logic/theme';

interface ThemeContextType {
  themeId: ThemeId;
  theme: ThemeConfig;
  setTheme: (id: ThemeId) => void;
  themes: Record<ThemeId, ThemeConfig>;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const STORAGE_KEY = 'volleyball_app_theme';

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [themeId, setThemeIdState] = useState<ThemeId>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved === 'sunset') {
        localStorage.setItem(STORAGE_KEY, 'ocean');
        return 'ocean';
      }
      if (saved && saved in THEMES) {
        return saved as ThemeId;
      }
    } catch {
      // ignore
    }
    return DEFAULT_THEME_ID;
  });

  const theme = getTheme(themeId);

  const setTheme = (newId: ThemeId) => {
    setThemeIdState(newId);
    try {
      localStorage.setItem(STORAGE_KEY, newId);
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    // HTML root attributes
    document.documentElement.setAttribute('data-theme', themeId);
    if (theme.isDark) {
      document.documentElement.classList.add('dark');
      document.documentElement.classList.remove('light');
    } else {
      document.documentElement.classList.remove('dark');
      document.documentElement.classList.add('light');
    }
  }, [themeId, theme.isDark]);

  return (
    <ThemeContext.Provider value={{ themeId, theme, setTheme, themes: THEMES }}>
      {children}
    </ThemeContext.Provider>
  );
};

export function useTheme(): ThemeContextType {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
