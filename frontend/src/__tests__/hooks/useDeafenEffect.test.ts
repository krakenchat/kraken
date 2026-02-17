import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useDeafenEffect } from '../../hooks/useDeafenEffect';

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
let mockRemoteParticipants: Map<string, { audioTrackPublications: Map<string, ReturnType<typeof createMockTrack>> }>;

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

describe('useDeafenEffect', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRoom = buildMockRoom();
    mockIsDeafened = false;
  });

  it('mutes microphone tracks when deafened', () => {
    const micTrack = createMockTrack('microphone');
    const audioMap = new Map([['audio-0', micTrack]]);
    mockRemoteParticipants.set('user-1', { audioTrackPublications: audioMap });
    mockIsDeafened = true;

    renderHook(() => useDeafenEffect());

    expect(micTrack.track.setVolume).toHaveBeenCalledWith(0);
  });

  it('mutes screen share audio tracks when deafened', () => {
    const screenAudioTrack = createMockTrack('screen_share_audio');
    const audioMap = new Map([['audio-0', screenAudioTrack]]);
    mockRemoteParticipants.set('user-1', { audioTrackPublications: audioMap });
    mockIsDeafened = true;

    renderHook(() => useDeafenEffect());

    expect(screenAudioTrack.track.setVolume).toHaveBeenCalledWith(0);
  });

  it('mutes both microphone and screen share audio when deafened', () => {
    const micTrack = createMockTrack('microphone');
    const screenAudioTrack = createMockTrack('screen_share_audio');
    const audioMap = new Map([
      ['audio-0', micTrack],
      ['audio-1', screenAudioTrack],
    ]);
    mockRemoteParticipants.set('user-1', { audioTrackPublications: audioMap });
    mockIsDeafened = true;

    renderHook(() => useDeafenEffect());

    expect(micTrack.track.setVolume).toHaveBeenCalledWith(0);
    expect(screenAudioTrack.track.setVolume).toHaveBeenCalledWith(0);
  });

  it('restores volume when undeafened', () => {
    const micTrack = createMockTrack('microphone');
    const screenAudioTrack = createMockTrack('screen_share_audio');
    const audioMap = new Map([
      ['audio-0', micTrack],
      ['audio-1', screenAudioTrack],
    ]);
    mockRemoteParticipants.set('user-1', { audioTrackPublications: audioMap });
    mockIsDeafened = false;

    renderHook(() => useDeafenEffect());

    expect(micTrack.track.setVolume).toHaveBeenCalledWith(1.0);
    expect(screenAudioTrack.track.setVolume).toHaveBeenCalledWith(1.0);
  });

  it('does not affect tracks with other sources like camera', () => {
    const cameraTrack = createMockTrack('camera');
    const audioMap = new Map([['audio-0', cameraTrack]]);
    mockRemoteParticipants.set('user-1', { audioTrackPublications: audioMap });
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
