import React, { useMemo } from "react";
import { SpeakingContext, SpeakingContextType } from "./SpeakingContextDef";
import { useSpeakingDetection } from "../hooks/useSpeakingDetection";

interface SpeakingProviderProps {
  children: React.ReactNode;
}

/**
 * Mounts `useSpeakingDetection` exactly ONCE for the whole app and shares the
 * result via context.
 *
 * Why: the hook owns an AudioContext + worker timer + the voice-activity gate
 * for the local mic track. Mounting it in multiple components (bottom bar,
 * user list, debug panel, ...) created N concurrent AudioContexts and N gates
 * racing on the same published track. Consumers should use `useSpeaking()`
 * instead of calling `useSpeakingDetection` directly.
 *
 * Must be rendered inside RoomProvider (the hook reads the LiveKit room via
 * useRoom) and above every consumer of speaking state.
 */
export const SpeakingProvider: React.FC<SpeakingProviderProps> = ({ children }) => {
  const { speakingMap } = useSpeakingDetection();

  const value = useMemo<SpeakingContextType>(
    () => ({
      speakingMap,
      isSpeaking: (userId: string) => speakingMap.get(userId) || false,
    }),
    [speakingMap],
  );

  return <SpeakingContext.Provider value={value}>{children}</SpeakingContext.Provider>;
};
