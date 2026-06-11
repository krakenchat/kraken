import type { BoostableAudioTrack } from './audioBoostManager';

/**
 * Duck-types a track as a BoostableAudioTrack (i.e. a RemoteAudioTrack, which
 * is the only RemoteTrack subtype with setVolume). Avoids `instanceof
 * RemoteAudioTrack`, which can false-fail when livekit-client is loaded twice
 * (HMR, dual bundles, test mocks).
 *
 * Lives in its own module (not audioBoostManager.ts) so tests that mock the
 * boost manager don't accidentally stub the guard out.
 */
export function isBoostableAudioTrack(track: unknown): track is BoostableAudioTrack {
  return (
    !!track && typeof (track as BoostableAudioTrack).setVolume === 'function'
  );
}
