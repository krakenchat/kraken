/**
 * Theme Constants
 *
 * Shared theme-related constants extracted from ThemeContext
 * to comply with React Fast Refresh requirements.
 */

export type ThemeMode = 'dark' | 'light';
export type AccentColor = 'teal' | 'purple' | 'orange' | 'blue';
export type ThemeIntensity = 'subtle' | 'vibrant';

export interface ThemeSettings {
  mode: ThemeMode;
  accentColor: AccentColor;
  intensity: ThemeIntensity;
}

export interface AccentColorInfo {
  id: AccentColor;
  name: string;
  primary: string;
}

// Export accent color info for the settings UI
export const accentColors: AccentColorInfo[] = [
  { id: 'teal', name: 'Ocean Teal', primary: '#0d9488' },
  { id: 'purple', name: 'Soft Purple', primary: '#8b5cf6' },
  { id: 'orange', name: 'Coral Orange', primary: '#f97316' },
  { id: 'blue', name: 'Default Blue', primary: '#3b82f6' },
];

export const STORAGE_KEY = 'kraken-theme';

export const defaultSettings: ThemeSettings = {
  mode: 'dark',
  accentColor: 'teal',
  intensity: 'subtle',
};
