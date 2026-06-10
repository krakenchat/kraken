import { useEffect, useRef } from 'react';
import {
  RoomEvent,
  Track,
  type RemoteTrackPublication,
  type RemoteParticipant,
} from 'livekit-client';
import { useRoom } from './useRoom';
import { useVoice } from '../contexts/VoiceContext';
import { audioBoostManager, boostKey } from '../features/voice/audioBoostManager';
import { getStoredVolumePercent } from '../features/voice/volumeStorage';
import { logger } from '../utils/logger';

function isBoostableAudioSource(source: Track.Source | string): boolean {
  return source === Track.Source.Microphone || source === Track.Source.ScreenShareAudio;
}

/**
 * Hook that applies per-user volume (including >100% GainNode boost) whenever
 * remote audio tracks are subscribed, and tears boost wiring down when tracks
 * or participants go away.
 *
 * This is the single persistent owner of remote volume application. UI surfaces
 * (context menu, screenshare popover) only write localStorage and forward live
 * slider changes to the audioBoostManager — the audible path must never depend
 * on an ephemeral component staying mounted.
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
      if (!isBoostableAudioSource(publication.source)) return;

      // Skip when deafened — useDeafenEffect manages volume in that case
      if (isDeafenedRef.current) return;

      if (!publication.track) return;

      // Default to 100% so a resubscribed track also clears any stale boost
      // wiring left from its previous incarnation.
      const volumePercent =
        getStoredVolumePercent(participant.identity, publication.source) ?? 100;

      audioBoostManager.applyVolume(
        publication.track,
        boostKey(participant.identity, publication.source),
        volumePercent,
      );
      logger.dev(
        `[Voice] Applied stored volume ${volumePercent}% for ${participant.identity}`,
      );
    };

    const handleTrackUnsubscribed = (
      _track: unknown,
      publication: RemoteTrackPublication,
      participant: RemoteParticipant,
    ) => {
      if (!isBoostableAudioSource(publication.source)) return;
      audioBoostManager.removeEntry(boostKey(participant.identity, publication.source));
    };

    const handleParticipantDisconnected = (participant: RemoteParticipant) => {
      audioBoostManager.removeForParticipant(participant.identity);
    };

    const handleDisconnected = () => {
      audioBoostManager.reset();
    };

    room.on(RoomEvent.TrackSubscribed, handleTrackSubscribed);
    room.on(RoomEvent.TrackUnsubscribed, handleTrackUnsubscribed);
    room.on(RoomEvent.ParticipantDisconnected, handleParticipantDisconnected);
    room.on(RoomEvent.Disconnected, handleDisconnected);

    return () => {
      room.off(RoomEvent.TrackSubscribed, handleTrackSubscribed);
      room.off(RoomEvent.TrackUnsubscribed, handleTrackUnsubscribed);
      room.off(RoomEvent.ParticipantDisconnected, handleParticipantDisconnected);
      room.off(RoomEvent.Disconnected, handleDisconnected);
    };
  }, [room]);
};
