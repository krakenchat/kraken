import { useEffect } from 'react';
import { isElectron } from '../utils/platform';
import { logger } from '../utils/logger';

// 'hangup' / 'togglemicrophone' are in the Media Session spec (video
// conferencing actions) but missing from the TS DOM lib's union.
type ExtendedMediaSessionAction = MediaSessionAction | 'hangup' | 'togglemicrophone';

interface UseVoiceMediaSessionOptions {
  isConnected: boolean;
  /** Display name of the voice context (channel or DM group). */
  contextName: string | null;
  isMicrophoneEnabled: boolean;
  onHangup: () => void;
  onToggleMic: () => void;
}

/**
 * Registers the active voice call with the browser's Media Session API.
 *
 * On Android Chrome this surfaces an ongoing call-style notification with
 * hangup/mic actions and — critically for #350 — raises the tab's process
 * priority so the call is less likely to be starved while the app is
 * backgrounded or the screen is locked.
 *
 * Web only: Electron uses powerSaveBlocker instead, and an OS media overlay
 * for a voice call would be surprising on desktop.
 */
export function useVoiceMediaSession({
  isConnected,
  contextName,
  isMicrophoneEnabled,
  onHangup,
  onToggleMic,
}: UseVoiceMediaSessionOptions): void {
  useEffect(() => {
    if (!isConnected || isElectron() || !('mediaSession' in navigator)) {
      return;
    }

    const mediaSession = navigator.mediaSession;

    // setActionHandler throws TypeError for actions the browser doesn't
    // support (hangup/togglemicrophone are newer, Chromium-only), so each
    // registration is wrapped individually.
    const trySetHandler = (
      action: ExtendedMediaSessionAction,
      handler: MediaSessionActionHandler | null
    ) => {
      try {
        mediaSession.setActionHandler(action as MediaSessionAction, handler);
      } catch {
        logger.info('[Voice] MediaSession action not supported:', action);
      }
    };

    mediaSession.metadata = new MediaMetadata({
      title: contextName ?? 'Voice call',
      artist: 'Semaphore Chat',
    });
    mediaSession.playbackState = 'playing';
    trySetHandler('hangup', () => onHangup());
    trySetHandler('togglemicrophone', () => onToggleMic());

    return () => {
      trySetHandler('hangup', null);
      trySetHandler('togglemicrophone', null);
      mediaSession.playbackState = 'none';
      mediaSession.metadata = null;
    };
  }, [isConnected, contextName, onHangup, onToggleMic]);

  // Mirror the mic state into the call notification's mic indicator.
  // setMicrophoneActive is Chromium-only and recent — feature-detected.
  useEffect(() => {
    if (!isConnected || isElectron() || !('mediaSession' in navigator)) {
      return;
    }
    const mediaSession = navigator.mediaSession as MediaSession & {
      setMicrophoneActive?: (active: boolean) => void;
    };
    try {
      mediaSession.setMicrophoneActive?.(isMicrophoneEnabled);
    } catch {
      // Not supported — ignore.
    }
  }, [isConnected, isMicrophoneEnabled]);
}
