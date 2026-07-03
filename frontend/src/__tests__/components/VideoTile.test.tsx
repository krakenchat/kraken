import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { renderWithProviders } from '../test-utils';
import VideoTile from '../../components/Voice/VideoTile';
import type { VideoTileProps } from '../../components/Voice/VideoTile';

vi.mock('../../components/Common/UserAvatar', () => ({
  default: () => <div data-testid="avatar" />,
}));

vi.mock('../../components/Voice/ScreenShareVolumeControl', () => ({
  default: () => <div data-testid="volume-control" />,
}));

// jsdom doesn't implement HTMLMediaElement.play() — stub it to return a resolved promise
beforeAll(() => {
  vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue();
});

function createMockTrackPublication(source: string, isMuted = false) {
  return {
    source,
    isMuted,
    track: { attach: vi.fn(), detach: vi.fn() },
  };
}

function createMockParticipant(identity: string) {
  return {
    identity,
    name: identity,
    audioTrackPublications: new Map(),
  };
}

function renderTile(overrides: Partial<VideoTileProps> = {}) {
  const props = {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    participant: createMockParticipant('RemoteUser') as any,
    isLocal: false,
    ...overrides,
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return renderWithProviders(<VideoTile {...(props as any)} />);
}

describe('VideoTile', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders no pin or fullscreen buttons (#320)', () => {
    renderTile({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      videoTrack: createMockTrackPublication('camera') as any,
      onToggleFullscreen: vi.fn(),
    });

    expect(screen.queryByTestId('PushPinIcon')).not.toBeInTheDocument();
    expect(screen.queryByTestId('PushPinOutlinedIcon')).not.toBeInTheDocument();
    expect(screen.queryByTestId('CropFreeIcon')).not.toBeInTheDocument();
  });

  it('clicking the tile fires onToggleFullscreen', async () => {
    const onToggleFullscreen = vi.fn();
    const { user } = renderTile({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      videoTrack: createMockTrackPublication('camera') as any,
      onToggleFullscreen,
    });

    await user.click(screen.getByText('RemoteUser'));

    expect(onToggleFullscreen).toHaveBeenCalledOnce();
  });

  it('renders the stop-watching button and it does not trigger fullscreen', async () => {
    const onToggleFullscreen = vi.fn();
    const onStopWatching = vi.fn();
    const { user } = renderTile({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      videoTrack: createMockTrackPublication('camera') as any,
      onToggleFullscreen,
      onStopWatching,
    });

    // Action buttons are revealed on tile hover (Fade)
    const card = screen.getByText('RemoteUser').closest('[class*="MuiCard"]')!;
    fireEvent.mouseEnter(card);

    await user.click(screen.getByRole('button', { name: 'Stop watching' }));

    expect(onStopWatching).toHaveBeenCalledOnce();
    expect(onToggleFullscreen).not.toHaveBeenCalled();
  });

  it('renders the volume control only for remote screen share tiles', () => {
    const { unmount } = renderTile({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      screenTrack: createMockTrackPublication('screen_share') as any,
      isLocal: false,
    });
    expect(screen.getByTestId('volume-control')).toBeInTheDocument();
    unmount();

    // Local screen share: no volume control
    const { unmount: unmount2 } = renderTile({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      screenTrack: createMockTrackPublication('screen_share') as any,
      isLocal: true,
    });
    expect(screen.queryByTestId('volume-control')).not.toBeInTheDocument();
    unmount2();

    // Camera-only tile: no volume control
    renderTile({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      videoTrack: createMockTrackPublication('camera') as any,
    });
    expect(screen.queryByTestId('volume-control')).not.toBeInTheDocument();
  });

  it('placeholder tile fires onWatch when clicked', async () => {
    const onWatch = vi.fn();
    const { user } = renderTile({
      isPlaceholder: true,
      placeholderType: 'screen',
      onWatch,
    });

    await user.click(screen.getByText('Click to watch'));

    expect(onWatch).toHaveBeenCalledOnce();
  });
});
