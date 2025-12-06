import React, { createContext, useContext, useState, useEffect, useMemo, ReactNode } from 'react';
import { ThemeProvider as MuiThemeProvider } from '@mui/material/styles';
import { generateTheme } from '../theme/themeConfig';

export type ThemeMode = 'dark' | 'light';
export type AccentColor = 'teal' | 'purple' | 'orange' | 'blue';
export type ThemeIntensity = 'subtle' | 'vibrant';

export interface ThemeSettings {
  mode: ThemeMode;
  accentColor: AccentColor;
  intensity: ThemeIntensity;
}

interface ThemeContextType {
  settings: ThemeSettings;
  setMode: (mode: ThemeMode) => void;
  setAccentColor: (color: AccentColor) => void;
  setIntensity: (intensity: ThemeIntensity) => void;
  toggleMode: () => void;
}

const STORAGE_KEY = 'kraken-theme';

const defaultSettings: ThemeSettings = {
  mode: 'dark',
  accentColor: 'teal',
  intensity: 'subtle',
};

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

function loadSettings(): ThemeSettings {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      return {
        mode: parsed.mode || defaultSettings.mode,
        accentColor: parsed.accentColor || defaultSettings.accentColor,
        intensity: parsed.intensity || defaultSettings.intensity,
      };
    }
  } catch (e) {
    console.warn('Failed to load theme settings:', e);
  }
  return defaultSettings;
}

function saveSettings(settings: ThemeSettings): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch (e) {
    console.warn('Failed to save theme settings:', e);
  }
}

interface ThemeProviderProps {
  children: ReactNode;
}

export function ThemeProvider({ children }: ThemeProviderProps) {
  const [settings, setSettings] = useState<ThemeSettings>(loadSettings);

  // Save to localStorage whenever settings change
  useEffect(() => {
    saveSettings(settings);
  }, [settings]);

  const setMode = (mode: ThemeMode) => {
    setSettings((prev) => ({ ...prev, mode }));
  };

  const setAccentColor = (accentColor: AccentColor) => {
    setSettings((prev) => ({ ...prev, accentColor }));
  };

  const setIntensity = (intensity: ThemeIntensity) => {
    setSettings((prev) => ({ ...prev, intensity }));
  };

  const toggleMode = () => {
    setSettings((prev) => ({
      ...prev,
      mode: prev.mode === 'dark' ? 'light' : 'dark',
    }));
  };

  // Generate MUI theme based on current settings
  const theme = useMemo(
    () => generateTheme(settings.mode, settings.accentColor, settings.intensity),
    [settings.mode, settings.accentColor, settings.intensity]
  );

  const contextValue = useMemo(
    () => ({
      settings,
      setMode,
      setAccentColor,
      setIntensity,
      toggleMode,
    }),
    [settings]
  );

  return (
    <ThemeContext.Provider value={contextValue}>
      <MuiThemeProvider theme={theme}>{children}</MuiThemeProvider>
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextType {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}

// Export accent color info for the settings UI
export const accentColors: { id: AccentColor; name: string; primary: string }[] = [
  { id: 'teal', name: 'Ocean Teal', primary: '#0d9488' },
  { id: 'purple', name: 'Soft Purple', primary: '#8b5cf6' },
  { id: 'orange', name: 'Coral Orange', primary: '#f97316' },
  { id: 'blue', name: 'Default Blue', primary: '#3b82f6' },
];
