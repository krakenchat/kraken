import { useContext } from "react";
import { SpeakingContext } from "../contexts/SpeakingContextDef";

/**
 * Read shared speaking-detection state from SpeakingProvider.
 *
 * Returns `{ speakingMap, isSpeaking }` backed by the single app-wide
 * `useSpeakingDetection` instance. Outside a provider it degrades to
 * "nobody is speaking" (see defaultSpeakingContext).
 */
export const useSpeaking = () => useContext(SpeakingContext);
