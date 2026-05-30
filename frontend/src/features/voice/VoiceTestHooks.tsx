import { useContext, useEffect, type FC } from 'react';
import { RoomContext } from '../../contexts/RoomContextDef';
import { useVoiceEventLog } from '../../hooks/useVoiceEventLogDef';
import { useTrackSubscriptionActions } from '../../hooks/useTrackSubscription';
import { captureDiagnostics, getRemoteInboundAudio } from './voiceDiagnostics';
import { isVoiceTestHookEnabled, type VoiceTestHookWindow } from './voiceTestHooks.types';
import type { VoiceEventEntry } from '../../hooks/useVoiceEventLogDef';

/**
 * Dev/test-only window hooks for driving the real LiveKit Room from automated
 * tests (Playwright `page.evaluate`). NOT active in production builds.
 *
 * Exposes:
 *  - `window.__lkRoom`                    the live Room (read state, simulateScenario, etc.)
 *  - `window.__lkCaptureDiagnostics()`    full DiagnosticsSnapshot (same as the panel's Export)
 *  - `window.__lkGetInboundAudio(id)`     parsed inbound audio stats for one remote ("can A hear B")
 *  - `window.__lkForceResubscribeMic(id)` PR #352's manual recovery action
 *
 * Gated by `isVoiceTestHookEnabled()` (vite dev or VITE_LIVEKIT_TEST_HOOK), so
 * in a production `vite build` the effect body is dead-code-eliminated and
 * nothing touches `window`.
 */
export const VoiceTestHooks: FC = () => {
  // Read the room context directly (not useRoom()) so this debug-only component
  // degrades to a no-op instead of throwing when mounted outside a RoomProvider
  // (e.g. in isolated component tests that mock the voice providers).
  const room = useContext(RoomContext)?.room ?? null;
  const log = useVoiceEventLog();
  const trackActions = useTrackSubscriptionActions();

  useEffect(() => {
    if (!isVoiceTestHookEnabled()) return;

    const w = window as unknown as VoiceTestHookWindow;
    const events = (): VoiceEventEntry[] => log?.events ?? [];

    w.__lkRoom = room ?? null;
    w.__lkCaptureDiagnostics = () => captureDiagnostics(room, events());
    w.__lkGetInboundAudio = (identity: string) => getRemoteInboundAudio(room, identity);
    w.__lkForceResubscribeMic = (identity: string) =>
      trackActions?.forceResubscribeMic(identity);
    // A simple readiness flag tests can poll before driving the room.
    w.__lkTestHooksReady = true;

    return () => {
      // Null the room so leaving voice is observable, but keep the functions so
      // late `page.evaluate` calls don't throw.
      w.__lkRoom = null;
    };
  }, [room, log, trackActions]);

  return null;
};
