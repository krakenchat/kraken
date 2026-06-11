import { createContext, useContext, useSyncExternalStore } from 'react';

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

/**
 * The Provider exposes a mutable store rather than React state so writes to
 * the event log don't cause the Provider component (or its children) to
 * re-render. Only consumers of `useVoiceEventLog()` re-render, via
 * `useSyncExternalStore`. This lets us mount the provider broadly (so the log
 * is already populated when the user opens the debug panel) without paying
 * a per-event re-render cost across the layout subtree.
 */
export interface VoiceEventLogStore {
  getSnapshot: () => VoiceEventEntry[];
  subscribe: (listener: () => void) => () => void;
  push: (entry: Omit<VoiceEventEntry, 'id' | 'timestamp'>) => void;
  clear: () => void;
}

export const VoiceEventLogContext = createContext<VoiceEventLogStore | null>(null);

const NOOP_SUBSCRIBE = () => () => {};
const EMPTY_EVENTS: VoiceEventEntry[] = Object.freeze([] as VoiceEventEntry[]) as VoiceEventEntry[];
const emptySnapshot = () => EMPTY_EVENTS;

/**
 * Reads the live voice event log. Returns null if no provider is mounted.
 * The log persists across debug-panel toggles so users can see history that
 * happened before they opened the panel.
 */
export function useVoiceEventLog(): VoiceEventLogValue | null {
  const store = useContext(VoiceEventLogContext);
  // useSyncExternalStore must be called unconditionally — pass noop fns when
  // there is no store so the hook composes safely outside the provider.
  const events = useSyncExternalStore(
    store?.subscribe ?? NOOP_SUBSCRIBE,
    store?.getSnapshot ?? emptySnapshot,
    store?.getSnapshot ?? emptySnapshot,
  );
  if (!store) return null;
  return { events, clear: store.clear };
}
