import { createContext } from "react";

export interface SpeakingContextType {
  /** Map of participant identity (userId) -> currently speaking */
  speakingMap: Map<string, boolean>;
  /** Check if a specific user (by identity/userId) is currently speaking */
  isSpeaking: (userId: string) => boolean;
}

/**
 * Safe default so consumers rendered outside a SpeakingProvider (isolated
 * component tests, storybook-style usage) degrade to "nobody is speaking"
 * instead of throwing. In the app the provider is always mounted (AuthGate).
 */
export const defaultSpeakingContext: SpeakingContextType = {
  speakingMap: new Map(),
  isSpeaking: () => false,
};

export const SpeakingContext = createContext<SpeakingContextType>(defaultSpeakingContext);
