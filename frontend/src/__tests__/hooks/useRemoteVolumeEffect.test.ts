import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useRemoteVolumeEffect } from '../../hooks/useRemoteVolumeEffect';

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

let mockRoom: ReturnType<typeof buildMockRoom> | null = null;

vi.mock('livekit-client', () => ({
  RoomEvent: {
    TrackSubscribed: 'trackSubscribed',
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

  it('applies stored volume when a mic track is subscribed', () => {
    localStorageGetSpy.mockReturnValue('0.5');

    renderHook(() => useRemoteVolumeEffect());

    const setVolume = vi.fn();
    const track = { setVolume };
    const publication = { source: 'microphone', track };
    const participant = { identity: 'user-2' };

    // Simulate trackSubscribed event
    const handlers = roomEventHandlers.get('trackSubscribed');
    expect(handlers).toBeTruthy();
    handlers!.forEach((h) => h(track, publication, participant));

    expect(localStorageGetSpy).toHaveBeenCalledWith('voiceUserVolume:user-2');
    expect(setVolume).toHaveBeenCalledWith(0.5);
  });

  it('applies stored volume 0 (local mute) when track is subscribed', () => {
    localStorageGetSpy.mockReturnValue('0');

    renderHook(() => useRemoteVolumeEffect());

    const setVolume = vi.fn();
    const track = { setVolume };
    const publication = { source: 'microphone', track };
    const participant = { identity: 'user-2' };

    const handlers = roomEventHandlers.get('trackSubscribed');
    handlers!.forEach((h) => h(track, publication, participant));

    expect(setVolume).toHaveBeenCalledWith(0);
  });

  it('caps volume at 1.0 for track.setVolume when stored > 1', () => {
    localStorageGetSpy.mockReturnValue('1.5');

    renderHook(() => useRemoteVolumeEffect());

    const setVolume = vi.fn();
    const track = { setVolume };
    const publication = { source: 'microphone', track };
    const participant = { identity: 'user-2' };

    const handlers = roomEventHandlers.get('trackSubscribed');
    handlers!.forEach((h) => h(track, publication, participant));

    expect(setVolume).toHaveBeenCalledWith(1.0);
  });

  it('does not apply volume when no stored value exists', () => {
    localStorageGetSpy.mockReturnValue(null);

    renderHook(() => useRemoteVolumeEffect());

    const setVolume = vi.fn();
    const track = { setVolume };
    const publication = { source: 'microphone', track };
    const participant = { identity: 'user-2' };

    const handlers = roomEventHandlers.get('trackSubscribed');
    handlers!.forEach((h) => h(track, publication, participant));

    expect(setVolume).not.toHaveBeenCalled();
  });

  it('skips volume application when deafened', () => {
    localStorageGetSpy.mockReturnValue('0.5');
    mockIsDeafened = true;

    renderHook(() => useRemoteVolumeEffect());

    const setVolume = vi.fn();
    const track = { setVolume };
    const publication = { source: 'microphone', track };
    const participant = { identity: 'user-2' };

    const handlers = roomEventHandlers.get('trackSubscribed');
    handlers!.forEach((h) => h(track, publication, participant));

    expect(setVolume).not.toHaveBeenCalled();
  });

  it('ignores non-audio tracks (e.g., camera)', () => {
    localStorageGetSpy.mockReturnValue('0.5');

    renderHook(() => useRemoteVolumeEffect());

    const setVolume = vi.fn();
    const track = { setVolume };
    const publication = { source: 'camera', track };
    const participant = { identity: 'user-2' };

    const handlers = roomEventHandlers.get('trackSubscribed');
    handlers!.forEach((h) => h(track, publication, participant));

    expect(setVolume).not.toHaveBeenCalled();
  });

  it('handles screen share audio tracks', () => {
    localStorageGetSpy.mockReturnValue('0.3');

    renderHook(() => useRemoteVolumeEffect());

    const setVolume = vi.fn();
    const track = { setVolume };
    const publication = { source: 'screen_share_audio', track };
    const participant = { identity: 'user-2' };

    const handlers = roomEventHandlers.get('trackSubscribed');
    handlers!.forEach((h) => h(track, publication, participant));

    expect(setVolume).toHaveBeenCalledWith(0.3);
  });

  it('does nothing when no room is available', () => {
    mockRoom = null;
    // Should not throw
    renderHook(() => useRemoteVolumeEffect());
  });
});
