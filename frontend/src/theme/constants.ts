/**
 * Theme Constants
 *
 * Shared theme-related constants extracted from ThemeContext
 * to comply with React Fast Refresh requirements.
 */

export type ThemeMode = 'dark' | 'light';
export type AccentColor =
  | 'teal'
  | 'purple'
  | 'orange'
  | 'blue'
  | 'rose'
  | 'emerald'
  | 'red'
  | 'amber'
  | 'indigo'
  | 'cyan'
  | 'lime'
  | 'slate';
export type ThemeIntensity = 'minimal' | 'subtle' | 'vibrant';

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
  { id: 'blue', name: 'Sky Blue', primary: '#3b82f6' },
  { id: 'indigo', name: 'Deep Indigo', primary: '#6366f1' },
  { id: 'purple', name: 'Soft Purple', primary: '#8b5cf6' },
  { id: 'rose', name: 'Rose Pink', primary: '#f43f5e' },
  { id: 'red', name: 'Crimson Red', primary: '#ef4444' },
  { id: 'orange', name: 'Coral Orange', primary: '#f97316' },
  { id: 'amber', name: 'Golden Amber', primary: '#f59e0b' },
  { id: 'lime', name: 'Lime Green', primary: '#84cc16' },
  { id: 'emerald', name: 'Emerald Green', primary: '#10b981' },
  { id: 'cyan', name: 'Electric Cyan', primary: '#06b6d4' },
  { id: 'slate', name: 'Slate Gray', primary: '#64748b' },
];

export const STORAGE_KEY = 'kraken-theme';

export const defaultSettings: ThemeSettings = {
  mode: 'dark',
  accentColor: 'teal',
  intensity: 'minimal',
};
