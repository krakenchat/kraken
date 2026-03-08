import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ScreenShareVolumeControl from '../../components/Voice/ScreenShareVolumeControl';

let mockIsDeafened = false;
let mockRoom: { on: ReturnType<typeof vi.fn>; off: ReturnType<typeof vi.fn> } | null = null;

vi.mock('livekit-client', () => ({
  RoomEvent: {
    TrackSubscribed: 'trackSubscribed',
  },
  Track: {
    Source: {
      ScreenShareAudio: 'screen_share_audio',
    },
  },
}));

vi.mock('../../contexts/VoiceContext', () => ({
  useVoice: vi.fn(() => ({ isDeafened: mockIsDeafened })),
}));

vi.mock('../../hooks/useRoom', () => ({
  useRoom: vi.fn(() => ({ room: mockRoom })),
}));

function createMockParticipant(identity: string, hasScreenShareAudio = true) {
  const setVolume = vi.fn();
  const track = {
    setVolume,
    mediaStream: null,
  };
  const publications = new Map();
  if (hasScreenShareAudio) {
    publications.set('screen_share_audio', {
      track,
      source: 'screen_share_audio',
    });
  }
  return {
    participant: {
      identity,
      audioTrackPublications: publications,
    },
    setVolume,
    track,
  };
}

// Mock MUI theme
vi.mock('@mui/material/styles', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@mui/material/styles')>();
  return {
    ...actual,
    useTheme: () => ({
      palette: {
        background: { paper: '#1e1e1e' },
        common: { white: '#fff' },
      },
    }),
    alpha: (color: string, opacity: number) => `${color}/${opacity}`,
  };
});

describe('ScreenShareVolumeControl', () => {
  let localStorageGetSpy: ReturnType<typeof vi.spyOn>;
  let localStorageSetSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockIsDeafened = false;
    mockRoom = { on: vi.fn(), off: vi.fn() };
    localStorageGetSpy = vi.spyOn(Storage.prototype, 'getItem').mockReturnValue(null);
    localStorageSetSpy = vi.spyOn(Storage.prototype, 'setItem');
  });

  afterEach(() => {
    localStorageGetSpy.mockRestore();
    localStorageSetSpy.mockRestore();
  });

  it('renders volume icon button with aria-label', () => {
    const { participant } = createMockParticipant('user-1');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    render(<ScreenShareVolumeControl participant={participant as any} />);

    const button = screen.getByRole('button', { name: 'Screenshare volume' });
    expect(button).toBeInTheDocument();
  });

  it('opens popover with slider on click', async () => {
    const user = userEvent.setup();
    const { participant } = createMockParticipant('user-1');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    render(<ScreenShareVolumeControl participant={participant as any} />);

    await user.click(screen.getByRole('button', { name: 'Screenshare volume' }));

    expect(screen.getByRole('slider')).toBeInTheDocument();
  });

  it('reads initial volume from localStorage', () => {
    localStorageGetSpy.mockReturnValue('0.5');
    const { participant } = createMockParticipant('user-1');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    render(<ScreenShareVolumeControl participant={participant as any} />);

    expect(localStorageGetSpy).toHaveBeenCalledWith('voiceScreenShareVolume:user-1');
  });

  it('rejects invalid localStorage values and defaults to 100%', () => {
    localStorageGetSpy.mockReturnValue('not-a-number');
    const { participant } = createMockParticipant('user-1');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    render(<ScreenShareVolumeControl participant={participant as any} />);

    // Invalid stored value is rejected, so component defaults to 100%
    expect(screen.getByTestId('VolumeUpIcon')).toBeInTheDocument();
  });

  it('writes correct localStorage key on volume change', async () => {
    const user = userEvent.setup();
    const { participant } = createMockParticipant('user-1');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    render(<ScreenShareVolumeControl participant={participant as any} />);

    await user.click(screen.getByRole('button', { name: 'Screenshare volume' }));

    const slider = screen.getByRole('slider');
    fireEvent.change(slider, { target: { value: 50 } });

    const setCalls = localStorageSetSpy.mock.calls.filter(
      ([key]) => key === 'voiceScreenShareVolume:user-1',
    );
    expect(setCalls.length).toBeGreaterThan(0);
  });

  it('applies volume only to ScreenShareAudio tracks', async () => {
    const user = userEvent.setup();
    const { participant, setVolume } = createMockParticipant('user-1');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    render(<ScreenShareVolumeControl participant={participant as any} />);

    await user.click(screen.getByRole('button', { name: 'Screenshare volume' }));

    const slider = screen.getByRole('slider');
    const popover = slider.closest('[role="presentation"]') ?? document.body;
    const sliderInPopover = within(popover as HTMLElement).getByRole('slider');

    fireEvent.change(sliderInPopover, { target: { value: 75 } });

    expect(setVolume).toHaveBeenCalled();
  });

  it('disables slider when deafened', async () => {
    mockIsDeafened = true;
    const user = userEvent.setup();
    const { participant } = createMockParticipant('user-1');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    render(<ScreenShareVolumeControl participant={participant as any} />);

    await user.click(screen.getByRole('button', { name: 'Screenshare volume' }));

    const slider = screen.getByRole('slider');
    const sliderRoot = slider.closest('.MuiSlider-root');
    expect(sliderRoot).toHaveClass('Mui-disabled');
  });

  it('defaults to 100% when no stored volume exists', () => {
    localStorageGetSpy.mockReturnValue(null);
    const { participant } = createMockParticipant('user-1');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    render(<ScreenShareVolumeControl participant={participant as any} />);

    expect(screen.getByTestId('VolumeUpIcon')).toBeInTheDocument();
  });

  it('listens for TrackSubscribed events on the room', () => {
    const { participant } = createMockParticipant('user-1');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    render(<ScreenShareVolumeControl participant={participant as any} />);

    expect(mockRoom!.on).toHaveBeenCalledWith('trackSubscribed', expect.any(Function));
  });
});
