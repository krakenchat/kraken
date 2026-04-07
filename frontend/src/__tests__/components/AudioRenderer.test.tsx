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

// --- Mock useVoice hook ---
let mockWatchingScreenShares = new Set<string>();

vi.mock('../../contexts/VoiceContext', () => ({
  useVoice: vi.fn(() => ({ watchingScreenShares: mockWatchingScreenShares })),
}));

describe('AudioRenderer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    buildMockRoom();
    mockWatchingScreenShares = new Set<string>();
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

  it('renders screen share audio when watching that participant', () => {
    mockWatchingScreenShares = new Set(['user-1']);
    const screenAudioPub = createMockPublication('screen_share_audio');
    const participant = createMockRemoteParticipant('user-1', [screenAudioPub]);
    mockRoom!.remoteParticipants.set('user-1', participant);

    const { container } = render(<AudioRenderer />);
    const audioElements = container.querySelectorAll('audio');
    expect(audioElements.length).toBe(1);
  });

  it('does NOT render screen share audio when NOT watching that participant', () => {
    mockWatchingScreenShares = new Set<string>();
    const screenAudioPub = createMockPublication('screen_share_audio');
    const participant = createMockRemoteParticipant('user-1', [screenAudioPub]);
    mockRoom!.remoteParticipants.set('user-1', participant);

    const { container } = render(<AudioRenderer />);
    const audioElements = container.querySelectorAll('audio');
    expect(audioElements.length).toBe(0);
  });

  it('renders screen share audio only for watched participants when multiple are present', () => {
    mockWatchingScreenShares = new Set(['user-1']);
    const screenAudioPub1 = createMockPublication('screen_share_audio');
    const screenAudioPub2 = createMockPublication('screen_share_audio');
    const participant1 = createMockRemoteParticipant('user-1', [screenAudioPub1]);
    const participant2 = createMockRemoteParticipant('user-2', [screenAudioPub2]);
    mockRoom!.remoteParticipants.set('user-1', participant1);
    mockRoom!.remoteParticipants.set('user-2', participant2);

    const { container } = render(<AudioRenderer />);
    const audioElements = container.querySelectorAll('audio');
    expect(audioElements.length).toBe(1);
  });

  it('renders both mic and screen share audio when watching participant', () => {
    mockWatchingScreenShares = new Set(['user-1']);
    const micPub = createMockPublication('microphone');
    const screenAudioPub = createMockPublication('screen_share_audio');
    const participant = createMockRemoteParticipant('user-1', [micPub, screenAudioPub]);
    mockRoom!.remoteParticipants.set('user-1', participant);

    const { container } = render(<AudioRenderer />);
    const audioElements = container.querySelectorAll('audio');
    expect(audioElements.length).toBe(2);
  });

  it('renders only mic audio when not watching participant screen share', () => {
    mockWatchingScreenShares = new Set<string>();
    const micPub = createMockPublication('microphone');
    const screenAudioPub = createMockPublication('screen_share_audio');
    const participant = createMockRemoteParticipant('user-1', [micPub, screenAudioPub]);
    mockRoom!.remoteParticipants.set('user-1', participant);

    const { container } = render(<AudioRenderer />);
    const audioElements = container.querySelectorAll('audio');
    expect(audioElements.length).toBe(1);
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
