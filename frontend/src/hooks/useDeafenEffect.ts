import { useEffect, useRef } from 'react';
import { logger } from '../utils/logger';
import { useVoice } from '../contexts/VoiceContext';
import { useRoom } from './useRoom';
import { Track } from 'livekit-client';
import { VOLUME_STORAGE_PREFIX } from '../constants/voice';

/**
 * Hook that implements proper deafen functionality by muting received audio tracks
 *
 * When isDeafened is true:
 * - Sets volume to 0 for all remote audio tracks
 * - Also mutes the user's microphone (Discord-style behavior)
 *
 * When isDeafened is false:
 * - Restores each participant's per-user stored volume (from localStorage)
 * - Falls back to 1.0 if no stored volume exists
 *
 * This hook should be used once at the app level or in a persistent voice component.
 *
 * @example
 * // In your main voice component or App.tsx
 * useDeafenEffect();
 */
export const useDeafenEffect = () => {
  const { room } = useRoom();
  const { isDeafened } = useVoice();
  const timeoutRefs = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    if (!room) return;

    // Mute all remote audio tracks (volume = 0)
    const muteAllRemoteAudio = () => {
      room.remoteParticipants.forEach((participant) => {
        participant.audioTrackPublications.forEach((publication) => {
          if (publication.track && (publication.source === Track.Source.Microphone || publication.source === Track.Source.ScreenShareAudio)) {
            publication.track.setVolume(0);
          }
        });
      });
    };

    // Restore per-user stored volumes for all remote audio tracks
    const restoreRemoteAudioVolumes = () => {
      room.remoteParticipants.forEach((participant) => {
        const storedRaw = localStorage.getItem(`${VOLUME_STORAGE_PREFIX}${participant.identity}`);
        const storedVolume = storedRaw !== null ? parseFloat(storedRaw) : 1.0;
        // Cap at 1.0 for track.setVolume; GainNode handles boost >1.0 via context menu
        const trackVolume = Math.min(storedVolume, 1.0);

        participant.audioTrackPublications.forEach((publication) => {
          if (publication.track && (publication.source === Track.Source.Microphone || publication.source === Track.Source.ScreenShareAudio)) {
            publication.track.setVolume(trackVolume);
          }
        });
      });
    };

    // Apply current deafen state
    if (isDeafened) {
      muteAllRemoteAudio();
      logger.dev('[Voice] Deafened: muted all remote audio tracks');
    } else {
      restoreRemoteAudioVolumes();
      logger.dev('[Voice] Undeafened: restored per-user remote audio volumes');
    }

    // Handle new participants joining while deafened
    const handleParticipantConnected = () => {
      if (isDeafened) {
        const t = setTimeout(() => muteAllRemoteAudio(), 100);
        timeoutRefs.current.push(t);
      }
    };

    // Handle new track publications while deafened
    const handleTrackSubscribed = () => {
      if (isDeafened) {
        const t = setTimeout(() => muteAllRemoteAudio(), 100);
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
