import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import VoiceUserContextMenu from '../../components/Voice/VoiceUserContextMenu';
import { audioBoostManager } from '../../features/voice/audioBoostManager';
import type { VoicePresenceUserDto } from '../../api-client/types.gen';

vi.mock('livekit-client', () => ({
  Track: {
    Source: {
      Microphone: 'microphone',
      ScreenShareAudio: 'screen_share_audio',
    },
  },
}));

vi.mock('../../features/roles/useUserPermissions', () => ({
  useCanPerformAction: vi.fn(() => false),
}));

vi.mock('../../hooks/useVoiceConnection', () => ({
  useVoiceConnection: vi.fn(() => ({
    state: {
      room: { localParticipant: { identity: 'local-user' } },
      currentChannelId: 'channel-1',
    },
  })),
}));

const mockTrack = { setVolume: vi.fn(), mediaStream: null };
let mockParticipant: {
  identity: string;
  audioTrackPublications: Map<string, { track: typeof mockTrack; source: string }>;
} | null = null;

vi.mock('../../hooks/useParticipantTracks', () => ({
  useParticipantTracks: vi.fn(() => ({ participant: mockParticipant })),
}));

vi.mock('../../contexts/NotificationContext', () => ({
  useNotification: vi.fn(() => ({ showNotification: vi.fn() })),
}));

vi.mock('../../api-client/sdk.gen', () => ({
  livekitControllerMuteParticipant: vi.fn(),
}));

vi.mock('../../components/Moderation/BanDialog', () => ({ default: () => null }));
vi.mock('../../components/Moderation/TimeoutDialog', () => ({ default: () => null }));
vi.mock('../../components/Moderation/KickConfirmDialog', () => ({ default: () => null }));

vi.mock('../../features/voice/audioBoostManager', () => ({
  boostKey: (identity: string, source: string) => `${identity}:${source}`,
  audioBoostManager: {
    applyVolume: vi.fn(),
    setDeafened: vi.fn(),
    removeEntry: vi.fn(),
    removeForParticipant: vi.fn(),
    reset: vi.fn(),
    hasBoost: vi.fn(() => false),
  },
}));

const user: VoicePresenceUserDto = {
  id: 'user-2',
  username: 'remoteuser',
  displayName: 'Remote User',
} as VoicePresenceUserDto;

function renderMenu() {
  return render(
    <VoiceUserContextMenu
      anchorPosition={{ top: 10, left: 10 }}
      open
      onClose={vi.fn()}
      user={user}
      onViewProfile={vi.fn()}
    />,
  );
}

describe('VoiceUserContextMenu volume control', () => {
  let localStorageGetSpy: ReturnType<typeof vi.spyOn>;
  let localStorageSetSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockParticipant = {
      identity: 'user-2',
      audioTrackPublications: new Map([
        ['pub-1', { track: mockTrack, source: 'microphone' }],
      ]),
    };
    localStorageGetSpy = vi.spyOn(Storage.prototype, 'getItem').mockReturnValue(null);
    localStorageSetSpy = vi.spyOn(Storage.prototype, 'setItem');
  });

  afterEach(() => {
    localStorageGetSpy.mockRestore();
    localStorageSetSpy.mockRestore();
  });

  it('applies slider volume through the boost manager with the canonical track key', () => {
    renderMenu();

    fireEvent.change(screen.getByRole('slider'), { target: { value: 150 } });

    expect(audioBoostManager.applyVolume).toHaveBeenCalledWith(
      mockTrack,
      'user-2:microphone',
      150,
    );
  });

  it('persists slider volume to localStorage as a 0-2.0 float', () => {
    renderMenu();

    fireEvent.change(screen.getByRole('slider'), { target: { value: 150 } });

    expect(localStorageSetSpy).toHaveBeenCalledWith('voiceUserVolume:user-2', '1.5');
  });

  it('mutes through the boost manager via "Mute for Me"', () => {
    renderMenu();

    fireEvent.click(screen.getByText('Mute for Me'));

    expect(audioBoostManager.applyVolume).toHaveBeenCalledWith(mockTrack, 'user-2:microphone', 0);
    expect(localStorageSetSpy).toHaveBeenCalledWith('voiceUserVolume:user-2', '0');
  });

  it('does not change any volumes on unmount (boost must outlive the menu)', () => {
    const { unmount } = renderMenu();

    fireEvent.change(screen.getByRole('slider'), { target: { value: 150 } });

    vi.mocked(audioBoostManager.applyVolume).mockClear();
    vi.mocked(audioBoostManager.removeEntry).mockClear();
    mockTrack.setVolume.mockClear();

    unmount();

    expect(audioBoostManager.applyVolume).not.toHaveBeenCalled();
    expect(audioBoostManager.removeEntry).not.toHaveBeenCalled();
    expect(audioBoostManager.reset).not.toHaveBeenCalled();
    expect(mockTrack.setVolume).not.toHaveBeenCalled();
  });

  it('does not apply stored volume on mount (the persistent volume hook owns that)', () => {
    localStorageGetSpy.mockReturnValue('1.5');

    renderMenu();

    expect(audioBoostManager.applyVolume).not.toHaveBeenCalled();
  });
});
