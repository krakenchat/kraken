import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useRemoteVolumeEffect } from '../../hooks/useRemoteVolumeEffect';
import { audioBoostManager } from '../../features/voice/audioBoostManager';

type Handler = (...args: unknown[]) => void;
let roomEventHandlers: Map<string, Set<Handler>>;
let mockIsDeafened = false;

function buildMockRoom() {
  roomEventHandlers = new Map();
  return {
    on: vi.fn((event: string, handler: Handler) => {
      if (!roomEventHandlers.has(event)) roomEventHandlers.set(event, new Set());
      roomEventHandlers.get(event)!.add(handler);
    }),
    off: vi.fn((event: string, handler: Handler) => {
      roomEventHandlers.get(event)?.delete(handler);
    }),
  };
}

function emit(event: string, ...args: unknown[]) {
  roomEventHandlers.get(event)?.forEach((h) => h(...args));
}

let mockRoom: ReturnType<typeof buildMockRoom> | null = null;

vi.mock('livekit-client', () => ({
  RoomEvent: {
    TrackSubscribed: 'trackSubscribed',
    TrackUnsubscribed: 'trackUnsubscribed',
    ParticipantDisconnected: 'participantDisconnected',
    Disconnected: 'disconnected',
  },
  Track: {
    Source: {
      Microphone: 'microphone',
      ScreenShareAudio: 'screen_share_audio',
      Camera: 'camera',
    },
  },
}));

vi.mock('../../hooks/useRoom', () => ({
  useRoom: vi.fn(() => ({ room: mockRoom })),
}));

vi.mock('../../contexts/VoiceContext', () => ({
  useVoice: vi.fn(() => ({ isDeafened: mockIsDeafened })),
}));

vi.mock('../../utils/logger', () => ({
  logger: { dev: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
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

describe('useRemoteVolumeEffect', () => {
  let localStorageGetSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockRoom = buildMockRoom();
    mockIsDeafened = false;
    localStorageGetSpy = vi.spyOn(Storage.prototype, 'getItem');
  });

  afterEach(() => {
    localStorageGetSpy.mockRestore();
  });

  it('applies stored volume through the boost manager when a mic track is subscribed', () => {
    localStorageGetSpy.mockReturnValue('0.5');

    renderHook(() => useRemoteVolumeEffect());

    const track = { setVolume: vi.fn() };
    const publication = { source: 'microphone', track };
    const participant = { identity: 'user-2' };

    emit('trackSubscribed', track, publication, participant);

    expect(localStorageGetSpy).toHaveBeenCalledWith('voiceUserVolume:user-2');
    expect(audioBoostManager.applyVolume).toHaveBeenCalledWith(track, 'user-2:microphone', 50);
  });

  it('applies stored volume 0 (local mute) when track is subscribed', () => {
    localStorageGetSpy.mockReturnValue('0');

    renderHook(() => useRemoteVolumeEffect());

    const track = { setVolume: vi.fn() };
    const publication = { source: 'microphone', track };
    const participant = { identity: 'user-2' };

    emit('trackSubscribed', track, publication, participant);

    expect(audioBoostManager.applyVolume).toHaveBeenCalledWith(track, 'user-2:microphone', 0);
  });

  it('re-establishes boost (>100%) after a track resubscribes', () => {
    localStorageGetSpy.mockReturnValue('1.5');

    renderHook(() => useRemoteVolumeEffect());

    const track = { setVolume: vi.fn() };
    const publication = { source: 'microphone', track };
    const participant = { identity: 'user-2' };

    emit('trackSubscribed', track, publication, participant);

    expect(audioBoostManager.applyVolume).toHaveBeenCalledWith(track, 'user-2:microphone', 150);
  });

  it('applies the 100% default when no stored value exists (clears stale boost wiring)', () => {
    localStorageGetSpy.mockReturnValue(null);

    renderHook(() => useRemoteVolumeEffect());

    const track = { setVolume: vi.fn() };
    const publication = { source: 'microphone', track };
    const participant = { identity: 'user-2' };

    emit('trackSubscribed', track, publication, participant);

    expect(audioBoostManager.applyVolume).toHaveBeenCalledWith(track, 'user-2:microphone', 100);
  });

  it('skips volume application when deafened', () => {
    localStorageGetSpy.mockReturnValue('0.5');
    mockIsDeafened = true;

    renderHook(() => useRemoteVolumeEffect());

    const track = { setVolume: vi.fn() };
    const publication = { source: 'microphone', track };
    const participant = { identity: 'user-2' };

    emit('trackSubscribed', track, publication, participant);

    expect(audioBoostManager.applyVolume).not.toHaveBeenCalled();
  });

  it('ignores non-audio tracks (e.g., camera)', () => {
    localStorageGetSpy.mockReturnValue('0.5');

    renderHook(() => useRemoteVolumeEffect());

    const track = { setVolume: vi.fn() };
    const publication = { source: 'camera', track };
    const participant = { identity: 'user-2' };

    emit('trackSubscribed', track, publication, participant);

    expect(audioBoostManager.applyVolume).not.toHaveBeenCalled();
  });

  it('handles screen share audio tracks using screenshare volume prefix', () => {
    localStorageGetSpy.mockImplementation((key: string) => {
      if (key === 'voiceScreenShareVolume:user-2') return '0.3';
      return null;
    });

    renderHook(() => useRemoteVolumeEffect());

    const track = { setVolume: vi.fn() };
    const publication = { source: 'screen_share_audio', track };
    const participant = { identity: 'user-2' };

    emit('trackSubscribed', track, publication, participant);

    expect(localStorageGetSpy).toHaveBeenCalledWith('voiceScreenShareVolume:user-2');
    expect(audioBoostManager.applyVolume).toHaveBeenCalledWith(
      track,
      'user-2:screen_share_audio',
      30,
    );
  });

  it('uses mic volume prefix for microphone tracks, not screenshare prefix', () => {
    localStorageGetSpy.mockImplementation((key: string) => {
      if (key === 'voiceUserVolume:user-2') return '0.7';
      if (key === 'voiceScreenShareVolume:user-2') return '0.2';
      return null;
    });

    renderHook(() => useRemoteVolumeEffect());

    const track = { setVolume: vi.fn() };
    const publication = { source: 'microphone', track };
    const participant = { identity: 'user-2' };

    emit('trackSubscribed', track, publication, participant);

    expect(localStorageGetSpy).toHaveBeenCalledWith('voiceUserVolume:user-2');
    expect(audioBoostManager.applyVolume).toHaveBeenCalledWith(track, 'user-2:microphone', 70);
  });

  it('tears down boost wiring when an audio track unsubscribes', () => {
    renderHook(() => useRemoteVolumeEffect());

    const publication = { source: 'microphone', track: undefined };
    const participant = { identity: 'user-2' };

    emit('trackUnsubscribed', {}, publication, participant);

    expect(audioBoostManager.removeEntry).toHaveBeenCalledWith('user-2:microphone');
  });

  it('does not tear down boost wiring for non-audio unsubscribes', () => {
    renderHook(() => useRemoteVolumeEffect());

    const publication = { source: 'camera', track: undefined };
    const participant = { identity: 'user-2' };

    emit('trackUnsubscribed', {}, publication, participant);

    expect(audioBoostManager.removeEntry).not.toHaveBeenCalled();
  });

  it('tears down all boost wiring for a participant when they disconnect', () => {
    renderHook(() => useRemoteVolumeEffect());

    emit('participantDisconnected', { identity: 'user-2' });

    expect(audioBoostManager.removeForParticipant).toHaveBeenCalledWith('user-2');
  });

  it('resets the boost manager when the room disconnects', () => {
    renderHook(() => useRemoteVolumeEffect());

    emit('disconnected');

    expect(audioBoostManager.reset).toHaveBeenCalled();
  });

  it('does nothing when no room is available', () => {
    mockRoom = null;
    // Should not throw
    renderHook(() => useRemoteVolumeEffect());
  });
});
