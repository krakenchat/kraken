import { useState, useEffect, useRef, useCallback } from "react";
import { useRoom } from "./useRoom";
import { Participant, Track } from "livekit-client";
import { getCachedItem } from "../utils/storage";

const VOICE_SETTINGS_KEY = 'kraken_voice_settings';
const HOLD_OPEN_MS = 300;
const MIN_CLOSE_MS = 100;
const HYSTERESIS_OFFSET = 5;

interface VoiceSettingsCache {
  inputMode?: string;
  voiceActivityThreshold?: number;
}

/**
 * Hook to detect speaking state for all participants in a LiveKit room,
 * and gate local audio transmission in Voice Activity mode.
 *
 * For the local participant, uses a single AnalyserNode + requestAnimationFrame
 * loop to both update the speaking indicator AND control `mediaStreamTrack.enabled`
 * (sending silence frames when below threshold). The gate and indicator share
 * identical timing so they stay perfectly in sync.
 *
 * For remote participants, uses LiveKit's built-in `isSpeaking` detection.
 *
 * Gate behaviour (Voice Activity mode only):
 * - **Hold-open**: 300ms delay before closing after speech stops
 * - **Hysteresis**: close threshold is 5 points below open threshold
 * - **Min close time**: 100ms minimum before re-opening
 * - **Cleanup**: re-enables `mediaStreamTrack.enabled = true`
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
  const localAnalysisActiveRef = useRef(false);
  const localTrackTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Gate state refs (used for both indicator and audio gating)
  const gateOpenRef = useRef(true);
  const lastAboveThresholdRef = useRef(0);
  const lastGateCloseRef = useRef(0);

  // Read settings from localStorage
  const getSettings = useCallback((): { threshold: number; isVoiceActivity: boolean } => {
    const settings = getCachedItem<VoiceSettingsCache>(VOICE_SETTINGS_KEY);
    return {
      threshold: settings?.voiceActivityThreshold ?? 25,
      isVoiceActivity: (settings?.inputMode ?? 'voice_activity') === 'voice_activity',
    };
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
    // Local participant: unified audio analysis + gating
    // ---------------------------------------------------------------
    const local = room.localParticipant;

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
        localAnalysisActiveRef.current = true;

        // Initialize gate state
        gateOpenRef.current = true;
        lastAboveThresholdRef.current = Date.now();
        lastGateCloseRef.current = 0;

        const dataArray = new Uint8Array(analyser.frequencyBinCount);

        const tick = () => {
          if (!localAnalysisActiveRef.current || !analyserRef.current) return;

          analyser.getByteFrequencyData(dataArray);

          // Compute RMS-like level (0-100)
          let sum = 0;
          for (let i = 0; i < dataArray.length; i++) {
            sum += dataArray[i];
          }
          const average = sum / dataArray.length;
          const level = (average / 255) * 100;

          const { threshold, isVoiceActivity } = getSettings();
          const now = Date.now();

          if (isVoiceActivity) {
            // ---------- Gated mode: drive both indicator and track.enabled ----------
            if (gateOpenRef.current) {
              // Gate is open — check if we should close
              const closeThreshold = Math.max(0, threshold - HYSTERESIS_OFFSET);
              if (level > closeThreshold) {
                lastAboveThresholdRef.current = now;
                // Keep speaking indicator on while gate is open and transmitting
                setSpeakingMap((prev) => {
                  if (prev.get(local.identity) === true) return prev;
                  const newMap = new Map(prev);
                  newMap.set(local.identity, true);
                  return newMap;
                });
              } else {
                const elapsed = now - lastAboveThresholdRef.current;
                if (elapsed >= HOLD_OPEN_MS) {
                  gateOpenRef.current = false;
                  lastGateCloseRef.current = now;
                  mediaStreamTrack.enabled = false;
                  setSpeakingMap((prev) => {
                    if (prev.get(local.identity) === false) return prev;
                    const newMap = new Map(prev);
                    newMap.set(local.identity, false);
                    return newMap;
                  });
                }
              }
            } else {
              // Gate is closed — check if we should open
              if (level > threshold) {
                const closedFor = now - lastGateCloseRef.current;
                if (closedFor >= MIN_CLOSE_MS) {
                  gateOpenRef.current = true;
                  lastAboveThresholdRef.current = now;
                  mediaStreamTrack.enabled = true;
                  setSpeakingMap((prev) => {
                    if (prev.get(local.identity) === true) return prev;
                    const newMap = new Map(prev);
                    newMap.set(local.identity, true);
                    return newMap;
                  });
                }
              }
            }
          } else {
            // ---------- Non-gated mode (PTT): simple threshold indicator ----------
            // Ensure track is enabled (PTT controls it separately)
            if (!mediaStreamTrack.enabled) {
              mediaStreamTrack.enabled = true;
              gateOpenRef.current = true;
            }
            const speaking = level > threshold;
            setSpeakingMap((prev) => {
              if (prev.get(local.identity) === speaking) return prev;
              const newMap = new Map(prev);
              newMap.set(local.identity, speaking);
              return newMap;
            });
          }

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
      localAnalysisActiveRef.current = false;
      if (localTrackTimeoutRef.current) {
        clearTimeout(localTrackTimeoutRef.current);
        localTrackTimeoutRef.current = null;
      }
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
        audioContextRef.current = null;
      }
      analyserRef.current = null;

      // Re-enable track so PTT/manual mute work normally
      const micPub = local.getTrackPublication(Track.Source.Microphone);
      const track = micPub?.track?.mediaStreamTrack;
      if (track) {
        track.enabled = true;
      }
      gateOpenRef.current = true;
    };

    // Start analysis if mic track is already published
    startLocalAnalysis();

    // Re-start if mic track changes (e.g., device switch, mute/unmute)
    const handleLocalTrackPublished = () => {
      stopLocalAnalysis();
      // Small delay to let the track stabilize
      localTrackTimeoutRef.current = setTimeout(() => startLocalAnalysis(), 200);
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

      // Local analysis + gating cleanup
      stopLocalAnalysis();
      local.off("localTrackPublished", handleLocalTrackPublished);
      local.off("localTrackUnpublished", handleLocalTrackUnpublished);
    };
  }, [room, getSettings]);

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
