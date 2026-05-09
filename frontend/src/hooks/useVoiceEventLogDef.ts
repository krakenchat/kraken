import { createContext, useContext } from 'react';

export type VoiceEventSeverity = 'info' | 'success' | 'warn' | 'error';
export type VoiceEventCategory =
  | 'connection'
  | 'participant'
  | 'track'
  | 'subscription'
  | 'quality';

export interface VoiceEventEntry {
  id: number;
  timestamp: number;
  severity: VoiceEventSeverity;
  category: VoiceEventCategory;
  /** Short, single-line description (rendered in the debug panel). */
  message: string;
}

export interface VoiceEventLogValue {
  events: VoiceEventEntry[];
  clear: () => void;
}

export const VoiceEventLogContext = createContext<VoiceEventLogValue | null>(null);

/**
 * Reads the live voice event log. Returns null if no provider is mounted.
 * The log persists across debug-panel toggles so users can see history that
 * happened before they opened the panel.
 */
export function useVoiceEventLog(): VoiceEventLogValue | null {
  return useContext(VoiceEventLogContext);
}
