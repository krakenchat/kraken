import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import { AudioRenderer } from '../../components/Voice/AudioRenderer';

// --- Event emitter helpers ---
type Handler = (...args: unknown[]) => void;
let roomEventHandlers: Map<string, Set<Handler>>;

// --- Mock track / participant factories ---
function createMockPublication(source: string, hasTrack = true) {
  return {
    source,
    trackSid: `sid-${source}-${Math.random()}`,
    track: hasTrack ? { attach: vi.fn(), detach: vi.fn() } : undefined,
  };
}

function createMockRemoteParticipant(
  identity: string,
  audioPublications: ReturnType<typeof createMockPublication>[] = [],
) {
  const audioMap = new Map<string, ReturnType<typeof createMockPublication>>();
  audioPublications.forEach((p, i) => audioMap.set(`audio-${i}`, p));

  return {
    identity,
    audioTrackPublications: audioMap,
  };
}

// --- Mock room ---
let mockRoom: {
  remoteParticipants: Map<string, ReturnType<typeof createMockRemoteParticipant>>;
  on: ReturnType<typeof vi.fn>;
  off: ReturnType<typeof vi.fn>;
} | null = null;

function buildMockRoom() {
  roomEventHandlers = new Map();

  const room = {
    remoteParticipants: new Map<string, ReturnType<typeof createMockRemoteParticipant>>(),
    on: vi.fn((event: string, handler: Handler) => {
      if (!roomEventHandlers.has(event)) roomEventHandlers.set(event, new Set());
      roomEventHandlers.get(event)!.add(handler);
      return room;
    }),
    off: vi.fn((event: string, handler: Handler) => {
      roomEventHandlers.get(event)?.delete(handler);
      return room;
    }),
  };

  mockRoom = room;
  return room;
}

// --- Mock livekit-client ---
vi.mock('livekit-client', () => ({
  RoomEvent: {
    TrackSubscribed: 'trackSubscribed',
    TrackUnsubscribed: 'trackUnsubscribed',
    ParticipantConnected: 'participantConnected',
    ParticipantDisconnected: 'participantDisconnected',
  },
  Track: {
    Source: {
      Microphone: 'microphone',
      ScreenShareAudio: 'screen_share_audio',
    },
  },
}));

// --- Mock useRoom hook ---
vi.mock('../../hooks/useRoom', () => ({
  useRoom: vi.fn(() => ({ room: mockRoom })),
}));

describe('AudioRenderer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    buildMockRoom();
  });

  it('renders nothing when there is no room', () => {
    mockRoom = null;
    const { container } = render(<AudioRenderer />);
    expect(container.innerHTML).toBe('');
  });

  it('renders audio elements for microphone tracks', () => {
    const micPub = createMockPublication('microphone');
    const participant = createMockRemoteParticipant('user-1', [micPub]);
    mockRoom!.remoteParticipants.set('user-1', participant);

    const { container } = render(<AudioRenderer />);
    const audioElements = container.querySelectorAll('audio');
    expect(audioElements.length).toBe(1);
  });

  it('renders audio elements for screen share audio tracks', () => {
    const screenAudioPub = createMockPublication('screen_share_audio');
    const participant = createMockRemoteParticipant('user-1', [screenAudioPub]);
    mockRoom!.remoteParticipants.set('user-1', participant);

    const { container } = render(<AudioRenderer />);
    const audioElements = container.querySelectorAll('audio');
    expect(audioElements.length).toBe(1);
  });

  it('renders audio elements for both microphone and screen share audio from the same participant', () => {
    const micPub = createMockPublication('microphone');
    const screenAudioPub = createMockPublication('screen_share_audio');
    const participant = createMockRemoteParticipant('user-1', [micPub, screenAudioPub]);
    mockRoom!.remoteParticipants.set('user-1', participant);

    const { container } = render(<AudioRenderer />);
    const audioElements = container.querySelectorAll('audio');
    expect(audioElements.length).toBe(2);
  });

  it('does not render audio for tracks without a track object', () => {
    const pubNoTrack = createMockPublication('microphone', false);
    const participant = createMockRemoteParticipant('user-1', [pubNoTrack]);
    mockRoom!.remoteParticipants.set('user-1', participant);

    const { container } = render(<AudioRenderer />);
    const audioElements = container.querySelectorAll('audio');
    expect(audioElements.length).toBe(0);
  });

  it('does not render audio elements for non-audio sources like camera', () => {
    const cameraPub = createMockPublication('camera');
    const participant = createMockRemoteParticipant('user-1', [cameraPub]);
    mockRoom!.remoteParticipants.set('user-1', participant);

    const { container } = render(<AudioRenderer />);
    const audioElements = container.querySelectorAll('audio');
    expect(audioElements.length).toBe(0);
  });
});
