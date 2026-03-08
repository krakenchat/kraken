import { useCallback, useEffect, useRef } from 'react';

interface GainNodeEntry {
  gainNode: GainNode;
  source: MediaStreamAudioSourceNode;
  context: AudioContext;
}

interface AudioTrackLike {
  setVolume(v: number): void;
  mediaStream?: MediaStream | null;
}

/**
 * Hook that manages Web Audio GainNodes for volume amplification above 100%.
 *
 * For 0-100%: uses track.setVolume directly.
 * For 101-200%: mutes the track and routes through a GainNode for amplification.
 *
 * Also provides muteAllGainNodes() to silence GainNode output during deafen,
 * since track.setVolume(0) alone won't silence the GainNode audio path.
 */
export function useAudioBoost() {
  const gainNodesRef = useRef<Map<string, GainNodeEntry>>(new Map());

  // Cleanup on unmount
  useEffect(() => {
    const nodes = gainNodesRef.current;
    return () => {
      nodes.forEach(({ context }) => context.close());
      nodes.clear();
    };
  }, []);

  /**
   * Apply volume to a single audio track with GainNode boost support.
   * @param track - The LiveKit audio track
   * @param key - Unique key for this track's GainNode (e.g. "userId:source")
   * @param vol - Volume 0-200 (percent)
   */
  const applyVolume = useCallback((track: AudioTrackLike, key: string, vol: number) => {
    if (vol <= 100) {
      // Standard range: clean up any existing GainNode, use track.setVolume
      const existing = gainNodesRef.current.get(key);
      if (existing) {
        existing.source.disconnect();
        existing.context.close();
        gainNodesRef.current.delete(key);
      }
      track.setVolume(vol / 100);
    } else {
      // Boost range: mute LiveKit track to prevent double audio,
      // route through GainNode for amplification
      track.setVolume(0);

      const mediaStream = track.mediaStream;
      if (mediaStream) {
        let entry = gainNodesRef.current.get(key);

        if (!entry) {
          const context = new AudioContext();
          const source = context.createMediaStreamSource(mediaStream);
          const gainNode = context.createGain();
          source.connect(gainNode);
          gainNode.connect(context.destination);
          entry = { gainNode, source, context };
          gainNodesRef.current.set(key, entry);
        }

        entry.gainNode.gain.value = vol / 100; // 1.0 - 2.0
      }
    }
  }, []);

  /**
   * Silence all active GainNodes (for deafen). Does NOT destroy them
   * so they can be restored later.
   */
  const muteAllGainNodes = useCallback(() => {
    gainNodesRef.current.forEach((entry) => {
      entry.gainNode.gain.value = 0;
    });
  }, []);

  return { applyVolume, muteAllGainNodes, gainNodesRef };
}
