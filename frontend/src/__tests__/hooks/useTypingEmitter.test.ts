import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { QueryClient } from '@tanstack/react-query';
import { ClientEvents } from '@kraken/shared';
import { useTypingEmitter } from '../../hooks/useTypingEmitter';
import { createTestWrapper } from '../test-utils/wrappers';
import { createMockSocket } from '../test-utils/mockSocket';
import type { MockSocket } from '../test-utils/mockSocket';

describe('useTypingEmitter', () => {
  let queryClient: QueryClient;
  let mockSocket: MockSocket;

  beforeEach(() => {
    vi.useFakeTimers();
    queryClient = new QueryClient();
    mockSocket = createMockSocket();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function renderEmitter(options: { channelId?: string; directMessageGroupId?: string }) {
    return renderHook(() => useTypingEmitter(options), {
      wrapper: createTestWrapper({ queryClient, socket: mockSocket }),
    });
  }

  describe('handleKeyPress', () => {
    it('emits TYPING_START on first keypress', () => {
      const { result } = renderEmitter({ channelId: 'ch-1' });

      act(() => result.current.handleKeyPress());

      expect(mockSocket.emit).toHaveBeenCalledWith(
        ClientEvents.TYPING_START,
        { channelId: 'ch-1' },
      );
    });

    it('does not re-emit TYPING_START within the debounce window', () => {
      const { result } = renderEmitter({ channelId: 'ch-1' });

      act(() => result.current.handleKeyPress());
      mockSocket.emit.mockClear();

      // Keypress within 3s debounce
      act(() => {
        vi.advanceTimersByTime(1000);
        result.current.handleKeyPress();
      });

      expect(mockSocket.emit).not.toHaveBeenCalledWith(
        ClientEvents.TYPING_START,
        expect.anything(),
      );
    });

    it('re-emits TYPING_START after the debounce window expires', () => {
      const { result } = renderEmitter({ channelId: 'ch-1' });

      act(() => result.current.handleKeyPress());
      mockSocket.emit.mockClear();

      act(() => {
        vi.advanceTimersByTime(3001);
        result.current.handleKeyPress();
      });

      expect(mockSocket.emit).toHaveBeenCalledWith(
        ClientEvents.TYPING_START,
        { channelId: 'ch-1' },
      );
    });

    it('sends TYPING_STOP after idle timeout', () => {
      const { result } = renderEmitter({ channelId: 'ch-1' });

      act(() => result.current.handleKeyPress());
      mockSocket.emit.mockClear();

      act(() => {
        vi.advanceTimersByTime(5000);
      });

      expect(mockSocket.emit).toHaveBeenCalledWith(
        ClientEvents.TYPING_STOP,
        { channelId: 'ch-1' },
      );
    });

    it('resets the idle timer on subsequent keypresses', () => {
      const { result } = renderEmitter({ channelId: 'ch-1' });

      act(() => result.current.handleKeyPress());
      mockSocket.emit.mockClear();

      // Type at 2s, resetting the idle timer
      act(() => {
        vi.advanceTimersByTime(2000);
        result.current.handleKeyPress();
      });

      // At 5s from start (3s after last keypress) — should NOT have sent stop yet
      act(() => {
        vi.advanceTimersByTime(3000);
      });
      expect(mockSocket.emit).not.toHaveBeenCalledWith(
        ClientEvents.TYPING_STOP,
        expect.anything(),
      );

      // At 7s from start (5s after last keypress) — should send stop
      act(() => {
        vi.advanceTimersByTime(2000);
      });
      expect(mockSocket.emit).toHaveBeenCalledWith(
        ClientEvents.TYPING_STOP,
        { channelId: 'ch-1' },
      );
    });
  });

  describe('sendTypingStop', () => {
    it('sends TYPING_STOP immediately when called', () => {
      const { result } = renderEmitter({ channelId: 'ch-1' });

      act(() => result.current.handleKeyPress());
      mockSocket.emit.mockClear();

      act(() => result.current.sendTypingStop());

      expect(mockSocket.emit).toHaveBeenCalledWith(
        ClientEvents.TYPING_STOP,
        { channelId: 'ch-1' },
      );
    });

    it('does not send TYPING_STOP if not currently typing', () => {
      const { result } = renderEmitter({ channelId: 'ch-1' });

      act(() => result.current.sendTypingStop());

      expect(mockSocket.emit).not.toHaveBeenCalledWith(
        ClientEvents.TYPING_STOP,
        expect.anything(),
      );
    });
  });

  describe('DM context', () => {
    it('emits with directMessageGroupId payload', () => {
      const { result } = renderEmitter({ directMessageGroupId: 'dm-1' });

      act(() => result.current.handleKeyPress());

      expect(mockSocket.emit).toHaveBeenCalledWith(
        ClientEvents.TYPING_START,
        { directMessageGroupId: 'dm-1' },
      );
    });
  });

  describe('no context', () => {
    it('does not emit when neither channelId nor directMessageGroupId is provided', () => {
      const { result } = renderEmitter({});

      act(() => result.current.handleKeyPress());

      expect(mockSocket.emit).not.toHaveBeenCalled();
    });
  });

  describe('cleanup on unmount', () => {
    it('sends TYPING_STOP on unmount if currently typing', () => {
      const { result, unmount } = renderEmitter({ channelId: 'ch-1' });

      act(() => result.current.handleKeyPress());
      mockSocket.emit.mockClear();

      unmount();

      expect(mockSocket.emit).toHaveBeenCalledWith(
        ClientEvents.TYPING_STOP,
        { channelId: 'ch-1' },
      );
    });

    it('does not send TYPING_STOP on unmount if not typing', () => {
      const { unmount } = renderEmitter({ channelId: 'ch-1' });

      unmount();

      expect(mockSocket.emit).not.toHaveBeenCalledWith(
        ClientEvents.TYPING_STOP,
        expect.anything(),
      );
    });
  });
});
