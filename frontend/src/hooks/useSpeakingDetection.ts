import { useState, useEffect } from "react";
import { useRoom } from "./useRoom";
import { Participant } from "livekit-client";

/**
 * Hook to detect speaking state for all participants in a LiveKit room
 *
 * Returns a map of participant identities (user IDs) to their speaking state
 * and a helper function to check if a specific user is speaking.
 *
 * This hook reads speaking state directly from LiveKit without storing
 * it in Redux, making LiveKit the single source of truth.
 *
 * @example
 * const { speakingMap, isSpeaking } = useSpeakingDetection();
 *
 * // Check if a user is speaking
 * const userIsSpeaking = isSpeaking(userId);
 *
 * // Or access the map directly
 * const allSpeakingUsers = Array.from(speakingMap.entries())
 *   .filter(([_, speaking]) => speaking)
 *   .map(([identity, _]) => identity);
 */
export const useSpeakingDetection = () => {
  const { room } = useRoom();
  const [speakingMap, setSpeakingMap] = useState<Map<string, boolean>>(new Map());

  useEffect(() => {
    if (!room) {
      // Clear speaking map when no room is active
      setSpeakingMap(new Map());
      return;
    }

    // Track all participants (local + remote)
    const participants: Participant[] = [
      room.localParticipant,
      ...Array.from(room.remoteParticipants.values()),
    ];

    // Create event handlers for each participant
    const handlers = new Map<string, (speaking: boolean) => void>();

    participants.forEach((participant) => {
      const handleSpeakingChange = (speaking: boolean) => {
        setSpeakingMap((prev) => {
          const newMap = new Map(prev);
          newMap.set(participant.identity, speaking);
          return newMap;
        });
      };

      // Store handler for cleanup
      handlers.set(participant.identity, handleSpeakingChange);

      // Attach event listener
      participant.on("isSpeakingChanged", handleSpeakingChange);

      // Initialize current speaking state
      setSpeakingMap((prev) => {
        const newMap = new Map(prev);
        newMap.set(participant.identity, participant.isSpeaking);
        return newMap;
      });
    });

    // Handle new participants joining
    const handleParticipantConnected = (participant: Participant) => {
      const handleSpeakingChange = (speaking: boolean) => {
        setSpeakingMap((prev) => {
          const newMap = new Map(prev);
          newMap.set(participant.identity, speaking);
          return newMap;
        });
      };

      handlers.set(participant.identity, handleSpeakingChange);
      participant.on("isSpeakingChanged", handleSpeakingChange);

      // Initialize speaking state for new participant
      setSpeakingMap((prev) => {
        const newMap = new Map(prev);
        newMap.set(participant.identity, participant.isSpeaking);
        return newMap;
      });
    };

    // Handle participants leaving
    const handleParticipantDisconnected = (participant: Participant) => {
      const handler = handlers.get(participant.identity);
      if (handler) {
        participant.off("isSpeakingChanged", handler);
        handlers.delete(participant.identity);
      }

      // Remove from speaking map
      setSpeakingMap((prev) => {
        const newMap = new Map(prev);
        newMap.delete(participant.identity);
        return newMap;
      });
    };

    // Attach room-level event listeners
    room.on("participantConnected", handleParticipantConnected);
    room.on("participantDisconnected", handleParticipantDisconnected);

    // Cleanup function
    return () => {
      // Remove all participant event listeners
      handlers.forEach((handler, identity) => {
        const participant =
          identity === room.localParticipant.identity
            ? room.localParticipant
            : room.remoteParticipants.get(identity);

        if (participant) {
          participant.off("isSpeakingChanged", handler);
        }
      });

      // Remove room event listeners
      room.off("participantConnected", handleParticipantConnected);
      room.off("participantDisconnected", handleParticipantDisconnected);
    };
  }, [room]);

  /**
   * Check if a specific user (by identity/userId) is currently speaking
   * @param userId - The user's identity (typically their user ID)
   * @returns true if the user is speaking, false otherwise
   */
  const isSpeaking = (userId: string): boolean => {
    return speakingMap.get(userId) || false;
  };

  return {
    speakingMap,
    isSpeaking,
  };
};
