import { useEffect, useRef } from 'react';
import { RoomEvent, Track, type RemoteTrackPublication, type RemoteParticipant } from 'livekit-client';
import { useRoom } from './useRoom';
import { useVoice } from '../contexts/VoiceContext';
import { VOLUME_STORAGE_PREFIX, SCREENSHARE_VOLUME_STORAGE_PREFIX } from '../constants/voice';
import { logger } from '../utils/logger';

/**
 * Hook that reapplies per-user volume from localStorage when remote tracks
 * are subscribed. This fixes the issue where "mute for me" gets overridden
 * when a remote user toggles their mic (track re-subscribes at default volume).
 *
 * Skips volume application when deafened (useDeafenEffect handles that case).
 */
export const useRemoteVolumeEffect = () => {
  const { room } = useRoom();
  const { isDeafened } = useVoice();
  const isDeafenedRef = useRef(isDeafened);

  // Keep ref in sync to avoid event listener churn
  useEffect(() => {
    isDeafenedRef.current = isDeafened;
  }, [isDeafened]);

  useEffect(() => {
    if (!room) return;

    const handleTrackSubscribed = (
      _track: unknown,
      publication: RemoteTrackPublication,
      participant: RemoteParticipant,
    ) => {
      // Only handle audio tracks
      if (
        publication.source !== Track.Source.Microphone &&
        publication.source !== Track.Source.ScreenShareAudio
      ) {
        return;
      }

      // Skip when deafened — useDeafenEffect manages volume in that case
      if (isDeafenedRef.current) return;

      const storagePrefix =
        publication.source === Track.Source.ScreenShareAudio
          ? SCREENSHARE_VOLUME_STORAGE_PREFIX
          : VOLUME_STORAGE_PREFIX;

      let storedRaw: string | null = null;
      try {
        storedRaw = localStorage.getItem(
          `${storagePrefix}${participant.identity}`,
        );
      } catch {
        // localStorage may throw in sandboxed/private environments
        return;
      }
      if (storedRaw === null) return; // No stored volume, use default

      const storedVolume = parseFloat(storedRaw);
      if (isNaN(storedVolume)) return;

      // Clamp to [0, 1] for track.setVolume; GainNode for >100% is managed by VoiceUserContextMenu
      const trackVolume = Math.max(0, Math.min(storedVolume, 1.0));

      if (publication.track) {
        publication.track.setVolume(trackVolume);
        logger.dev(
          `[Voice] Applied stored volume ${trackVolume} for ${participant.identity}`,
        );
      }
    };

    room.on(RoomEvent.TrackSubscribed, handleTrackSubscribed);

    return () => {
      room.off(RoomEvent.TrackSubscribed, handleTrackSubscribed);
    };
  }, [room]);
};
