import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, act } from '@testing-library/react';
import { renderWithProviders } from '../test-utils';
import { VideoTiles } from '../../components/Voice/VideoTiles';
import { VoiceSessionType } from '../../contexts/VoiceContext';

let mockWatchingCameras = new Set<string>();
let mockWatchingScreenShares = new Set<string>();

vi.mock('../../contexts/VoiceContext', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../contexts/VoiceContext')>();
  return {
    ...actual,
    useVoice: vi.fn(() => ({
      isDeafened: false,
      watchingCameras: mockWatchingCameras,
      watchingScreenShares: mockWatchingScreenShares,
      hiddenLocalTiles: new Set<string>(),
    })),
    useVoiceDispatch: vi.fn(() => ({
      dispatch: vi.fn(),
      stateRef: { current: {} },
    })),
  };
});

vi.mock('../../hooks/useTrackSubscription', () => ({
  useTrackSubscriptionActions: vi.fn(() => ({
    watchCamera: vi.fn(),
    stopWatchingCamera: vi.fn(),
    watchScreenShare: vi.fn(),
    stopWatchingScreenShare: vi.fn(),
  })),
}));

vi.mock('../../hooks/useRoom', () => ({
  useRoom: vi.fn(() => ({ room: { on: vi.fn(), off: vi.fn() } })),
}));

vi.mock('../../components/Common/UserAvatar', () => ({
  default: ({ userId }: { userId?: string }) => (
    <div data-testid="user-avatar" data-user-id={userId} />
  ),
}));

// jsdom doesn't implement HTMLMediaElement.play() — stub it to return a resolved promise
beforeEach(() => {
  vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue();
});

vi.mock('../../api-client/client.gen', async (importOriginal) => {
  const { createClient, createConfig } = await import('../../api-client/client');
  return {
    ...(await importOriginal<Record<string, unknown>>()),
    client: createClient(createConfig({ baseUrl: 'http://localhost:3000' })),
  };
});

// --- Event emitter helpers ---
type Handler = (...args: unknown[]) => void;
let roomEventHandlers: Map<string, Set<Handler>>;
let localEventHandlers: Map<string, Set<Handler>>;

function emitRoomEvent(event: string, ...args: unknown[]) {
  roomEventHandlers.get(event)?.forEach((h) => h(...args));
}

// --- Mock track / participant factories ---
function createMockTrackPublication(source: string, muted = false) {
  return {
    source,
    isMuted: muted,
    track: { attach: vi.fn(), detach: vi.fn() },
  };
}

function createMockParticipant(
  identity: string,
  videoTracks: ReturnType<typeof createMockTrackPublication>[] = [],
  audioTracks: ReturnType<typeof createMockTrackPublication>[] = [],
) {
  const videoMap = new Map<string, ReturnType<typeof createMockTrackPublication>>();
  videoTracks.forEach((t, i) => videoMap.set(`video-${i}`, t));
  const audioMap = new Map<string, ReturnType<typeof createMockTrackPublication>>();
  audioTracks.forEach((t, i) => audioMap.set(`audio-${i}`, t));

  return {
    identity,
    name: identity,
    videoTrackPublications: videoMap,
    audioTrackPublications: audioMap,
  };
}

// --- Mock room ---
let mockLocalParticipant: ReturnType<typeof createMockParticipant> & {
  on: ReturnType<typeof vi.fn>;
  off: ReturnType<typeof vi.fn>;
};
let remoteParticipants: Map<string, ReturnType<typeof createMockParticipant>>;
let mockRoom: {
  localParticipant: typeof mockLocalParticipant;
  remoteParticipants: typeof remoteParticipants;
  on: ReturnType<typeof vi.fn>;
  off: ReturnType<typeof vi.fn>;
};

function buildMockRoom() {
  roomEventHandlers = new Map();
  localEventHandlers = new Map();

  mockLocalParticipant = {
    ...createMockParticipant('local-user'),
    on: vi.fn((event: string, handler: Handler) => {
      if (!localEventHandlers.has(event)) localEventHandlers.set(event, new Set());
      localEventHandlers.get(event)!.add(handler);
      return mockLocalParticipant;
    }),
    off: vi.fn((event: string, handler: Handler) => {
      localEventHandlers.get(event)?.delete(handler);
      return mockLocalParticipant;
    }),
  };

  remoteParticipants = new Map();

  mockRoom = {
    localParticipant: mockLocalParticipant,
    remoteParticipants,
    on: vi.fn((event: string, handler: Handler) => {
      if (!roomEventHandlers.has(event)) roomEventHandlers.set(event, new Set());
      roomEventHandlers.get(event)!.add(handler);
      return mockRoom;
    }),
    off: vi.fn((event: string, handler: Handler) => {
      roomEventHandlers.get(event)?.delete(handler);
      return mockRoom;
    }),
  };

  return mockRoom;
}

// --- Mock livekit-client ---
vi.mock('livekit-client', () => ({
  RoomEvent: {
    TrackPublished: 'trackPublished',
    TrackUnpublished: 'trackUnpublished',
    TrackSubscribed: 'trackSubscribed',
    TrackUnsubscribed: 'trackUnsubscribed',
    TrackMuted: 'trackMuted',
    TrackUnmuted: 'trackUnmuted',
    ParticipantDisconnected: 'participantDisconnected',
  },
  Track: {
    Source: {
      Camera: 'camera',
      Microphone: 'microphone',
      ScreenShare: 'screen_share',
      ScreenShareAudio: 'screen_share_audio',
    },
  },
}));

// --- Mock hooks ---
const mockActions = {
  toggleMute: vi.fn(),
  toggleDeafen: vi.fn(),
  toggleVideo: vi.fn(),
  toggleScreenShare: vi.fn(),
  setShowVideoTiles: vi.fn(),
  leaveVoiceChannel: vi.fn(),
  switchAudioInputDevice: vi.fn(),
  switchVideoInputDevice: vi.fn(),
  requestMaximize: vi.fn(),
  joinVoiceChannel: vi.fn(),
  joinDmVoice: vi.fn(),
  toggleAudio: vi.fn(),
  switchAudioOutputDevice: vi.fn(),
};

const defaultVoiceState = {
  isConnected: true,
  isConnecting: false,
  connectionError: null,
  contextType: VoiceSessionType.Channel,
  currentChannelId: 'ch-1',
  channelName: 'General Voice',
  communityId: 'c1',
  isPrivate: false,
  createdAt: '2025-01-01T00:00:00Z',
  currentDmGroupId: null,
  dmGroupName: null,
  isDeafened: false,
  showVideoTiles: true,
  screenShareAudioFailed: false,
  requestMaximize: false,
  selectedAudioInputId: null,
  selectedAudioOutputId: null,
  selectedVideoInputId: null,
  room: null as typeof mockRoom | null,
};

let voiceState = { ...defaultVoiceState };

vi.mock('../../hooks/useVoiceConnection', () => ({
  useVoiceConnection: vi.fn(() => ({
    state: voiceState,
    actions: mockActions,
  })),
}));

vi.mock('../../hooks/useLocalMediaState', () => ({
  useLocalMediaState: vi.fn(() => ({
    isCameraEnabled: false,
    isMicrophoneEnabled: true,
    isScreenShareEnabled: false,
  })),
}));

vi.mock('../../hooks/useResponsive', () => ({
  useResponsive: vi.fn(() => ({
    isMobile: false,
    isTablet: false,
    isDesktop: true,
    isPortrait: false,
    deviceType: 'desktop',
  })),
}));

vi.mock('../../contexts/ReplayBufferContext', () => ({
  useReplayBufferState: vi.fn(() => ({
    isReplayBufferActive: false,
  })),
}));

// Import mocked hooks for overriding in tests
const { useVoiceConnection } = await import('../../hooks/useVoiceConnection');
const { useLocalMediaState } = await import('../../hooks/useLocalMediaState');

describe('VideoTiles', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    buildMockRoom();
    mockWatchingCameras = new Set<string>();
    mockWatchingScreenShares = new Set<string>();
    voiceState = { ...defaultVoiceState, room: mockRoom };
    vi.mocked(useVoiceConnection).mockReturnValue({
      state: voiceState,
      actions: mockActions,
    } as never);
    vi.mocked(useLocalMediaState).mockReturnValue({
      isCameraEnabled: false,
      isMicrophoneEnabled: true,
      isScreenShareEnabled: false,
      audioTrack: undefined,
      videoTrack: undefined,
    });
  });

  it('returns null when not connected', () => {
    voiceState = { ...defaultVoiceState, isConnected: false, room: null };
    vi.mocked(useVoiceConnection).mockReturnValue({
      state: voiceState,
      actions: mockActions,
    } as never);

    const { container } = renderWithProviders(<VideoTiles />);
    expect(container.innerHTML).toBe('');
  });

  it('shows placeholder when connected but no video tracks', () => {
    renderWithProviders(<VideoTiles />);
    expect(screen.getByText(/enable your camera or screen share/i)).toBeInTheDocument();
  });

  it('renders tiles for remote participant with camera', () => {
    const remoteCam = createMockTrackPublication('camera');
    const remoteAudio = createMockTrackPublication('microphone');
    remoteParticipants.set(
      'remote-1',
      createMockParticipant('RemoteUser', [remoteCam], [remoteAudio]),
    );

    renderWithProviders(<VideoTiles />);
    expect(screen.getByText('RemoteUser')).toBeInTheDocument();
  });

  it('renders tiles for remote participant with screen share', () => {
    const remoteScreen = createMockTrackPublication('screen_share');
    remoteParticipants.set(
      'remote-1',
      createMockParticipant('ScreenSharer', [remoteScreen]),
    );

    renderWithProviders(<VideoTiles />);
    expect(screen.getByText(/ScreenSharer/)).toBeInTheDocument();
  });

  describe('stale memoization fix (#72, #85)', () => {
    it('updates tiles when remote participant publishes a track', () => {
      renderWithProviders(<VideoTiles />);

      // Initially no tiles
      expect(screen.getByText(/enable your camera or screen share/i)).toBeInTheDocument();

      // Simulate remote participant publishing a camera track
      const remoteCam = createMockTrackPublication('camera');
      remoteParticipants.set(
        'remote-1',
        createMockParticipant('NewUser', [remoteCam]),
      );

      act(() => {
        // Both handlers listen on trackPublished — pass a publication so auto-show handler doesn't crash
        emitRoomEvent('trackPublished', { source: 'camera' });
      });

      // Tile should now appear
      expect(screen.getByText('NewUser')).toBeInTheDocument();
    });

    it('removes tiles when remote participant unpublishes a track', () => {
      const remoteCam = createMockTrackPublication('camera');
      const participant = createMockParticipant('LeavingUser', [remoteCam]);
      remoteParticipants.set('remote-1', participant);

      renderWithProviders(<VideoTiles />);
      expect(screen.getByText('LeavingUser')).toBeInTheDocument();

      // Remove the track
      participant.videoTrackPublications.clear();

      act(() => {
        emitRoomEvent('trackUnpublished', { source: 'camera' });
      });

      expect(screen.queryByText('LeavingUser')).not.toBeInTheDocument();
    });

    it('removes tiles when remote participant disconnects', () => {
      const remoteCam = createMockTrackPublication('camera');
      remoteParticipants.set(
        'remote-1',
        createMockParticipant('DisconnectedUser', [remoteCam]),
      );

      renderWithProviders(<VideoTiles />);
      expect(screen.getByText('DisconnectedUser')).toBeInTheDocument();

      // Participant disconnects
      remoteParticipants.delete('remote-1');

      act(() => {
        emitRoomEvent('participantDisconnected');
      });

      expect(screen.queryByText('DisconnectedUser')).not.toBeInTheDocument();
    });

    it('updates tiles when remote track is subscribed', () => {
      renderWithProviders(<VideoTiles />);

      const remoteCam = createMockTrackPublication('camera');
      remoteParticipants.set(
        'remote-1',
        createMockParticipant('SubscribedUser', [remoteCam]),
      );

      act(() => {
        emitRoomEvent('trackSubscribed');
      });

      expect(screen.getByText('SubscribedUser')).toBeInTheDocument();
    });

    it('updates tiles when remote track mute state changes', () => {
      const remoteCam = createMockTrackPublication('camera', false);
      const participant = createMockParticipant('MutingUser', [remoteCam]);
      remoteParticipants.set('remote-1', participant);

      renderWithProviders(<VideoTiles />);
      expect(screen.getByText('MutingUser')).toBeInTheDocument();

      // Mute the camera track — tile should disappear since isMuted check filters it
      remoteCam.isMuted = true;

      act(() => {
        emitRoomEvent('trackMuted');
      });

      expect(screen.queryByText('MutingUser')).not.toBeInTheDocument();
    });
  });

  it('renders one tile per remote participant with video', () => {
    mockWatchingCameras = new Set(['UserA', 'UserB']);
    remoteParticipants.set(
      'remote-1',
      createMockParticipant('UserA', [createMockTrackPublication('camera')]),
    );
    remoteParticipants.set(
      'remote-2',
      createMockParticipant('UserB', [createMockTrackPublication('camera')]),
    );

    renderWithProviders(<VideoTiles />);

    expect(screen.getByText('UserA')).toBeInTheDocument();
    expect(screen.getByText('UserB')).toBeInTheDocument();
  });

  describe('layout modes and pinning', () => {
    beforeEach(() => {
      mockWatchingCameras = new Set(['UserA', 'UserB']);
      remoteParticipants.set(
        'remote-1',
        createMockParticipant('UserA', [createMockTrackPublication('camera')], [createMockTrackPublication('microphone')]),
      );
      remoteParticipants.set(
        'remote-2',
        createMockParticipant('UserB', [createMockTrackPublication('camera')], [createMockTrackPublication('microphone')]),
      );
    });

    it('renders grid/sidebar/spotlight layout buttons on desktop', () => {
      renderWithProviders(<VideoTiles />);

      expect(screen.getByRole('button', { name: 'Grid Layout' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Sidebar Layout' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Spotlight Layout' })).toBeInTheDocument();
    });

    it('clicking a tile in grid mode spotlights it — only the spotlit participant renders large', async () => {
      const { user } = renderWithProviders(<VideoTiles />);

      // Both tiles visible in grid mode
      expect(screen.getByText('UserA')).toBeInTheDocument();
      expect(screen.getByText('UserB')).toBeInTheDocument();

      // Click UserA's tile to enter spotlight mode
      const cardA = screen.getByText('UserA').closest('[class*="MuiCard"]')!;
      await user.click(cardA);

      // Spotlight layout renders only the spotlit tile
      expect(screen.getByText('UserA')).toBeInTheDocument();
      expect(screen.queryByText('UserB')).not.toBeInTheDocument();
    });

    it('spotlight layout button spotlights the first watched tile', async () => {
      const { user } = renderWithProviders(<VideoTiles />);

      const spotlightButton = screen.getByRole('button', { name: 'Spotlight Layout' });
      await user.click(spotlightButton);

      // No spotlightTileId selected — falls back to first watched tile
      expect(screen.getByText('UserA')).toBeInTheDocument();
      expect(screen.queryByText('UserB')).not.toBeInTheDocument();
    });

    it('tiles render no pin or fullscreen buttons (#320 — tile click handles both)', async () => {
      const { user } = renderWithProviders(<VideoTiles />);

      // CropFree only appears as the Spotlight Layout header button, never inside tiles
      const assertNoTileButtons = () => {
        expect(screen.queryByTestId('PushPinOutlinedIcon')).not.toBeInTheDocument();
        expect(screen.queryByTestId('PushPinIcon')).not.toBeInTheDocument();
        for (const icon of screen.queryAllByTestId('CropFreeIcon')) {
          expect(icon.closest('button')).toHaveAccessibleName('Spotlight Layout');
        }
      };

      // Grid layout
      assertNoTileButtons();

      // Spotlight a tile — still no per-tile pin/fullscreen buttons
      const cardB = screen.getByText('UserB').closest('[class*="MuiCard"]')!;
      await user.click(cardB);
      assertNoTileButtons();
    });

    it('sidebar layout pins the first watched tile by default and clicking a sidebar tile re-pins it', async () => {
      const { user } = renderWithProviders(<VideoTiles />);

      const sidebarButton = screen.getByRole('button', { name: 'Sidebar Layout' });
      await user.click(sidebarButton);

      // Default main tile is the first watched tile (UserA before UserB in DOM)
      expect(
        screen.getByText('UserA').compareDocumentPosition(screen.getByText('UserB')) &
          Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();

      // Clicking UserB's sidebar tile pins it as the main view
      const cardB = screen.getByText('UserB').closest('[class*="MuiCard"]')!;
      await user.click(cardB);

      expect(
        screen.getByText('UserB').compareDocumentPosition(screen.getByText('UserA')) &
          Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();
    });

    it('grid layout button returns from spotlight to grid', async () => {
      const { user } = renderWithProviders(<VideoTiles />);

      // Enter spotlight
      await user.click(screen.getByRole('button', { name: 'Spotlight Layout' }));
      expect(screen.queryByText('UserB')).not.toBeInTheDocument();

      // Back to grid
      await user.click(screen.getByRole('button', { name: 'Grid Layout' }));
      expect(screen.getByText('UserA')).toBeInTheDocument();
      expect(screen.getByText('UserB')).toBeInTheDocument();
    });
  });

  // Auto-show behavior was removed in #336 — screen share opt-in is now per-participant

  describe('spotlight objectFit (#106)', () => {
    it('uses contain objectFit for camera video when spotlighted', async () => {
      mockWatchingCameras = new Set(['SpotlightUser']);
      const remoteCam = createMockTrackPublication('camera');
      const remoteAudio = createMockTrackPublication('microphone');
      remoteParticipants.set(
        'remote-1',
        createMockParticipant('SpotlightUser', [remoteCam], [remoteAudio]),
      );

      const { user } = renderWithProviders(<VideoTiles />);

      // Click the tile to enter spotlight mode
      const tileText = screen.getByText('SpotlightUser');
      const card = tileText.closest('[class*="MuiCard"]')!;
      await user.click(card);

      // After spotlight, re-render should show the video with contain
      const videos = document.querySelectorAll('video');
      const cameraVideo = Array.from(videos).find(v => v.style.objectFit === 'contain');
      expect(cameraVideo).toBeTruthy();
    });
  });

  describe('grid layout (#83)', () => {
    it('does not set minHeight on video tiles', () => {
      mockWatchingCameras = new Set(['GridUser']);
      const remoteCam = createMockTrackPublication('camera');
      remoteParticipants.set(
        'remote-1',
        createMockParticipant('GridUser', [remoteCam]),
      );

      renderWithProviders(<VideoTiles />);

      const cards = document.querySelectorAll('[class*="MuiCard"]');
      cards.forEach(card => {
        const style = (card as HTMLElement).style;
        expect(style.minHeight).not.toBe('200px');
      });
    });

    it('uses flexbox layout instead of MUI Grid', () => {
      mockWatchingCameras = new Set(['User1', 'User2']);
      const remoteCam1 = createMockTrackPublication('camera');
      const remoteCam2 = createMockTrackPublication('camera');
      remoteParticipants.set(
        'remote-1',
        createMockParticipant('User1', [remoteCam1]),
      );
      remoteParticipants.set(
        'remote-2',
        createMockParticipant('User2', [remoteCam2]),
      );

      renderWithProviders(<VideoTiles />);

      // Should not have any MUI Grid elements
      const grids = document.querySelectorAll('[class*="MuiGrid"]');
      expect(grids.length).toBe(0);
    });
  });

  describe('event listener cleanup', () => {
    it('removes all room event listeners on unmount', () => {
      const { unmount } = renderWithProviders(<VideoTiles />);

      unmount();

      expect(mockRoom.off).toHaveBeenCalledWith('trackPublished', expect.any(Function));
      expect(mockRoom.off).toHaveBeenCalledWith('trackUnpublished', expect.any(Function));
      expect(mockRoom.off).toHaveBeenCalledWith('trackSubscribed', expect.any(Function));
      expect(mockRoom.off).toHaveBeenCalledWith('trackUnsubscribed', expect.any(Function));
      expect(mockRoom.off).toHaveBeenCalledWith('trackMuted', expect.any(Function));
      expect(mockRoom.off).toHaveBeenCalledWith('trackUnmuted', expect.any(Function));
      expect(mockRoom.off).toHaveBeenCalledWith('participantDisconnected', expect.any(Function));
    });

    it('removes local participant event listeners on unmount', () => {
      const { unmount } = renderWithProviders(<VideoTiles />);

      unmount();

      expect(mockLocalParticipant.off).toHaveBeenCalledWith('trackPublished', expect.any(Function));
      expect(mockLocalParticipant.off).toHaveBeenCalledWith('trackUnpublished', expect.any(Function));
    });
  });
});
