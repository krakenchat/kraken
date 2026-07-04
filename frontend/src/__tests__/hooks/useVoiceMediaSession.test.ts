import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useVoiceMediaSession } from '../../hooks/useVoiceMediaSession';
import { isElectron } from '../../utils/platform';

vi.mock('../../utils/platform', () => ({
  isElectron: vi.fn(() => false),
}));

vi.mock('../../utils/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

class MockMediaMetadata {
  title: string;
  artist: string;
  constructor(init: { title: string; artist: string }) {
    this.title = init.title;
    this.artist = init.artist;
  }
}

interface MockMediaSession {
  metadata: MockMediaMetadata | null;
  playbackState: string;
  setActionHandler: ReturnType<typeof vi.fn>;
  setMicrophoneActive: ReturnType<typeof vi.fn>;
}

function createMockMediaSession(): MockMediaSession {
  return {
    metadata: null,
    playbackState: 'none',
    setActionHandler: vi.fn(),
    setMicrophoneActive: vi.fn(),
  };
}

const defaultOptions = {
  isConnected: true,
  contextName: 'General Voice',
  isMicrophoneEnabled: true,
  onHangup: vi.fn(),
  onToggleMic: vi.fn(),
};

describe('useVoiceMediaSession', () => {
  let mockSession: MockMediaSession;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(isElectron).mockReturnValue(false);
    mockSession = createMockMediaSession();
    Object.defineProperty(navigator, 'mediaSession', {
      value: mockSession,
      configurable: true,
      writable: true,
    });
    vi.stubGlobal('MediaMetadata', MockMediaMetadata);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    // Remove the mediaSession we defined so tests stay isolated
    delete (navigator as { mediaSession?: unknown }).mediaSession;
  });

  it('sets metadata, playback state, and action handlers while connected', () => {
    renderHook(() => useVoiceMediaSession(defaultOptions));

    expect(mockSession.metadata).toMatchObject({
      title: 'General Voice',
      artist: 'Semaphore Chat',
    });
    expect(mockSession.playbackState).toBe('playing');
    expect(mockSession.setActionHandler).toHaveBeenCalledWith('hangup', expect.any(Function));
    expect(mockSession.setActionHandler).toHaveBeenCalledWith('togglemicrophone', expect.any(Function));
    expect(mockSession.setMicrophoneActive).toHaveBeenCalledWith(true);
  });

  it('falls back to a generic title when no context name is available', () => {
    renderHook(() => useVoiceMediaSession({ ...defaultOptions, contextName: null }));
    expect(mockSession.metadata).toMatchObject({ title: 'Voice call' });
  });

  it('invokes hangup and mic callbacks from the registered handlers', () => {
    const onHangup = vi.fn();
    const onToggleMic = vi.fn();
    renderHook(() => useVoiceMediaSession({ ...defaultOptions, onHangup, onToggleMic }));

    const calls = mockSession.setActionHandler.mock.calls as [string, (() => void) | null][];
    const hangupHandler = calls.find(([action, h]) => action === 'hangup' && h)?.[1];
    const micHandler = calls.find(([action, h]) => action === 'togglemicrophone' && h)?.[1];

    hangupHandler?.();
    micHandler?.();
    expect(onHangup).toHaveBeenCalledTimes(1);
    expect(onToggleMic).toHaveBeenCalledTimes(1);
  });

  it('mirrors mic mute state via setMicrophoneActive', () => {
    const { rerender } = renderHook(
      (props: { isMicrophoneEnabled: boolean }) =>
        useVoiceMediaSession({ ...defaultOptions, isMicrophoneEnabled: props.isMicrophoneEnabled }),
      { initialProps: { isMicrophoneEnabled: true } }
    );
    expect(mockSession.setMicrophoneActive).toHaveBeenLastCalledWith(true);

    rerender({ isMicrophoneEnabled: false });
    expect(mockSession.setMicrophoneActive).toHaveBeenLastCalledWith(false);
  });

  it('clears session state on disconnect', () => {
    const { rerender } = renderHook(
      (props: { isConnected: boolean }) =>
        useVoiceMediaSession({ ...defaultOptions, isConnected: props.isConnected }),
      { initialProps: { isConnected: true } }
    );

    rerender({ isConnected: false });

    expect(mockSession.metadata).toBeNull();
    expect(mockSession.playbackState).toBe('none');
    expect(mockSession.setActionHandler).toHaveBeenCalledWith('hangup', null);
    expect(mockSession.setActionHandler).toHaveBeenCalledWith('togglemicrophone', null);
  });

  it('swallows setActionHandler TypeError for unsupported actions', () => {
    mockSession.setActionHandler.mockImplementation((action: string) => {
      if (action === 'togglemicrophone') {
        throw new TypeError('unsupported action');
      }
    });

    expect(() => renderHook(() => useVoiceMediaSession(defaultOptions))).not.toThrow();
    // hangup still registered despite togglemicrophone throwing
    expect(mockSession.setActionHandler).toHaveBeenCalledWith('hangup', expect.any(Function));
  });

  it('does nothing when not connected', () => {
    renderHook(() => useVoiceMediaSession({ ...defaultOptions, isConnected: false }));
    expect(mockSession.setActionHandler).not.toHaveBeenCalled();
    expect(mockSession.metadata).toBeNull();
  });

  it('does nothing in Electron', () => {
    vi.mocked(isElectron).mockReturnValue(true);
    renderHook(() => useVoiceMediaSession(defaultOptions));
    expect(mockSession.setActionHandler).not.toHaveBeenCalled();
  });

  it('does nothing when the Media Session API is absent', () => {
    delete (navigator as { mediaSession?: unknown }).mediaSession;
    expect(() => renderHook(() => useVoiceMediaSession(defaultOptions))).not.toThrow();
  });

  it('tolerates a mediaSession without setMicrophoneActive', () => {
    delete (mockSession as { setMicrophoneActive?: unknown }).setMicrophoneActive;
    expect(() => renderHook(() => useVoiceMediaSession(defaultOptions))).not.toThrow();
    expect(mockSession.playbackState).toBe('playing');
  });
});
