import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  createAudioBoostManager,
  boostKey,
  type AudioBoostManager,
  type BoostableAudioTrack,
} from '../../features/voice/audioBoostManager';

// --- Web Audio mocks (jsdom has no AudioContext) ---

interface MockGainNode {
  connect: ReturnType<typeof vi.fn>;
  disconnect: ReturnType<typeof vi.fn>;
  gain: { value: number };
}

interface MockSourceNode {
  connect: ReturnType<typeof vi.fn>;
  disconnect: ReturnType<typeof vi.fn>;
}

class MockAudioContext {
  static instances: MockAudioContext[] = [];
  state = 'running';
  destination = { kind: 'destination' };
  sources: MockSourceNode[] = [];
  gains: MockGainNode[] = [];
  resume = vi.fn(() => {
    this.state = 'running';
    return Promise.resolve();
  });
  close = vi.fn(() => {
    this.state = 'closed';
    return Promise.resolve();
  });
  createMediaStreamSource = vi.fn(() => {
    const node: MockSourceNode = { connect: vi.fn(), disconnect: vi.fn() };
    this.sources.push(node);
    return node;
  });
  createGain = vi.fn(() => {
    const node: MockGainNode = { connect: vi.fn(), disconnect: vi.fn(), gain: { value: 1 } };
    this.gains.push(node);
    return node;
  });

  constructor() {
    MockAudioContext.instances.push(this);
  }
}

function createMockTrack(mediaStream: object | null = {}) {
  return {
    setVolume: vi.fn(),
    mediaStream,
  } as unknown as BoostableAudioTrack & { setVolume: ReturnType<typeof vi.fn> };
}

describe('audioBoostManager', () => {
  let manager: AudioBoostManager;

  beforeEach(() => {
    MockAudioContext.instances = [];
    vi.stubGlobal('AudioContext', MockAudioContext);
    manager = createAudioBoostManager();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('boostKey', () => {
    it('builds a stable identity:source key', () => {
      expect(boostKey('user-2', 'microphone')).toBe('user-2:microphone');
    });
  });

  describe('volumes at or below 100%', () => {
    it('sets track volume directly and creates no AudioContext', () => {
      const track = createMockTrack();

      manager.applyVolume(track, boostKey('user-2', 'microphone'), 80);

      expect(track.setVolume).toHaveBeenCalledWith(0.8);
      expect(MockAudioContext.instances).toHaveLength(0);
      expect(manager.hasBoost(boostKey('user-2', 'microphone'))).toBe(false);
    });

    it('supports volume 0 (mute for me)', () => {
      const track = createMockTrack();

      manager.applyVolume(track, boostKey('user-2', 'microphone'), 0);

      expect(track.setVolume).toHaveBeenCalledWith(0);
    });
  });

  describe('boost above 100%', () => {
    it('mutes the track and routes through a GainNode at the boosted gain', () => {
      const stream = {};
      const track = createMockTrack(stream);

      manager.applyVolume(track, boostKey('user-2', 'microphone'), 150);

      expect(track.setVolume).toHaveBeenCalledWith(0);
      expect(MockAudioContext.instances).toHaveLength(1);
      const ctx = MockAudioContext.instances[0];
      expect(ctx.createMediaStreamSource).toHaveBeenCalledWith(stream);
      expect(ctx.sources[0].connect).toHaveBeenCalledWith(ctx.gains[0]);
      expect(ctx.gains[0].connect).toHaveBeenCalledWith(ctx.destination);
      expect(ctx.gains[0].gain.value).toBe(1.5);
      expect(manager.hasBoost(boostKey('user-2', 'microphone'))).toBe(true);
    });

    it('reuses the wiring when boost level changes for the same track', () => {
      const track = createMockTrack();
      const key = boostKey('user-2', 'microphone');

      manager.applyVolume(track, key, 150);
      manager.applyVolume(track, key, 180);

      const ctx = MockAudioContext.instances[0];
      expect(ctx.createMediaStreamSource).toHaveBeenCalledTimes(1);
      expect(ctx.gains[0].gain.value).toBe(1.8);
    });

    it('shares a single AudioContext across boosted participants', () => {
      manager.applyVolume(createMockTrack(), boostKey('user-2', 'microphone'), 150);
      manager.applyVolume(createMockTrack(), boostKey('user-3', 'microphone'), 120);

      expect(MockAudioContext.instances).toHaveLength(1);
    });

    it('resumes a suspended AudioContext', () => {
      const track = createMockTrack();
      const key = boostKey('user-2', 'microphone');

      manager.applyVolume(track, key, 150);
      const ctx = MockAudioContext.instances[0];
      ctx.state = 'suspended';

      manager.applyVolume(track, key, 160);

      expect(ctx.resume).toHaveBeenCalled();
    });

    it('rewires to the new mediaStream when the track is replaced (resubscribe)', () => {
      const key = boostKey('user-2', 'microphone');
      const oldTrack = createMockTrack({ id: 'old' });
      const newTrack = createMockTrack({ id: 'new' });

      manager.applyVolume(oldTrack, key, 150);
      manager.applyVolume(newTrack, key, 150);

      const ctx = MockAudioContext.instances[0];
      expect(ctx.sources[0].disconnect).toHaveBeenCalled();
      expect(ctx.createMediaStreamSource).toHaveBeenCalledTimes(2);
      expect(ctx.createMediaStreamSource).toHaveBeenLastCalledWith(newTrack.mediaStream);
      expect(newTrack.setVolume).toHaveBeenCalledWith(0);
      expect(ctx.gains[ctx.gains.length - 1].gain.value).toBe(1.5);
    });

    it('falls back to full track volume when the track has no mediaStream (never silences)', () => {
      const track = createMockTrack(null);
      const key = boostKey('user-2', 'microphone');

      manager.applyVolume(track, key, 150);

      // Must NOT leave the track muted with no audible path
      expect(track.setVolume).toHaveBeenLastCalledWith(1.0);
      expect(manager.hasBoost(key)).toBe(false);
    });

    it('falls back to audible volume when source wiring throws (never silences)', () => {
      vi.stubGlobal(
        'AudioContext',
        class extends MockAudioContext {
          createMediaStreamSource = vi.fn(() => {
            throw new DOMException('no audio tracks', 'InvalidStateError');
          });
        },
      );
      const track = createMockTrack();
      const key = boostKey('user-2', 'microphone');

      expect(() => manager.applyVolume(track, key, 150)).not.toThrow();

      expect(track.setVolume).toHaveBeenLastCalledWith(1.0);
      expect(manager.hasBoost(key)).toBe(false);
    });

    it('falls back to audible volume when AudioContext creation throws (never silences)', () => {
      vi.stubGlobal(
        'AudioContext',
        class {
          constructor() {
            throw new DOMException('Web Audio blocked', 'NotSupportedError');
          }
        },
      );
      const track = createMockTrack();
      const key = boostKey('user-2', 'microphone');

      expect(() => manager.applyVolume(track, key, 150)).not.toThrow();

      expect(track.setVolume).toHaveBeenLastCalledWith(1.0);
      expect(manager.hasBoost(key)).toBe(false);
    });

    it('keeps the track muted when wiring throws while deafened', () => {
      vi.stubGlobal(
        'AudioContext',
        class extends MockAudioContext {
          createMediaStreamSource = vi.fn(() => {
            throw new DOMException('no audio tracks', 'InvalidStateError');
          });
        },
      );
      manager.setDeafened(true);
      const track = createMockTrack();

      manager.applyVolume(track, boostKey('user-2', 'microphone'), 150);

      expect(track.setVolume).toHaveBeenLastCalledWith(0);
    });

    it('restores direct track volume when dropping back to 100% or below', () => {
      const track = createMockTrack();
      const key = boostKey('user-2', 'microphone');

      manager.applyVolume(track, key, 150);
      const ctx = MockAudioContext.instances[0];

      manager.applyVolume(track, key, 70);

      expect(ctx.sources[0].disconnect).toHaveBeenCalled();
      expect(track.setVolume).toHaveBeenLastCalledWith(0.7);
      expect(manager.hasBoost(key)).toBe(false);
    });
  });

  describe('deafen integration', () => {
    it('silences all gain nodes when deafened and restores them on undeafen', () => {
      const track = createMockTrack();
      const key = boostKey('user-2', 'microphone');
      manager.applyVolume(track, key, 150);
      const gain = MockAudioContext.instances[0].gains[0];

      manager.setDeafened(true);
      expect(gain.gain.value).toBe(0);

      manager.setDeafened(false);
      expect(gain.gain.value).toBe(1.5);
    });

    it('keeps boost gain silent when applying volume while deafened', () => {
      manager.setDeafened(true);
      const track = createMockTrack();
      const key = boostKey('user-2', 'microphone');

      manager.applyVolume(track, key, 150);

      const gain = MockAudioContext.instances[0].gains[0];
      expect(gain.gain.value).toBe(0);
      expect(track.setVolume).toHaveBeenCalledWith(0);

      manager.setDeafened(false);
      expect(gain.gain.value).toBe(1.5);
    });

    it('keeps the track muted when applying non-boost volume while deafened', () => {
      manager.setDeafened(true);
      const track = createMockTrack();

      manager.applyVolume(track, boostKey('user-2', 'microphone'), 80);

      expect(track.setVolume).toHaveBeenLastCalledWith(0);
    });
  });

  describe('cleanup', () => {
    it('removes a single entry and disconnects its nodes', () => {
      const track = createMockTrack();
      const key = boostKey('user-2', 'microphone');
      manager.applyVolume(track, key, 150);
      const ctx = MockAudioContext.instances[0];

      manager.removeEntry(key);

      expect(ctx.sources[0].disconnect).toHaveBeenCalled();
      expect(ctx.gains[0].disconnect).toHaveBeenCalled();
      expect(manager.hasBoost(key)).toBe(false);
    });

    it('removes only the given participant entries', () => {
      manager.applyVolume(createMockTrack(), boostKey('user-2', 'microphone'), 150);
      manager.applyVolume(createMockTrack(), boostKey('user-2', 'screen_share_audio'), 130);
      manager.applyVolume(createMockTrack(), boostKey('user-3', 'microphone'), 120);

      manager.removeForParticipant('user-2');

      expect(manager.hasBoost(boostKey('user-2', 'microphone'))).toBe(false);
      expect(manager.hasBoost(boostKey('user-2', 'screen_share_audio'))).toBe(false);
      expect(manager.hasBoost(boostKey('user-3', 'microphone'))).toBe(true);
    });

    it('does not remove entries for identities that prefix-match another identity', () => {
      manager.applyVolume(createMockTrack(), boostKey('user-22', 'microphone'), 150);

      manager.removeForParticipant('user-2');

      expect(manager.hasBoost(boostKey('user-22', 'microphone'))).toBe(true);
    });

    it('reset clears all entries and closes the shared AudioContext', () => {
      manager.applyVolume(createMockTrack(), boostKey('user-2', 'microphone'), 150);
      manager.applyVolume(createMockTrack(), boostKey('user-3', 'microphone'), 120);
      const ctx = MockAudioContext.instances[0];

      manager.reset();

      expect(ctx.close).toHaveBeenCalled();
      expect(manager.hasBoost(boostKey('user-2', 'microphone'))).toBe(false);
      expect(manager.hasBoost(boostKey('user-3', 'microphone'))).toBe(false);

      // A new boost after reset gets a fresh context
      manager.applyVolume(createMockTrack(), boostKey('user-4', 'microphone'), 150);
      expect(MockAudioContext.instances).toHaveLength(2);
    });
  });
});
