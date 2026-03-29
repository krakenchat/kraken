import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { createTestWrapper, createTestQueryClient } from '../test-utils';

vi.mock('../../api-client/client.gen', async (importOriginal) => {
  const { createClient, createConfig } = await import('../../api-client/client');
  return {
    ...(await importOriginal<Record<string, unknown>>()),
    client: createClient(createConfig({ baseUrl: 'http://localhost:3000' })),
  };
});

// Create mock participants with event emitter behavior
type Handler = (...args: unknown[]) => void;

function createMockParticipant(identity: string) {
  const handlers = new Map<string, Set<Handler>>();
  return {
    identity,
    isSpeaking: false,
    metadata: null as string | null,
    getTrackPublication: vi.fn().mockReturnValue(null),
    on: vi.fn((event: string, handler: Handler) => {
      if (!handlers.has(event)) handlers.set(event, new Set());
      handlers.get(event)!.add(handler);
    }),
    off: vi.fn((event: string, handler: Handler) => {
      handlers.get(event)?.delete(handler);
    }),
    _emit(event: string, ...args: unknown[]) {
      handlers.get(event)?.forEach(h => h(...args));
    },
  };
}

const mockLocalParticipant = createMockParticipant('local-user');
const mockRemoteParticipant = createMockParticipant('remote-user');

const roomHandlers = new Map<string, Set<Handler>>();
const mockRoom = {
  localParticipant: mockLocalParticipant,
  remoteParticipants: new Map([['remote-user', mockRemoteParticipant]]),
  on: vi.fn((event: string, handler: Handler) => {
    if (!roomHandlers.has(event)) roomHandlers.set(event, new Set());
    roomHandlers.get(event)!.add(handler);
    return mockRoom;
  }),
  off: vi.fn((event: string, handler: Handler) => {
    roomHandlers.get(event)?.delete(handler);
    return mockRoom;
  }),
};

let currentRoom: typeof mockRoom | null = mockRoom;

vi.mock('../../hooks/useRoom', () => ({
  useRoom: () => ({ room: currentRoom, setRoom: vi.fn(), getRoom: vi.fn() }),
}));

vi.mock('livekit-client', () => ({
  RoomEvent: {
    ParticipantDisconnected: 'participantDisconnected',
  },
  Track: {
    Source: {
      Camera: 'camera',
      Microphone: 'microphone',
      ScreenShare: 'screen_share',
    },
  },
  Participant: class {},
  RemoteParticipant: class {},
}));

import { useParticipantTracks } from '../../hooks/useParticipantTracks';

describe('useParticipantTracks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    roomHandlers.clear();
    currentRoom = mockRoom;
    mockLocalParticipant.getTrackPublication.mockReturnValue(null);
    mockLocalParticipant.metadata = null;
    mockLocalParticipant.isSpeaking = false;
    mockRemoteParticipant.getTrackPublication.mockReturnValue(null);
    mockRemoteParticipant.metadata = null;
    mockRemoteParticipant.isSpeaking = false;
  });

  function renderHookFor(identity: string) {
    const queryClient = createTestQueryClient();
    return renderHook(() => useParticipantTracks(identity), {
      wrapper: createTestWrapper({ queryClient }),
    });
  }

  it('returns all false when no room', () => {
    currentRoom = null;
    const { result } = renderHookFor('local-user');

    expect(result.current.isCameraEnabled).toBe(false);
    expect(result.current.isMicrophoneEnabled).toBe(false);
    expect(result.current.isScreenShareEnabled).toBe(false);
    expect(result.current.participant).toBeNull();
  });

  it('returns all false when participant not found', () => {
    const { result } = renderHookFor('unknown-user');

    expect(result.current.isCameraEnabled).toBe(false);
    expect(result.current.participant).toBeNull();
  });

  it('initializes from existing track publications', () => {
    mockLocalParticipant.getTrackPublication.mockImplementation((source: string) => {
      if (source === 'camera') return { isMuted: false };
      if (source === 'microphone') return { isMuted: false };
      return null;
    });

    const { result } = renderHookFor('local-user');

    expect(result.current.isCameraEnabled).toBe(true);
    expect(result.current.isMicrophoneEnabled).toBe(true);
    expect(result.current.isScreenShareEnabled).toBe(false);
  });

  describe('local participant events', () => {
    it('subscribes to localTrackPublished for local participant', () => {
      renderHookFor('local-user');

      expect(mockLocalParticipant.on).toHaveBeenCalledWith('localTrackPublished', expect.any(Function));
      expect(mockLocalParticipant.on).not.toHaveBeenCalledWith('trackPublished', expect.any(Function));
    });

    it('subscribes to localTrackUnpublished for local participant', () => {
      renderHookFor('local-user');

      expect(mockLocalParticipant.on).toHaveBeenCalledWith('localTrackUnpublished', expect.any(Function));
      expect(mockLocalParticipant.on).not.toHaveBeenCalledWith('trackUnpublished', expect.any(Function));
    });

    it('updates camera state on localTrackPublished', () => {
      const { result } = renderHookFor('local-user');
      expect(result.current.isCameraEnabled).toBe(false);

      // Simulate publishing camera track
      mockLocalParticipant.getTrackPublication.mockImplementation((source: string) => {
        if (source === 'camera') return { isMuted: false };
        return null;
      });

      act(() => {
        mockLocalParticipant._emit('localTrackPublished');
      });

      expect(result.current.isCameraEnabled).toBe(true);
    });

    it('updates screen share state on localTrackPublished', () => {
      const { result } = renderHookFor('local-user');
      expect(result.current.isScreenShareEnabled).toBe(false);

      mockLocalParticipant.getTrackPublication.mockImplementation((source: string) => {
        if (source === 'screen_share') return { isMuted: false };
        return null;
      });

      act(() => {
        mockLocalParticipant._emit('localTrackPublished');
      });

      expect(result.current.isScreenShareEnabled).toBe(true);
    });

    it('updates state on localTrackUnpublished', () => {
      mockLocalParticipant.getTrackPublication.mockImplementation((source: string) => {
        if (source === 'camera') return { isMuted: false };
        return null;
      });

      const { result } = renderHookFor('local-user');
      expect(result.current.isCameraEnabled).toBe(true);

      mockLocalParticipant.getTrackPublication.mockReturnValue(null);

      act(() => {
        mockLocalParticipant._emit('localTrackUnpublished');
      });

      expect(result.current.isCameraEnabled).toBe(false);
    });

    it('cleans up local events on unmount', () => {
      const { unmount } = renderHookFor('local-user');

      unmount();

      expect(mockLocalParticipant.off).toHaveBeenCalledWith('localTrackPublished', expect.any(Function));
      expect(mockLocalParticipant.off).toHaveBeenCalledWith('localTrackUnpublished', expect.any(Function));
      expect(mockLocalParticipant.off).not.toHaveBeenCalledWith('trackPublished', expect.any(Function));
    });
  });

  describe('remote participant events', () => {
    it('subscribes to trackPublished for remote participant', () => {
      renderHookFor('remote-user');

      expect(mockRemoteParticipant.on).toHaveBeenCalledWith('trackPublished', expect.any(Function));
      expect(mockRemoteParticipant.on).not.toHaveBeenCalledWith('localTrackPublished', expect.any(Function));
    });

    it('updates camera state on trackPublished', () => {
      const { result } = renderHookFor('remote-user');
      expect(result.current.isCameraEnabled).toBe(false);

      mockRemoteParticipant.getTrackPublication.mockImplementation((source: string) => {
        if (source === 'camera') return { isMuted: false };
        return null;
      });

      act(() => {
        mockRemoteParticipant._emit('trackPublished');
      });

      expect(result.current.isCameraEnabled).toBe(true);
    });

    it('cleans up remote events on unmount', () => {
      const { unmount } = renderHookFor('remote-user');

      unmount();

      expect(mockRemoteParticipant.off).toHaveBeenCalledWith('trackPublished', expect.any(Function));
      expect(mockRemoteParticipant.off).toHaveBeenCalledWith('trackUnpublished', expect.any(Function));
    });
  });

  describe('shared events (both local and remote)', () => {
    it('updates on trackMuted for local participant', () => {
      mockLocalParticipant.getTrackPublication.mockImplementation((source: string) => {
        if (source === 'microphone') return { isMuted: false };
        return null;
      });

      const { result } = renderHookFor('local-user');
      expect(result.current.isMicrophoneEnabled).toBe(true);

      mockLocalParticipant.getTrackPublication.mockImplementation((source: string) => {
        if (source === 'microphone') return { isMuted: true };
        return null;
      });

      act(() => {
        mockLocalParticipant._emit('trackMuted');
      });

      expect(result.current.isMicrophoneEnabled).toBe(false);
    });

    it('updates isSpeaking state', () => {
      const { result } = renderHookFor('local-user');
      expect(result.current.isSpeaking).toBe(false);

      act(() => {
        mockLocalParticipant._emit('isSpeakingChanged', true);
      });

      expect(result.current.isSpeaking).toBe(true);
    });

    it('reads deafened state from metadata', () => {
      mockLocalParticipant.metadata = JSON.stringify({ isDeafened: true });

      const { result } = renderHookFor('local-user');

      expect(result.current.isDeafened).toBe(true);
    });
  });
});
