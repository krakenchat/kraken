import { logger } from '../../utils/logger';

/**
 * Minimal shape of a LiveKit remote audio track that the boost manager needs.
 * Kept structural so tests and future track types don't depend on livekit-client.
 */
export interface BoostableAudioTrack {
  setVolume(v: number): void;
  mediaStream?: MediaStream | null;
}

export interface AudioBoostManager {
  /**
   * Apply a 0-200% volume to a track.
   * - 0-100: plays through the track's own audio element via track.setVolume.
   * - 101-200: mutes the track and routes its mediaStream through a GainNode.
   * Safe to call repeatedly and with replacement tracks (after resubscribe);
   * the GainNode wiring is rebuilt when the underlying mediaStream changes.
   */
  applyVolume(track: BoostableAudioTrack, key: string, volumePercent: number): void;
  /** Silence/restore all GainNode boost paths (track volumes are handled by useDeafenEffect). */
  setDeafened(deafened: boolean): void;
  /** Tear down the boost wiring for one track key. */
  removeEntry(key: string): void;
  /** Tear down all boost wiring for a participant (e.g. on disconnect). */
  removeForParticipant(identity: string): void;
  /** Tear down everything and release the AudioContext (e.g. on room disconnect). */
  reset(): void;
  /** Whether a GainNode boost path is active for this key. */
  hasBoost(key: string): boolean;
}

/** Canonical boost entry key: `${participantIdentity}:${trackSource}`. */
export function boostKey(identity: string, source: string): string {
  return `${identity}:${source}`;
}

interface BoostEntry {
  sourceNode: MediaStreamAudioSourceNode;
  gainNode: GainNode;
  mediaStream: MediaStream;
  volumePercent: number;
}

/**
 * Creates a manager for Web Audio GainNode volume boosting (>100%).
 *
 * This lives at module level (see the `audioBoostManager` singleton) rather
 * than inside a component hook on purpose: a boosted track has its LiveKit
 * volume forced to 0, so the GainNode path is the ONLY audible path. If the
 * wiring died with a component unmount (the old useAudioBoost behavior), the
 * participant would go silent for the local user until a resubscribe.
 */
export function createAudioBoostManager(): AudioBoostManager {
  const entries = new Map<string, BoostEntry>();
  let audioContext: AudioContext | null = null;
  let deafened = false;

  function getContext(): AudioContext {
    if (!audioContext || audioContext.state === 'closed') {
      audioContext = new AudioContext();
    }
    if (audioContext.state === 'suspended') {
      // Autoplay policy can suspend a context created outside a user gesture.
      audioContext.resume().catch((e) => {
        logger.warn('[AudioBoost] Failed to resume AudioContext:', e);
      });
    }
    return audioContext;
  }

  function disconnectEntry(entry: BoostEntry) {
    try {
      entry.sourceNode.disconnect();
      entry.gainNode.disconnect();
    } catch (e) {
      logger.warn('[AudioBoost] Failed to disconnect boost nodes:', e);
    }
  }

  function removeEntry(key: string) {
    const entry = entries.get(key);
    if (!entry) return;
    disconnectEntry(entry);
    entries.delete(key);
  }

  function applyVolume(track: BoostableAudioTrack, key: string, volumePercent: number) {
    if (volumePercent <= 100) {
      removeEntry(key);
      track.setVolume(deafened ? 0 : volumePercent / 100);
      return;
    }

    const mediaStream = track.mediaStream;
    if (!mediaStream) {
      // No stream to boost from. Never mute the track without an audible
      // fallback path — play at 100% through the regular element instead.
      logger.warn('[AudioBoost] Track has no mediaStream, falling back to 100% volume:', key);
      removeEntry(key);
      track.setVolume(deafened ? 0 : 1.0);
      return;
    }

    // Boost path: the GainNode carries the audio, so the track itself must be
    // silent to avoid double playback.
    track.setVolume(0);

    try {
      const context = getContext();
      let entry = entries.get(key);

      if (entry && entry.mediaStream !== mediaStream) {
        // Track was replaced (e.g. resubscribed after a mic toggle) — rewire.
        disconnectEntry(entry);
        entries.delete(key);
        entry = undefined;
      }

      if (!entry) {
        const sourceNode = context.createMediaStreamSource(mediaStream);
        const gainNode = context.createGain();
        sourceNode.connect(gainNode);
        gainNode.connect(context.destination);
        entry = { sourceNode, gainNode, mediaStream, volumePercent };
        entries.set(key, entry);
      }

      entry.volumePercent = volumePercent;
      entry.gainNode.gain.value = deafened ? 0 : volumePercent / 100;
    } catch (e) {
      // Web Audio wiring failed (context blocked/unsupported, stream without
      // audio tracks, ...). Never leave the track muted with no audible path —
      // fall back to 100% through the regular element.
      logger.warn('[AudioBoost] Boost wiring failed, falling back to 100% volume:', key, e);
      removeEntry(key);
      track.setVolume(deafened ? 0 : 1.0);
    }
  }

  function setDeafened(value: boolean) {
    deafened = value;
    entries.forEach((entry) => {
      entry.gainNode.gain.value = deafened ? 0 : entry.volumePercent / 100;
    });
  }

  function removeForParticipant(identity: string) {
    const prefix = `${identity}:`;
    for (const key of Array.from(entries.keys())) {
      if (key.startsWith(prefix)) {
        removeEntry(key);
      }
    }
  }

  function reset() {
    entries.forEach((entry) => disconnectEntry(entry));
    entries.clear();
    if (audioContext && audioContext.state !== 'closed') {
      audioContext.close().catch((e) => {
        logger.warn('[AudioBoost] Failed to close AudioContext:', e);
      });
    }
    audioContext = null;
  }

  function hasBoost(key: string): boolean {
    return entries.has(key);
  }

  return { applyVolume, setDeafened, removeEntry, removeForParticipant, reset, hasBoost };
}

/**
 * App-wide singleton. All boost wiring must go through this instance so the
 * audible path outlives any individual component (context menus, popovers).
 */
export const audioBoostManager = createAudioBoostManager();
