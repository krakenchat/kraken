import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '../test-utils';
import { PersistentVideoOverlay } from '../../components/Voice/PersistentVideoOverlay';

vi.mock('../../api-client/client.gen', async (importOriginal) => {
  const { createClient, createConfig } = await import('../../api-client/client');
  return {
    ...(await importOriginal<Record<string, unknown>>()),
    client: createClient(createConfig({ baseUrl: 'http://localhost:3000' })),
  };
});

// --- Mock actions ---
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
  channelName: 'General Voice',
  contextType: 'channel' as const,
  showVideoTiles: true,
  requestMaximize: false,
  dmGroupName: null,
};

let mockVoiceState = { ...defaultVoiceState };
const mockDispatch = vi.fn();

vi.mock('../../contexts/VoiceContext', () => ({
  useVoice: vi.fn(() => mockVoiceState),
  useVoiceDispatch: vi.fn(() => ({ dispatch: mockDispatch })),
}));

vi.mock('../../hooks/useVoiceConnection', () => ({
  useVoiceConnection: vi.fn(() => ({
    state: mockVoiceState,
    actions: mockActions,
  })),
}));

vi.mock('../../contexts/VideoOverlayContext', () => ({
  useVideoOverlay: vi.fn(() => ({
    containerElement: null,
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

// Mock VideoTiles to avoid complex setup
vi.mock('../../components/Voice/VideoTiles', () => ({
  VideoTiles: () => <div data-testid="video-tiles">Video Tiles</div>,
}));

const { useVoice } = await import('../../contexts/VoiceContext');
const { useResponsive } = await import('../../hooks/useResponsive');

describe('PersistentVideoOverlay', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockVoiceState = { ...defaultVoiceState };
    vi.mocked(useVoice).mockReturnValue(mockVoiceState as never);
    vi.mocked(useResponsive).mockReturnValue({
      isMobile: false,
      isTablet: false,
      isDesktop: true,
      isPortrait: false,
      deviceType: 'desktop',
    } as never);
  });

  it('returns null when not connected', () => {
    mockVoiceState = { ...defaultVoiceState, isConnected: false };
    vi.mocked(useVoice).mockReturnValue(mockVoiceState as never);

    const { container } = renderWithProviders(<PersistentVideoOverlay />);
    expect(container.innerHTML).toBe('');
  });

  it('returns null when video tiles are hidden', () => {
    mockVoiceState = { ...defaultVoiceState, showVideoTiles: false };
    vi.mocked(useVoice).mockReturnValue(mockVoiceState as never);

    const { container } = renderWithProviders(<PersistentVideoOverlay />);
    expect(container.innerHTML).toBe('');
  });

  it('renders VideoTiles on desktop', () => {
    renderWithProviders(<PersistentVideoOverlay />);
    expect(screen.getByTestId('video-tiles')).toBeInTheDocument();
  });

  it('renders channel name in PiP header on desktop', () => {
    renderWithProviders(<PersistentVideoOverlay />);
    expect(screen.getByText('General Voice')).toBeInTheDocument();
  });

  it('renders mobile full-screen overlay on mobile', () => {
    vi.mocked(useResponsive).mockReturnValue({
      isMobile: true,
      isTablet: false,
      isDesktop: false,
      isPortrait: true,
      deviceType: 'phone',
    } as never);

    renderWithProviders(<PersistentVideoOverlay />);

    // Mobile overlay should render VideoTiles
    expect(screen.getByTestId('video-tiles')).toBeInTheDocument();
    // Mobile overlay should NOT have minimize/maximize/drag controls
    expect(screen.queryByTestId('DragIndicatorIcon')).not.toBeInTheDocument();
    expect(screen.queryByTestId('MinimizeIcon')).not.toBeInTheDocument();
  });

  it('mobile overlay has a close button that hides video tiles', async () => {
    vi.mocked(useResponsive).mockReturnValue({
      isMobile: true,
      isTablet: false,
      isDesktop: false,
      isPortrait: true,
      deviceType: 'phone',
    } as never);

    const { user } = renderWithProviders(<PersistentVideoOverlay />);

    // The close button has a CloseIcon
    const closeIcon = screen.getByTestId('CloseIcon');
    const closeButton = closeIcon.closest('button')!;
    await user.click(closeButton);

    expect(mockActions.setShowVideoTiles).toHaveBeenCalledWith(false);
  });

  it('desktop PiP has minimize, maximize, and close buttons', () => {
    renderWithProviders(<PersistentVideoOverlay />);

    expect(screen.getByTestId('MinimizeIcon')).toBeInTheDocument();
    expect(screen.getByTestId('FullscreenIcon')).toBeInTheDocument();
    expect(screen.getByTestId('CloseIcon')).toBeInTheDocument();
  });

  it('desktop PiP has drag indicator', () => {
    renderWithProviders(<PersistentVideoOverlay />);

    expect(screen.getByTestId('DragIndicatorIcon')).toBeInTheDocument();
  });
});
