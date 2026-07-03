import { useEffect, useState, useCallback, useRef } from 'react';
import { useVoice, useVoiceDispatch } from '../contexts/VoiceContext';
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
  const voiceState = useVoice();
  const { stateRef } = useVoiceDispatch();
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

    // Block transmit when server-muted — mirrors the guard in toggleMicrophone.
    // Read via stateRef so we see the CURRENT value, not a stale closure.
    if (stateRef.current.isServerMuted) {
      logger.dev('[PTT] Key pressed while server muted, ignoring');
      return;
    }

    try {
      isKeyHeldRef.current = true;
      setIsKeyHeld(true);
      await room.localParticipant.setMicrophoneEnabled(true);
      logger.dev('[PTT] Key pressed, microphone enabled');
    } catch (error) {
      logger.error('[PTT] Failed to enable microphone:', error);
    }
  }, [pushToTalkKey, getRoom, stateRef]);

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

  // Apply the correct mic state when the input mode changes mid-call (#381).
  //
  // PTT -> voice activity: in PTT mode the resting state of the mic
  // publication is always muted (keyup/blur mute it), and the mute state is
  // one-dimensional — there is no separate "user clicked mute" flag, so a
  // manual mute while in PTT mode is indistinguishable from the PTT-idle
  // mute. The pragmatic rule: unmute so voice activity transmits immediately
  // (that is what choosing VA means), unless the user is server-muted or
  // deafened — those states must never be overridden from here.
  //
  // Voice activity -> PTT: the resting state must be muted until the PTT key
  // is held. The activation effect above only attaches listeners and never
  // mutes, so handle it on the transition.
  const prevIsPushToTalkRef = useRef(isPushToTalk);
  useEffect(() => {
    const wasPushToTalk = prevIsPushToTalkRef.current;
    prevIsPushToTalkRef.current = isPushToTalk;

    if (wasPushToTalk === isPushToTalk) return;
    if (!voiceState.isConnected) return;

    const room = getRoom();
    if (!room) return;

    if (isPushToTalk) {
      // VA -> PTT: rest muted until the key is held
      room.localParticipant.setMicrophoneEnabled(false)
        .then(() => logger.dev('[PTT] Switched to push to talk, microphone muted until key held'))
        .catch((error) => logger.error('[PTT] Failed to mute microphone on mode switch:', error));
    } else if (!voiceState.isServerMuted && !voiceState.isDeafened) {
      // PTT -> VA: unmute so voice activity works (see comment above)
      room.localParticipant.setMicrophoneEnabled(true)
        .then(() => logger.dev('[PTT] Switched to voice activity, microphone enabled'))
        .catch((error) => logger.error('[PTT] Failed to enable microphone on mode switch:', error));
    }
  }, [isPushToTalk, voiceState.isConnected, voiceState.isServerMuted, voiceState.isDeafened, getRoom]);

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
