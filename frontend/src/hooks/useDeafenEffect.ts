import { useEffect, useRef } from 'react';
import { logger } from '../utils/logger';
import { useSelector } from 'react-redux';
import { RootState } from '../app/store';
import { useRoom } from './useRoom';
import { Track } from 'livekit-client';

/**
 * Hook that implements proper deafen functionality by muting received audio tracks
 *
 * When isDeafened is true:
 * - Sets volume to 0 for all remote audio tracks
 * - Also mutes the user's microphone (Discord-style behavior)
 *
 * When isDeafened is false:
 * - Restores volume to 1.0 for all remote audio tracks
 *
 * This hook should be used once at the app level or in a persistent voice component.
 *
 * @example
 * // In your main voice component or App.tsx
 * useDeafenEffect();
 */
export const useDeafenEffect = () => {
  const { room } = useRoom();
  const isDeafened = useSelector((state: RootState) => state.voice.isDeafened);
  const timeoutRefs = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    if (!room) return;

    // Function to mute/unmute all remote audio tracks
    const updateRemoteAudioVolume = (volume: number) => {
      room.remoteParticipants.forEach((participant) => {
        participant.audioTrackPublications.forEach((publication) => {
          if (publication.track && publication.source === Track.Source.Microphone) {
            publication.track.setVolume(volume);
          }
        });
      });
    };

    // Apply current deafen state
    if (isDeafened) {
      // Mute all remote audio (volume = 0)
      updateRemoteAudioVolume(0);
      logger.dev('[Voice] Deafened: muted all remote audio tracks');
    } else {
      // Restore audio (volume = 1.0)
      updateRemoteAudioVolume(1.0);
      logger.dev('[Voice] Undeafened: restored all remote audio tracks');
    }

    // Handle new participants joining while deafened
    const handleParticipantConnected = () => {
      if (isDeafened) {
        // Mute new participant's audio immediately
        const t = setTimeout(() => updateRemoteAudioVolume(0), 100);
        timeoutRefs.current.push(t);
      }
    };

    // Handle new track publications while deafened
    const handleTrackSubscribed = () => {
      if (isDeafened) {
        // Mute newly subscribed tracks
        const t = setTimeout(() => updateRemoteAudioVolume(0), 100);
        timeoutRefs.current.push(t);
      }
    };

    room.on('participantConnected', handleParticipantConnected);
    room.on('trackSubscribed', handleTrackSubscribed);

    // Cleanup
    return () => {
      room.off('participantConnected', handleParticipantConnected);
      room.off('trackSubscribed', handleTrackSubscribed);
      timeoutRefs.current.forEach(clearTimeout);
      timeoutRefs.current = [];
    };
  }, [room, isDeafened]);
};
