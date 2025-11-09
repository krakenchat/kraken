import { useState, useEffect } from 'react';
import { useRoom } from './useRoom';
import {
  LocalAudioTrack,
  LocalVideoTrack,
  RoomEvent,
  Track,
  LocalTrackPublication
} from 'livekit-client';

/**
 * Hook to read local participant's media state directly from LiveKit
 *
 * This replaces Redux state for:
 * - isVideoEnabled (camera)
 * - isAudioEnabled (microphone)
 * - isScreenSharing
 *
 * LiveKit is the single source of truth for these states.
 *
 * @returns Local media state from LiveKit room
 *
 * @example
 * const { isCameraEnabled, isMicrophoneEnabled, isScreenShareEnabled } = useLocalMediaState();
 *
 * if (isCameraEnabled) {
 *   // Show video controls
 * }
 */
export const useLocalMediaState = () => {
  const { room } = useRoom();
  const [isCameraEnabled, setIsCameraEnabled] = useState(false);
  const [isMicrophoneEnabled, setIsMicrophoneEnabled] = useState(false);
  const [isScreenShareEnabled, setIsScreenShareEnabled] = useState(false);
  const [audioTrack, setAudioTrack] = useState<LocalAudioTrack | undefined>();
  const [videoTrack, setVideoTrack] = useState<LocalVideoTrack | undefined>();

  useEffect(() => {
    if (!room) {
      // Reset state when no room is connected
      setIsCameraEnabled(false);
      setIsMicrophoneEnabled(false);
      setIsScreenShareEnabled(false);
      setAudioTrack(undefined);
      setVideoTrack(undefined);
      return;
    }

    const localParticipant = room.localParticipant;

    // Initialize state from current publications
    const updateMediaState = () => {
      // Check camera (video track)
      const cameraPublication = localParticipant.getTrackPublication(Track.Source.Camera);
      const isCameraPublished = !!cameraPublication && !cameraPublication.isMuted;
      setIsCameraEnabled(isCameraPublished);
      setVideoTrack(cameraPublication?.track as LocalVideoTrack | undefined);

      // Check microphone (audio track)
      const micPublication = localParticipant.getTrackPublication(Track.Source.Microphone);
      const isMicPublished = !!micPublication && !micPublication.isMuted;
      setIsMicrophoneEnabled(isMicPublished);
      setAudioTrack(micPublication?.track as LocalAudioTrack | undefined);

      // Check screen share
      const screenSharePublication = localParticipant.getTrackPublication(Track.Source.ScreenShare);
      const isScreenPublished = !!screenSharePublication && !screenSharePublication.isMuted;
      setIsScreenShareEnabled(isScreenPublished);
    };

    // Initialize state
    updateMediaState();

    // Listen to track published/unpublished events
    const handleLocalTrackPublished = (publication: LocalTrackPublication) => {
      if (publication.source === Track.Source.Camera) {
        setIsCameraEnabled(true);
        setVideoTrack(publication.track as LocalVideoTrack);
      } else if (publication.source === Track.Source.Microphone) {
        setIsMicrophoneEnabled(true);
        setAudioTrack(publication.track as LocalAudioTrack);
      } else if (publication.source === Track.Source.ScreenShare) {
        setIsScreenShareEnabled(true);
      }
    };

    const handleLocalTrackUnpublished = (publication: LocalTrackPublication) => {
      if (publication.source === Track.Source.Camera) {
        setIsCameraEnabled(false);
        setVideoTrack(undefined);
      } else if (publication.source === Track.Source.Microphone) {
        setIsMicrophoneEnabled(false);
        setAudioTrack(undefined);
      } else if (publication.source === Track.Source.ScreenShare) {
        setIsScreenShareEnabled(false);
      }
    };

    const handleTrackMuted = (publication: LocalTrackPublication) => {
      // When a track is muted (not unpublished), update state
      if (publication.source === Track.Source.Camera) {
        setIsCameraEnabled(false);
      } else if (publication.source === Track.Source.Microphone) {
        setIsMicrophoneEnabled(false);
      } else if (publication.source === Track.Source.ScreenShare) {
        setIsScreenShareEnabled(false);
      }
    };

    const handleTrackUnmuted = (publication: LocalTrackPublication) => {
      // When a track is unmuted, update state
      if (publication.source === Track.Source.Camera) {
        setIsCameraEnabled(true);
      } else if (publication.source === Track.Source.Microphone) {
        setIsMicrophoneEnabled(true);
      } else if (publication.source === Track.Source.ScreenShare) {
        setIsScreenShareEnabled(true);
      }
    };

    // Attach event listeners
    room.on(RoomEvent.LocalTrackPublished, handleLocalTrackPublished);
    room.on(RoomEvent.LocalTrackUnpublished, handleLocalTrackUnpublished);
    room.on(RoomEvent.TrackMuted, handleTrackMuted);
    room.on(RoomEvent.TrackUnmuted, handleTrackUnmuted);

    // Cleanup function
    return () => {
      room.off(RoomEvent.LocalTrackPublished, handleLocalTrackPublished);
      room.off(RoomEvent.LocalTrackUnpublished, handleLocalTrackUnpublished);
      room.off(RoomEvent.TrackMuted, handleTrackMuted);
      room.off(RoomEvent.TrackUnmuted, handleTrackUnmuted);
    };
  }, [room]);

  return {
    isCameraEnabled,
    isMicrophoneEnabled,
    isScreenShareEnabled,
    audioTrack,
    videoTrack,
  };
};
