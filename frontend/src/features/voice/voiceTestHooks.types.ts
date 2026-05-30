import type { Room } from 'livekit-client';
import type { DiagnosticsSnapshot, InboundAudioStats } from './voiceDiagnostics';

/**
 * Shape of the dev/test-only window hooks exposed by `VoiceTestHooks`.
 * Kept in a non-component module so the component file only exports a component
 * (satisfies react-refresh/only-export-components).
 */
export interface VoiceTestHookWindow {
  __lkRoom: Room | null;
  __lkCaptureDiagnostics: () => Promise<DiagnosticsSnapshot>;
  __lkGetInboundAudio: (identity: string) => Promise<InboundAudioStats | undefined>;
  __lkForceResubscribeMic: (identity: string) => void;
  /**
   * deviceId of the local mic's active capture track (from getSettings()).
   * Used to prove PR #346: switching the input device updates the live track
   * without rejoining. Returns null when no mic track is published.
   */
  __lkGetLocalMicDeviceId: () => string | null;
  __lkTestHooksReady: boolean;
}

/**
 * Gate for the window test hooks: active only in vite dev (`import.meta.env.DEV`)
 * or when `VITE_LIVEKIT_TEST_HOOK === 'true'` (set in the voice-e2e compose).
 * Both are statically false in a production `vite build`, so callers guarded by
 * this are dead-code-eliminated.
 */
export const isVoiceTestHookEnabled = (): boolean =>
  import.meta.env.DEV || import.meta.env.VITE_LIVEKIT_TEST_HOOK === 'true';
