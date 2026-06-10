import { useEffect, useRef } from 'react';
import { logger } from '../utils/logger';
import { useVoice } from '../contexts/VoiceContext';
import { useRoom } from './useRoom';
import { Track } from 'livekit-client';
import { audioBoostManager, boostKey } from '../features/voice/audioBoostManager';
import { getStoredVolumePercent } from '../features/voice/volumeStorage';

function isBoostableAudioSource(source: Track.Source | string): boolean {
  return source === Track.Source.Microphone || source === Track.Source.ScreenShareAudio;
}

/**
 * Hook that implements proper deafen functionality by muting received audio tracks
 *
 * When isDeafened is true:
 * - Sets volume to 0 for all remote audio tracks
 * - Silences all GainNode boost paths (>100% volumes) via the audioBoostManager
 * - Also mutes the user's microphone (standard deafen behavior)
 *
 * When isDeafened is false:
 * - Restores each participant's per-user stored volume (from localStorage),
 *   including >100% boost levels, via the audioBoostManager
 * - Falls back to 100% if no stored volume exists
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
          if (publication.track && isBoostableAudioSource(publication.source)) {
            publication.track.setVolume(0);
          }
        });
      });
    };

    // Restore per-user stored volumes (including >100% boost) for all remote audio tracks
    const restoreRemoteAudioVolumes = () => {
      room.remoteParticipants.forEach((participant) => {
        participant.audioTrackPublications.forEach((publication) => {
          if (publication.track && isBoostableAudioSource(publication.source)) {
            const volumePercent =
              getStoredVolumePercent(participant.identity, publication.source) ?? 100;
            audioBoostManager.applyVolume(
              publication.track,
              boostKey(participant.identity, publication.source),
              volumePercent,
            );
          }
        });
      });
    };

    // Apply current deafen state. The boost manager flag must flip first so
    // GainNode paths are silenced/restored consistently with track volumes.
    if (isDeafened) {
      audioBoostManager.setDeafened(true);
      muteAllRemoteAudio();
      logger.dev('[Voice] Deafened: muted all remote audio tracks');
    } else {
      audioBoostManager.setDeafened(false);
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
