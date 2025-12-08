import { useEffect, useState, useCallback, useRef } from 'react';
import { useSelector } from 'react-redux';
import { RootState } from '../app/store';
import { useRoom } from './useRoom';
import { useVoiceSettings } from './useVoiceSettings';
import { logger } from '../utils/logger';

/**
 * Hook to handle Push to Talk functionality.
 *
 * When PTT mode is active and user is connected to voice,
 * this hook listens for the configured PTT key and controls
 * the microphone accordingly.
 *
 * @returns Object with PTT state information
 */
export function usePushToTalk() {
  const { getRoom } = useRoom();
  const voiceState = useSelector((state: RootState) => state.voice);
  const { inputMode, pushToTalkKey, pushToTalkKeyDisplay, isPushToTalk } = useVoiceSettings();

  const [isKeyHeld, setIsKeyHeld] = useState(false);
  const isKeyHeldRef = useRef(false);

  // Track if PTT is active (connected to voice AND in PTT mode)
  const isActive = voiceState.isConnected && isPushToTalk;

  // Handle keydown - enable microphone
  const handleKeyDown = useCallback(async (event: KeyboardEvent) => {
    // Check if this is our PTT key
    if (event.code !== pushToTalkKey) return;

    // Ignore if key is being held (repeat events)
    if (event.repeat) return;

    // Don't activate PTT if user is typing in an input field
    const target = event.target as HTMLElement;
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
      return;
    }

    event.preventDefault();

    const room = getRoom();
    if (!room) return;

    try {
      isKeyHeldRef.current = true;
      setIsKeyHeld(true);
      await room.localParticipant.setMicrophoneEnabled(true);
      logger.dev('[PTT] Key pressed, microphone enabled');
    } catch (error) {
      logger.error('[PTT] Failed to enable microphone:', error);
    }
  }, [pushToTalkKey, getRoom]);

  // Handle keyup - disable microphone
  const handleKeyUp = useCallback(async (event: KeyboardEvent) => {
    // Check if this is our PTT key
    if (event.code !== pushToTalkKey) return;

    const room = getRoom();
    if (!room) return;

    try {
      isKeyHeldRef.current = false;
      setIsKeyHeld(false);
      await room.localParticipant.setMicrophoneEnabled(false);
      logger.dev('[PTT] Key released, microphone disabled');
    } catch (error) {
      logger.error('[PTT] Failed to disable microphone:', error);
    }
  }, [pushToTalkKey, getRoom]);

  // Handle window blur - release mic if user switches tabs while holding key
  const handleBlur = useCallback(async () => {
    if (!isKeyHeldRef.current) return;

    const room = getRoom();
    if (!room) return;

    try {
      isKeyHeldRef.current = false;
      setIsKeyHeld(false);
      await room.localParticipant.setMicrophoneEnabled(false);
      logger.dev('[PTT] Window blur, microphone disabled');
    } catch (error) {
      logger.error('[PTT] Failed to disable microphone on blur:', error);
    }
  }, [getRoom]);

  // Set up event listeners when PTT is active
  useEffect(() => {
    if (!isActive) {
      // Reset state when PTT becomes inactive
      if (isKeyHeldRef.current) {
        isKeyHeldRef.current = false;
        setIsKeyHeld(false);
      }
      return;
    }

    logger.dev('[PTT] Push to Talk activated, listening for key:', pushToTalkKey);

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', handleBlur);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', handleBlur);

      // Ensure mic is disabled when hook unmounts while key is held
      if (isKeyHeldRef.current) {
        const room = getRoom();
        if (room) {
          room.localParticipant.setMicrophoneEnabled(false);
        }
      }
    };
  }, [isActive, pushToTalkKey, handleKeyDown, handleKeyUp, handleBlur, getRoom]);

  return {
    // Whether PTT mode is currently active (connected + PTT mode enabled)
    isActive,

    // Whether the PTT key is currently being held
    isKeyHeld,

    // The display name of the current PTT key
    currentKeyDisplay: pushToTalkKeyDisplay,

    // Current input mode
    inputMode,
  };
}
