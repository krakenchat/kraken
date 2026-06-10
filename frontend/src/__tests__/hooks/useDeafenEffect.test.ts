import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useDeafenEffect } from '../../hooks/useDeafenEffect';
import { audioBoostManager } from '../../features/voice/audioBoostManager';

// --- Track factory ---
function createMockTrack(source: string) {
  return {
    source,
    track: {
      setVolume: vi.fn(),
    },
  };
}

// --- Mock room ---
type Handler = (...args: unknown[]) => void;
let roomEventHandlers: Map<string, Set<Handler>>;
let mockRemoteParticipants: Map<
  string,
  { identity: string; audioTrackPublications: Map<string, ReturnType<typeof createMockTrack>> }
>;

function buildMockRoom() {
  roomEventHandlers = new Map();
  mockRemoteParticipants = new Map();

  return {
    remoteParticipants: mockRemoteParticipants,
    on: vi.fn((event: string, handler: Handler) => {
      if (!roomEventHandlers.has(event)) roomEventHandlers.set(event, new Set());
      roomEventHandlers.get(event)!.add(handler);
    }),
    off: vi.fn((event: string, handler: Handler) => {
      roomEventHandlers.get(event)?.delete(handler);
    }),
  };
}

function addParticipant(identity: string, tracks: ReturnType<typeof createMockTrack>[]) {
  const audioMap = new Map(tracks.map((t, i) => [`audio-${i}`, t]));
  mockRemoteParticipants.set(identity, { identity, audioTrackPublications: audioMap });
}

let mockRoom: ReturnType<typeof buildMockRoom> | null = null;
let mockIsDeafened = false;

// --- Mock dependencies ---
vi.mock('livekit-client', () => ({
  Track: {
    Source: {
      Microphone: 'microphone',
      ScreenShareAudio: 'screen_share_audio',
    },
  },
}));

vi.mock('../../hooks/useRoom', () => ({
  useRoom: vi.fn(() => ({ room: mockRoom })),
}));

vi.mock('../../contexts/VoiceContext', () => ({
  useVoice: vi.fn(() => ({ isDeafened: mockIsDeafened })),
}));

vi.mock('../../features/voice/audioBoostManager', () => ({
  boostKey: (identity: string, source: string) => `${identity}:${source}`,
  audioBoostManager: {
    applyVolume: vi.fn(),
    setDeafened: vi.fn(),
    removeEntry: vi.fn(),
    removeForParticipant: vi.fn(),
    reset: vi.fn(),
    hasBoost: vi.fn(() => false),
  },
}));

describe('useDeafenEffect', () => {
  let localStorageGetSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockRoom = buildMockRoom();
    mockIsDeafened = false;
    localStorageGetSpy = vi.spyOn(Storage.prototype, 'getItem').mockReturnValue(null);
  });

  afterEach(() => {
    localStorageGetSpy.mockRestore();
  });

  it('mutes microphone tracks when deafened', () => {
    const micTrack = createMockTrack('microphone');
    addParticipant('user-1', [micTrack]);
    mockIsDeafened = true;

    renderHook(() => useDeafenEffect());

    expect(micTrack.track.setVolume).toHaveBeenCalledWith(0);
  });

  it('mutes screen share audio tracks when deafened', () => {
    const screenAudioTrack = createMockTrack('screen_share_audio');
    addParticipant('user-1', [screenAudioTrack]);
    mockIsDeafened = true;

    renderHook(() => useDeafenEffect());

    expect(screenAudioTrack.track.setVolume).toHaveBeenCalledWith(0);
  });

  it('silences GainNode boost paths when deafened', () => {
    addParticipant('user-1', [createMockTrack('microphone')]);
    mockIsDeafened = true;

    renderHook(() => useDeafenEffect());

    expect(audioBoostManager.setDeafened).toHaveBeenCalledWith(true);
  });

  it('mutes both microphone and screen share audio when deafened', () => {
    const micTrack = createMockTrack('microphone');
    const screenAudioTrack = createMockTrack('screen_share_audio');
    addParticipant('user-1', [micTrack, screenAudioTrack]);
    mockIsDeafened = true;

    renderHook(() => useDeafenEffect());

    expect(micTrack.track.setVolume).toHaveBeenCalledWith(0);
    expect(screenAudioTrack.track.setVolume).toHaveBeenCalledWith(0);
  });

  it('restores volumes through the boost manager when undeafened', () => {
    const micTrack = createMockTrack('microphone');
    const screenAudioTrack = createMockTrack('screen_share_audio');
    addParticipant('user-1', [micTrack, screenAudioTrack]);
    mockIsDeafened = false;

    renderHook(() => useDeafenEffect());

    expect(audioBoostManager.setDeafened).toHaveBeenCalledWith(false);
    expect(audioBoostManager.applyVolume).toHaveBeenCalledWith(
      micTrack.track,
      'user-1:microphone',
      100,
    );
    expect(audioBoostManager.applyVolume).toHaveBeenCalledWith(
      screenAudioTrack.track,
      'user-1:screen_share_audio',
      100,
    );
  });

  it('restores a boosted (>100%) stored volume in full when undeafened', () => {
    localStorageGetSpy.mockImplementation((key: string) => {
      if (key === 'voiceUserVolume:user-1') return '1.5';
      return null;
    });
    const micTrack = createMockTrack('microphone');
    addParticipant('user-1', [micTrack]);
    mockIsDeafened = false;

    renderHook(() => useDeafenEffect());

    expect(audioBoostManager.applyVolume).toHaveBeenCalledWith(
      micTrack.track,
      'user-1:microphone',
      150,
    );
  });

  it('restores screenshare volume from the screenshare storage prefix', () => {
    localStorageGetSpy.mockImplementation((key: string) => {
      if (key === 'voiceScreenShareVolume:user-1') return '0.4';
      return null;
    });
    const screenAudioTrack = createMockTrack('screen_share_audio');
    addParticipant('user-1', [screenAudioTrack]);
    mockIsDeafened = false;

    renderHook(() => useDeafenEffect());

    expect(audioBoostManager.applyVolume).toHaveBeenCalledWith(
      screenAudioTrack.track,
      'user-1:screen_share_audio',
      40,
    );
  });

  it('does not affect tracks with other sources like camera', () => {
    const cameraTrack = createMockTrack('camera');
    addParticipant('user-1', [cameraTrack]);
    mockIsDeafened = true;

    renderHook(() => useDeafenEffect());

    expect(cameraTrack.track.setVolume).not.toHaveBeenCalled();
  });

  it('does nothing when no room is available', () => {
    mockRoom = null;

    // Should not throw
    renderHook(() => useDeafenEffect());
  });
});
