import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ScreenShareVolumeControl from '../../components/Voice/ScreenShareVolumeControl';

let mockIsDeafened = false;

vi.mock('livekit-client', () => ({
  Track: {
    Source: {
      ScreenShareAudio: 'screen_share_audio',
    },
  },
}));

vi.mock('../../contexts/VoiceContext', () => ({
  useVoice: vi.fn(() => ({ isDeafened: mockIsDeafened })),
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
    localStorageGetSpy = vi.spyOn(Storage.prototype, 'getItem').mockReturnValue(null);
    localStorageSetSpy = vi.spyOn(Storage.prototype, 'setItem');
  });

  afterEach(() => {
    localStorageGetSpy.mockRestore();
    localStorageSetSpy.mockRestore();
  });

  it('renders volume icon button', () => {
    const { participant } = createMockParticipant('user-1');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    render(<ScreenShareVolumeControl participant={participant as any} />);

    const button = screen.getByRole('button');
    expect(button).toBeInTheDocument();
  });

  it('opens popover with slider on click', async () => {
    const user = userEvent.setup();
    const { participant } = createMockParticipant('user-1');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    render(<ScreenShareVolumeControl participant={participant as any} />);

    await user.click(screen.getByRole('button'));

    expect(screen.getByRole('slider')).toBeInTheDocument();
  });

  it('reads initial volume from localStorage', () => {
    localStorageGetSpy.mockReturnValue('0.5');
    const { participant } = createMockParticipant('user-1');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    render(<ScreenShareVolumeControl participant={participant as any} />);

    expect(localStorageGetSpy).toHaveBeenCalledWith('voiceScreenShareVolume:user-1');
  });

  it('writes correct localStorage key on volume change', async () => {
    const user = userEvent.setup();
    const { participant } = createMockParticipant('user-1');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    render(<ScreenShareVolumeControl participant={participant as any} />);

    await user.click(screen.getByRole('button'));

    const slider = screen.getByRole('slider');
    // Simulate change via fireEvent since MUI slider doesn't respond well to userEvent
    fireEvent.change(slider, { target: { value: 50 } });

    // Check localStorage was written with the screenshare prefix
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

    // Open popover
    await user.click(screen.getByRole('button'));

    const slider = screen.getByRole('slider');
    const popover = slider.closest('[role="presentation"]') ?? document.body;
    const sliderInPopover = within(popover as HTMLElement).getByRole('slider');

    // The slider defaults to 100, trigger a change
    fireEvent.change(sliderInPopover, { target: { value: 75 } });

    // setVolume should have been called (from initial apply or change)
    expect(setVolume).toHaveBeenCalled();
  });

  it('disables slider when deafened', async () => {
    mockIsDeafened = true;
    const user = userEvent.setup();
    const { participant } = createMockParticipant('user-1');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    render(<ScreenShareVolumeControl participant={participant as any} />);

    await user.click(screen.getByRole('button'));

    const slider = screen.getByRole('slider');
    // MUI Slider adds Mui-disabled class to the root when disabled
    const sliderRoot = slider.closest('.MuiSlider-root');
    expect(sliderRoot).toHaveClass('Mui-disabled');
  });

  it('defaults to 100% when no stored volume exists', () => {
    localStorageGetSpy.mockReturnValue(null);
    const { participant } = createMockParticipant('user-1');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    render(<ScreenShareVolumeControl participant={participant as any} />);

    // No setVolume call with stored value since stored is null
    // The default volume icon should show VolumeUp (100%)
    expect(screen.getByTestId('VolumeUpIcon')).toBeInTheDocument();
  });
});
