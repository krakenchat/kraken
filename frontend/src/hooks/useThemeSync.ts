/**
 * useThemeSync Hook
 *
 * Syncs theme settings between the ThemeContext and the server.
 * - On mount: Fetches server settings and applies them (server wins)
 * - On change: Saves changes to the server
 */

import { useEffect, useRef } from 'react';
import { useTheme, type ThemeSettings } from '../contexts/ThemeContext';
import {
  useGetAppearanceSettingsQuery,
  useUpdateAppearanceSettingsMutation,
} from '../features/appearance/appearanceSlice';
import type { AccentColor, ThemeIntensity, ThemeMode } from '../theme/constants';

export function useThemeSync() {
  const { applyServerSettings, registerOnChange } = useTheme();
  const { data: serverSettings, isSuccess } = useGetAppearanceSettingsQuery();
  const [updateSettings] = useUpdateAppearanceSettingsMutation();
  const hasAppliedServerSettings = useRef(false);

  // Apply server settings on initial load (server wins)
  useEffect(() => {
    if (isSuccess && serverSettings && !hasAppliedServerSettings.current) {
      hasAppliedServerSettings.current = true;
      applyServerSettings({
        mode: serverSettings.themeMode as ThemeMode,
        accentColor: serverSettings.accentColor as AccentColor,
        intensity: serverSettings.intensity as ThemeIntensity,
      });
    }
  }, [isSuccess, serverSettings, applyServerSettings]);

  // Register callback to sync changes to server
  useEffect(() => {
    const unregister = registerOnChange((settings: ThemeSettings) => {
      // Only sync if we've already applied server settings (avoid syncing on initial load)
      if (hasAppliedServerSettings.current) {
        updateSettings({
          themeMode: settings.mode,
          accentColor: settings.accentColor,
          intensity: settings.intensity,
        });
      }
    });

    return unregister;
  }, [registerOnChange, updateSettings]);
}
