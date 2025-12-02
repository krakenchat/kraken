import React, { useEffect, useRef, useState, useCallback } from 'react';
import { RemoteParticipant, RemoteTrackPublication, Track, AudioTrack, RoomEvent } from 'livekit-client';
import { useRoom } from '../../hooks/useRoom';

/**
 * Renders a hidden audio element for a single remote participant's audio track.
 * Handles track attachment/detachment lifecycle.
 */
interface ParticipantAudioProps {
  participant: RemoteParticipant;
  audioPublication: RemoteTrackPublication;
}

const ParticipantAudio: React.FC<ParticipantAudioProps> = ({ audioPublication }) => {
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    const audioElement = audioRef.current;
    if (!audioElement) return;

    const track = audioPublication.track as AudioTrack | undefined;
    if (!track) return;

    // Attach the audio track to the audio element
    track.attach(audioElement);

    return () => {
      // Detach the audio track when unmounting or track changes
      track.detach(audioElement);
    };
  }, [audioPublication, audioPublication.track]);

  return (
    <audio
      ref={audioRef}
      autoPlay
      playsInline
      // Not muted - we want to hear remote audio
      // Volume control is handled by useDeafenEffect hook via track.setVolume()
    />
  );
};

/**
 * AudioRenderer component that renders hidden audio elements for all remote participants.
 *
 * This component is necessary because the app uses manual LiveKit Room management
 * (via RoomContext) instead of the LiveKitRoom provider. Without this component,
 * remote audio tracks are never attached to audio elements for playback.
 *
 * The deafen functionality is handled by the useDeafenEffect hook which sets
 * track volume to 0 when deafened.
 *
 * @example
 * // In Layout.tsx or MobileLayout.tsx, alongside VoiceBottomBar
 * <VoiceBottomBar />
 * <AudioRenderer />
 */
export const AudioRenderer: React.FC = () => {
  const { room } = useRoom();
  const [audioTracks, setAudioTracks] = useState<Map<string, { participant: RemoteParticipant; publication: RemoteTrackPublication }>>(new Map());

  // Update audio tracks list when participants/tracks change
  const updateAudioTracks = useCallback(() => {
    if (!room) {
      setAudioTracks(new Map());
      return;
    }

    const newTracks = new Map<string, { participant: RemoteParticipant; publication: RemoteTrackPublication }>();

    room.remoteParticipants.forEach((participant) => {
      participant.audioTrackPublications.forEach((publication) => {
        // Only include microphone tracks (not screen share audio)
        if (publication.source === Track.Source.Microphone && publication.track) {
          const key = `${participant.identity}-${publication.trackSid}`;
          newTracks.set(key, { participant, publication });
        }
      });
    });

    setAudioTracks(newTracks);
  }, [room]);

  useEffect(() => {
    if (!room) return;

    // Initial update
    updateAudioTracks();

    // Subscribe to relevant room events
    const handleTrackSubscribed = () => {
      updateAudioTracks();
    };

    const handleTrackUnsubscribed = () => {
      updateAudioTracks();
    };

    const handleParticipantConnected = () => {
      updateAudioTracks();
    };

    const handleParticipantDisconnected = () => {
      updateAudioTracks();
    };

    room.on(RoomEvent.TrackSubscribed, handleTrackSubscribed);
    room.on(RoomEvent.TrackUnsubscribed, handleTrackUnsubscribed);
    room.on(RoomEvent.ParticipantConnected, handleParticipantConnected);
    room.on(RoomEvent.ParticipantDisconnected, handleParticipantDisconnected);

    return () => {
      room.off(RoomEvent.TrackSubscribed, handleTrackSubscribed);
      room.off(RoomEvent.TrackUnsubscribed, handleTrackUnsubscribed);
      room.off(RoomEvent.ParticipantConnected, handleParticipantConnected);
      room.off(RoomEvent.ParticipantDisconnected, handleParticipantDisconnected);
    };
  }, [room, updateAudioTracks]);

  // Don't render anything visible - just hidden audio elements
  if (!room || audioTracks.size === 0) {
    return null;
  }

  return (
    <>
      {Array.from(audioTracks.entries()).map(([key, { participant, publication }]) => (
        <ParticipantAudio
          key={key}
          participant={participant}
          audioPublication={publication}
        />
      ))}
    </>
  );
};
