import { useState, useEffect, useRef, useCallback } from "react";
import { useRoom } from "./useRoom";
import { Participant, Track } from "livekit-client";
import { getCachedItem } from "../utils/storage";

const VOICE_SETTINGS_KEY = 'kraken_voice_settings';

interface VoiceSettingsCache {
  inputMode?: string;
  voiceActivityThreshold?: number;
}

/**
 * Hook to detect speaking state for all participants in a LiveKit room
 *
 * For the local participant, uses custom audio level analysis with a
 * configurable threshold (from voice settings). For remote participants,
 * uses LiveKit's built-in `isSpeaking` detection.
 *
 * @example
 * const { speakingMap, isSpeaking } = useSpeakingDetection();
 * const userIsSpeaking = isSpeaking(userId);
 */
export const useSpeakingDetection = () => {
  const { room } = useRoom();
  const [speakingMap, setSpeakingMap] = useState<Map<string, boolean>>(new Map());

  // Custom audio analysis refs for local participant
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  // Read threshold from settings
  const getThreshold = useCallback((): number => {
    const settings = getCachedItem<VoiceSettingsCache>(VOICE_SETTINGS_KEY);
    return settings?.voiceActivityThreshold ?? 25;
  }, []);

  useEffect(() => {
    if (!room) {
      setSpeakingMap(new Map());
      return;
    }

    // ---------------------------------------------------------------
    // Remote participants: use LiveKit's built-in isSpeaking
    // ---------------------------------------------------------------
    const handlers = new Map<string, (speaking: boolean) => void>();

    const attachRemoteHandler = (participant: Participant) => {
      const handleSpeakingChange = (speaking: boolean) => {
        setSpeakingMap((prev) => {
          const newMap = new Map(prev);
          newMap.set(participant.identity, speaking);
          return newMap;
        });
      };

      handlers.set(participant.identity, handleSpeakingChange);
      participant.on("isSpeakingChanged", handleSpeakingChange);

      setSpeakingMap((prev) => {
        const newMap = new Map(prev);
        newMap.set(participant.identity, participant.isSpeaking);
        return newMap;
      });
    };

    // Attach to existing remote participants
    room.remoteParticipants.forEach((participant) => {
      attachRemoteHandler(participant);
    });

    const handleParticipantConnected = (participant: Participant) => {
      attachRemoteHandler(participant);
    };

    const handleParticipantDisconnected = (participant: Participant) => {
      const handler = handlers.get(participant.identity);
      if (handler) {
        participant.off("isSpeakingChanged", handler);
        handlers.delete(participant.identity);
      }
      setSpeakingMap((prev) => {
        const newMap = new Map(prev);
        newMap.delete(participant.identity);
        return newMap;
      });
    };

    room.on("participantConnected", handleParticipantConnected);
    room.on("participantDisconnected", handleParticipantDisconnected);

    // ---------------------------------------------------------------
    // Local participant: custom audio level analysis with threshold
    // ---------------------------------------------------------------
    const local = room.localParticipant;
    let localAnalysisActive = false;

    const startLocalAnalysis = () => {
      // Find the local microphone track's MediaStream
      const micPub = local.getTrackPublication(Track.Source.Microphone);
      const mediaStreamTrack = micPub?.track?.mediaStreamTrack;
      if (!mediaStreamTrack) return;

      // Build an AnalyserNode from the mic track
      try {
        const ctx = new AudioContext();
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 256;
        analyser.smoothingTimeConstant = 0.5;

        const stream = new MediaStream([mediaStreamTrack]);
        const source = ctx.createMediaStreamSource(stream);
        source.connect(analyser);

        audioContextRef.current = ctx;
        analyserRef.current = analyser;
        localAnalysisActive = true;

        const dataArray = new Uint8Array(analyser.frequencyBinCount);

        const tick = () => {
          if (!localAnalysisActive || !analyserRef.current) return;

          analyser.getByteFrequencyData(dataArray);

          // Compute RMS-like level (0-100)
          let sum = 0;
          for (let i = 0; i < dataArray.length; i++) {
            sum += dataArray[i];
          }
          const average = sum / dataArray.length;
          const level = (average / 255) * 100;

          const threshold = getThreshold(); // 0-100, lower = more sensitive
          const speaking = level > threshold;

          setSpeakingMap((prev) => {
            if (prev.get(local.identity) === speaking) return prev;
            const newMap = new Map(prev);
            newMap.set(local.identity, speaking);
            return newMap;
          });

          animationFrameRef.current = requestAnimationFrame(tick);
        };

        tick();
      } catch {
        // Fall back to LiveKit's isSpeaking for local user if Web Audio fails
        const fallback = (speaking: boolean) => {
          setSpeakingMap((prev) => {
            const newMap = new Map(prev);
            newMap.set(local.identity, speaking);
            return newMap;
          });
        };
        handlers.set(local.identity, fallback);
        local.on("isSpeakingChanged", fallback);
      }
    };

    const stopLocalAnalysis = () => {
      localAnalysisActive = false;
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
        audioContextRef.current = null;
      }
      analyserRef.current = null;
    };

    // Start analysis if mic track is already published
    startLocalAnalysis();

    // Re-start if mic track changes (e.g., device switch, mute/unmute)
    const handleLocalTrackPublished = () => {
      stopLocalAnalysis();
      // Small delay to let the track stabilize
      setTimeout(() => startLocalAnalysis(), 200);
    };
    const handleLocalTrackUnpublished = () => {
      stopLocalAnalysis();
      setSpeakingMap((prev) => {
        const newMap = new Map(prev);
        newMap.set(local.identity, false);
        return newMap;
      });
    };

    local.on("localTrackPublished", handleLocalTrackPublished);
    local.on("localTrackUnpublished", handleLocalTrackUnpublished);

    // Cleanup
    return () => {
      // Remote handlers
      handlers.forEach((handler, identity) => {
        const participant =
          identity === room.localParticipant.identity
            ? room.localParticipant
            : room.remoteParticipants.get(identity);
        if (participant) {
          participant.off("isSpeakingChanged", handler);
        }
      });

      room.off("participantConnected", handleParticipantConnected);
      room.off("participantDisconnected", handleParticipantDisconnected);

      // Local analysis
      stopLocalAnalysis();
      local.off("localTrackPublished", handleLocalTrackPublished);
      local.off("localTrackUnpublished", handleLocalTrackUnpublished);
    };
  }, [room, getThreshold]);

  /**
   * Check if a specific user (by identity/userId) is currently speaking
   */
  const isSpeaking = (userId: string): boolean => {
    return speakingMap.get(userId) || false;
  };

  return {
    speakingMap,
    isSpeaking,
  };
};
