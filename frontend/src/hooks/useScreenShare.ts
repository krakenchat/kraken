/**
 * useScreenShare Hook
 *
 * Platform-aware screen sharing hook that handles differences between
 * Electron and web browser implementations.
 *
 * - In Electron: Shows custom source picker with advanced settings
 * - In Web: Uses native browser getDisplayMedia picker
 */

import { useState, useCallback, useEffect } from 'react';
import { useVoiceConnection } from './useVoiceConnection';
import { hasElectronFeature } from '../utils/platform';
import { ScreenShareSettings } from '../components/Voice/ScreenSourcePicker';
import { setScreenShareConfig, clearScreenShareConfig } from '../utils/screenShareState';

interface UseScreenShareReturn {
  isScreenSharing: boolean;
  showSourcePicker: boolean;
  startScreenShare: () => Promise<void>;
  stopScreenShare: () => Promise<void>;
  toggleScreenShare: () => Promise<void>;
  handleSourceSelect: (sourceId: string, settings: ScreenShareSettings) => Promise<void>;
  handleSourcePickerClose: () => void;
}

/**
 * Hook for platform-aware screen sharing
 */
export const useScreenShare = (): UseScreenShareReturn => {
  const { state, actions } = useVoiceConnection();
  const [showSourcePicker, setShowSourcePicker] = useState(false);

  /**
   * Start screen sharing
   * - Electron: Shows source picker dialog first
   * - Web: Directly triggers native browser picker via LiveKit
   */
  const startScreenShare = useCallback(async () => {
    if (hasElectronFeature('getDesktopSources')) {
      // Electron: Show custom source picker
      setShowSourcePicker(true);
    } else {
      // Web: Let LiveKit use native browser picker
      await actions.toggleScreenShare();
    }
  }, [actions]);

  /**
   * Stop screen sharing (platform-agnostic)
   */
  const stopScreenShare = useCallback(async () => {
    await actions.toggleScreenShare();
  }, [actions]);

  /**
   * Toggle screen sharing
   * - If currently sharing: stop immediately
   * - If not sharing: start (shows picker on Electron, native on web)
   */
  const toggleScreenShare = useCallback(async () => {
    if (state.isScreenSharing) {
      await stopScreenShare();
    } else {
      await startScreenShare();
    }
  }, [state.isScreenSharing, startScreenShare, stopScreenShare]);

  /**
   * Handle source selection from Electron picker
   * Stores selection for Electron main process to access via setDisplayMediaRequestHandler
   */
  const handleSourceSelect = useCallback(
    async (sourceId: string, settings: ScreenShareSettings) => {
      setShowSourcePicker(false);

      // Store selected source and settings for Electron main process using type-safe interface
      setScreenShareConfig(sourceId, settings);

      // Start screen share (LiveKit will use selected source via main.ts handler)
      await actions.toggleScreenShare();
    },
    [actions]
  );

  /**
   * Handle source picker dialog close
   */
  const handleSourcePickerClose = useCallback(() => {
    setShowSourcePicker(false);
  }, []);

  /**
   * Clean up screen share config when screen sharing stops
   */
  useEffect(() => {
    if (!state.isScreenSharing) {
      clearScreenShareConfig();
    }
  }, [state.isScreenSharing]);

  return {
    isScreenSharing: state.isScreenSharing,
    showSourcePicker,
    startScreenShare,
    stopScreenShare,
    toggleScreenShare,
    handleSourceSelect,
    handleSourcePickerClose,
  };
};
