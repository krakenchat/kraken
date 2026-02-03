/**
 * useReplayBuffer Hook
 *
 * Automatically manages LiveKit egress recording when screen sharing.
 * Uses LiveKit event listeners to detect when screen share starts/stops.
 *
 * When user publishes screen share track:
 * - Extracts track IDs (video + audio)
 * - Calls backend to start egress recording
 *
 * When screen share track is unpublished:
 * - Calls backend to stop egress recording
 */

import { useEffect, useState, useRef } from 'react';
import { logger } from '../utils/logger';
import { Track, LocalTrackPublication, RoomEvent } from 'livekit-client';
import {
  useStartReplayBufferMutation,
  useStopReplayBufferMutation,
} from '../features/livekit/livekitApiSlice';
import { useSocket } from './useSocket';
import { ServerEvents } from '../types/server-events.enum';
import { useNotification } from '../contexts/NotificationContext';
import { useVoiceConnection } from './useVoiceConnection';

export const useReplayBuffer = () => {
  const { state } = useVoiceConnection();
  const room = state.room;
  const socket = useSocket();
  const [startReplayBuffer] = useStartReplayBufferMutation();
  const [stopReplayBuffer] = useStopReplayBufferMutation();
  const { showNotification } = useNotification();

  // Get current voice channel from voice connection state
  const currentVoiceChannel = state.currentChannelId;

  // Track whether replay buffer is active (using state for reactivity)
  const [isReplayBufferActive, setIsReplayBufferActive] = useState(false);

  // Use refs to prevent race conditions - these are always current, not stale closures
  const isOperationPendingRef = useRef(false);
  const isActiveRef = useRef(false);

  // Keep ref in sync with state for external reactivity
  useEffect(() => {
    isActiveRef.current = isReplayBufferActive;
  }, [isReplayBufferActive]);

  // Listen for LiveKit track events to start/stop replay buffer
  useEffect(() => {
    if (!room || !currentVoiceChannel) return;

    const handleTrackPublished = async (publication: LocalTrackPublication) => {
      // Only handle screen share tracks
      if (publication.source !== Track.Source.ScreenShare) return;

      // Prevent race conditions - use refs which are always current
      if (isActiveRef.current || isOperationPendingRef.current) {
        logger.dev('[ReplayBuffer] Already active or operation pending, skipping');
        return;
      }

      // Extract track IDs
      const videoTrackId = publication.videoTrack?.sid;
      const audioTrackId = publication.audioTrack?.sid;

      if (!videoTrackId) {
        logger.warn('[ReplayBuffer] Screen share has no video track');
        return;
      }

      // Get participant identity for track resolution query
      const participantIdentity = room.localParticipant?.identity;

      logger.dev('[ReplayBuffer] Screen share published, starting replay buffer', {
        channelId: currentVoiceChannel,
        roomName: room.name,
        videoTrackId,
        audioTrackId,
        participantIdentity,
      });

      // Mark operation as pending to prevent concurrent calls
      isOperationPendingRef.current = true;

      try {
        await startReplayBuffer({
          channelId: currentVoiceChannel,
          roomName: room.name,
          videoTrackId,
          audioTrackId: audioTrackId || '',
          participantIdentity, // Pass identity for track resolution matching
        }).unwrap();

        isActiveRef.current = true;
        setIsReplayBufferActive(true);
        showNotification('Replay available', 'success');
        logger.dev('[ReplayBuffer] Replay buffer started successfully');
      } catch (error) {
        logger.error('[ReplayBuffer] Failed to start replay buffer:', error);
        showNotification('Replay unavailable', 'error');
      } finally {
        isOperationPendingRef.current = false;
      }
    };

    const handleTrackUnpublished = async (publication: LocalTrackPublication) => {
      // Only handle screen share tracks
      if (publication.source !== Track.Source.ScreenShare) return;

      // Prevent race conditions - use refs which are always current
      if (!isActiveRef.current || isOperationPendingRef.current) {
        logger.dev('[ReplayBuffer] Not active or operation pending, skipping');
        return;
      }

      logger.dev('[ReplayBuffer] Screen share unpublished, stopping replay buffer');

      // Mark operation as pending to prevent concurrent calls
      isOperationPendingRef.current = true;

      try {
        await stopReplayBuffer().unwrap();
        isActiveRef.current = false;
        setIsReplayBufferActive(false);
        logger.dev('[ReplayBuffer] Replay buffer stopped successfully');
      } catch (error) {
        logger.error('[ReplayBuffer] Failed to stop replay buffer:', error);
      } finally {
        isOperationPendingRef.current = false;
      }
    };

    // Attach event listeners to room (not localParticipant)
    room.on(RoomEvent.LocalTrackPublished, handleTrackPublished);
    room.on(RoomEvent.LocalTrackUnpublished, handleTrackUnpublished);

    return () => {
      room.off(RoomEvent.LocalTrackPublished, handleTrackPublished);
      room.off(RoomEvent.LocalTrackUnpublished, handleTrackUnpublished);
    };
  }, [
    room,
    currentVoiceChannel,
    startReplayBuffer,
    stopReplayBuffer,
    showNotification,
  ]);

  // Listen for WebSocket events when egress stops automatically (disconnect, track end, etc.)
  useEffect(() => {
    if (!socket) return;

    const handleReplayBufferStopped = (data: {
      sessionId: string;
      egressId: string;
      channelId: string;
    }) => {
      logger.dev('[ReplayBuffer] Egress stopped by LiveKit:', data);
      showNotification('Replay ended', 'info');
      isActiveRef.current = false;
      setIsReplayBufferActive(false);
    };

    const handleReplayBufferFailed = (data: {
      sessionId: string;
      egressId: string;
      channelId: string;
      error: string;
    }) => {
      logger.error('[ReplayBuffer] Egress failed:', data);
      showNotification('Replay unavailable', 'error');
      isActiveRef.current = false;
      setIsReplayBufferActive(false);
    };

    socket.on(ServerEvents.REPLAY_BUFFER_STOPPED, handleReplayBufferStopped);
    socket.on(ServerEvents.REPLAY_BUFFER_FAILED, handleReplayBufferFailed);

    return () => {
      socket.off(ServerEvents.REPLAY_BUFFER_STOPPED, handleReplayBufferStopped);
      socket.off(ServerEvents.REPLAY_BUFFER_FAILED, handleReplayBufferFailed);
    };
  }, [socket, showNotification]);

  // Cleanup: stop replay buffer when component unmounts if still active
  useEffect(() => {
    return () => {
      // Use refs to check current state on unmount (not stale closure)
      if (isActiveRef.current && !isOperationPendingRef.current) {
        logger.dev('[ReplayBuffer] Component unmounting, stopping replay buffer');
        stopReplayBuffer().catch((error) => {
          // Ignore 404 errors - session may already be stopped
          const errorObj = error as { status?: number };
          if (errorObj?.status !== 404) {
            logger.error('[ReplayBuffer] Failed to stop on unmount:', error);
          }
        });
      }
    };
  }, [stopReplayBuffer]);

  return {
    isReplayBufferActive,
  };
};
