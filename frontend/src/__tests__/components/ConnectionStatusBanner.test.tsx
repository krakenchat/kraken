import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '../test-utils';
import { ConnectionStatusBanner } from '../../components/ConnectionStatusBanner';

vi.mock('../../api-client/client.gen', async (importOriginal) => {
  const { createClient, createConfig } = await import('../../api-client/client');
  return {
    ...(await importOriginal<Record<string, unknown>>()),
    client: createClient(createConfig({ baseUrl: 'http://localhost:3000' })),
  };
});

const mockSocketConnected = vi.fn(() => true);
vi.mock('../../hooks/useSocket', () => ({
  useSocket: vi.fn(() => null),
  useSocketConnected: () => mockSocketConnected(),
}));

const defaultVoiceState = {
  isConnected: false,
  currentChannelId: null,
  currentDmGroupId: null,
  showVideoTiles: false,
};

vi.mock('../../hooks/useVoiceConnection', () => ({
  useVoiceConnection: vi.fn(() => ({
    state: defaultVoiceState,
    actions: {},
  })),
}));

vi.mock('../../hooks/useResponsive', () => ({
  useResponsive: vi.fn(() => ({
    isMobile: false,
    isTablet: false,
    isDesktop: true,
    deviceType: 'desktop',
  })),
}));

const { useVoiceConnection } = await import('../../hooks/useVoiceConnection');

describe('ConnectionStatusBanner', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSocketConnected.mockReturnValue(true);
    vi.mocked(useVoiceConnection).mockReturnValue({
      state: { ...defaultVoiceState },
      actions: {},
    } as never);
  });

  it('renders nothing when connected', () => {
    mockSocketConnected.mockReturnValue(true);
    const { container } = renderWithProviders(<ConnectionStatusBanner />);
    expect(container.innerHTML).toBe('');
  });

  it('shows reconnecting chip when disconnected', () => {
    mockSocketConnected.mockReturnValue(false);
    renderWithProviders(<ConnectionStatusBanner />);
    expect(screen.getByText('Reconnecting...')).toBeInTheDocument();
  });

  it('renders as a chip (not a full-width banner)', () => {
    mockSocketConnected.mockReturnValue(false);
    renderWithProviders(<ConnectionStatusBanner />);

    const chip = screen.getByText('Reconnecting...').closest('.MuiChip-root');
    expect(chip).toBeInTheDocument();
  });

  it('positions higher when voice bar is active', () => {
    mockSocketConnected.mockReturnValue(false);
    vi.mocked(useVoiceConnection).mockReturnValue({
      state: {
        isConnected: true,
        currentChannelId: 'ch-1',
        currentDmGroupId: null,
        showVideoTiles: false,
      },
      actions: {},
    } as never);

    renderWithProviders(<ConnectionStatusBanner />);

    const chip = screen.getByText('Reconnecting...').closest('.MuiChip-root');
    expect(chip).toBeInTheDocument();
    // When voice bar is active, bottom should be VOICE_BAR_HEIGHT + 16 = 80
    const style = window.getComputedStyle(chip!);
    expect(style.position).toBe('fixed');
  });
});
