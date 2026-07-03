import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';

// --- Mutable mock state -----------------------------------------------------

let mockRoom: { localParticipant: { setMicrophoneEnabled: ReturnType<typeof vi.fn> } } | null =
  null;

let mockVoiceState: {
  isConnected: boolean;
  isServerMuted: boolean;
  isDeafened: boolean;
};

let mockVoiceSettings: {
  inputMode: 'voice_activity' | 'push_to_talk';
  pushToTalkKey: string;
  pushToTalkKeyDisplay: string;
  isPushToTalk: boolean;
};

const setMockInputMode = (mode: 'voice_activity' | 'push_to_talk') => {
  mockVoiceSettings = {
    ...mockVoiceSettings,
    inputMode: mode,
    isPushToTalk: mode === 'push_to_talk',
  };
};

vi.mock('../../hooks/useRoom', () => ({
  useRoom: vi.fn(() => ({ getRoom: () => mockRoom })),
}));

vi.mock('../../contexts/VoiceContext', () => ({
  useVoice: vi.fn(() => mockVoiceState),
  // usePushToTalk also reads live state via useVoiceDispatch's stateRef
  // (the #380 server-mute keydown guard); expose the same mock state there.
  useVoiceDispatch: vi.fn(() => ({
    dispatch: vi.fn(),
    stateRef: {
      get current() {
        return mockVoiceState;
      },
    },
  })),
}));

vi.mock('../../hooks/useVoiceSettings', () => ({
  useVoiceSettings: vi.fn(() => mockVoiceSettings),
}));

vi.mock('../../utils/logger', () => ({
  logger: { dev: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { usePushToTalk } from '../../hooks/usePushToTalk';

// --- Tests -------------------------------------------------------------------

describe('usePushToTalk input mode transitions (#381)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRoom = {
      localParticipant: {
        setMicrophoneEnabled: vi.fn().mockResolvedValue(undefined),
      },
    };
    mockVoiceState = {
      isConnected: true,
      isServerMuted: false,
      isDeafened: false,
    };
    mockVoiceSettings = {
      inputMode: 'push_to_talk',
      pushToTalkKey: 'Backquote',
      pushToTalkKeyDisplay: '`',
      isPushToTalk: true,
    };
  });

  describe('PTT -> voice activity', () => {
    it('unmutes the mic when switching to voice activity while connected', () => {
      const { rerender } = renderHook(() => usePushToTalk());

      setMockInputMode('voice_activity');
      rerender();

      expect(mockRoom!.localParticipant.setMicrophoneEnabled).toHaveBeenCalledTimes(1);
      expect(mockRoom!.localParticipant.setMicrophoneEnabled).toHaveBeenCalledWith(true);
    });

    it('does NOT unmute when server-muted', () => {
      mockVoiceState.isServerMuted = true;
      const { rerender } = renderHook(() => usePushToTalk());

      setMockInputMode('voice_activity');
      rerender();

      expect(mockRoom!.localParticipant.setMicrophoneEnabled).not.toHaveBeenCalled();
    });

    it('does NOT unmute when deafened', () => {
      mockVoiceState.isDeafened = true;
      const { rerender } = renderHook(() => usePushToTalk());

      setMockInputMode('voice_activity');
      rerender();

      expect(mockRoom!.localParticipant.setMicrophoneEnabled).not.toHaveBeenCalled();
    });

    it('does nothing when not connected to voice', () => {
      mockVoiceState.isConnected = false;
      const { rerender } = renderHook(() => usePushToTalk());

      setMockInputMode('voice_activity');
      rerender();

      expect(mockRoom!.localParticipant.setMicrophoneEnabled).not.toHaveBeenCalled();
    });
  });

  describe('voice activity -> PTT', () => {
    beforeEach(() => {
      setMockInputMode('voice_activity');
    });

    it('mutes the mic so it rests muted until the key is held', () => {
      const { rerender } = renderHook(() => usePushToTalk());

      setMockInputMode('push_to_talk');
      rerender();

      expect(mockRoom!.localParticipant.setMicrophoneEnabled).toHaveBeenCalledTimes(1);
      expect(mockRoom!.localParticipant.setMicrophoneEnabled).toHaveBeenCalledWith(false);
    });

    it('does nothing when not connected to voice', () => {
      mockVoiceState.isConnected = false;
      const { rerender } = renderHook(() => usePushToTalk());

      setMockInputMode('push_to_talk');
      rerender();

      expect(mockRoom!.localParticipant.setMicrophoneEnabled).not.toHaveBeenCalled();
    });
  });

  describe('no spurious mic changes', () => {
    it('does not touch the mic on initial mount (no transition)', () => {
      renderHook(() => usePushToTalk());

      expect(mockRoom!.localParticipant.setMicrophoneEnabled).not.toHaveBeenCalled();
    });

    it('does not touch the mic when re-rendering without a mode change', () => {
      const { rerender } = renderHook(() => usePushToTalk());

      mockVoiceState = { ...mockVoiceState, isServerMuted: true };
      rerender();
      mockVoiceState = { ...mockVoiceState, isServerMuted: false };
      rerender();

      expect(mockRoom!.localParticipant.setMicrophoneEnabled).not.toHaveBeenCalled();
    });
  });
});
