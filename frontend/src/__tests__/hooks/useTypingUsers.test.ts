import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { QueryClient } from '@tanstack/react-query';
import { ServerEvents } from '@kraken/shared';
import { useTypingUsers } from '../../hooks/useTypingUsers';
import { createTestHubWrapper } from '../test-utils/wrappers';
import { createEventBus } from '../../socket-hub/emitter';
import type { EventBus } from '../../socket-hub/emitter';

describe('useTypingUsers', () => {
  let queryClient: QueryClient;
  let eventBus: EventBus;

  beforeEach(() => {
    vi.useFakeTimers();
    queryClient = new QueryClient();
    eventBus = createEventBus();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function renderTypingUsers(options: {
    channelId?: string;
    directMessageGroupId?: string;
    currentUserId?: string;
  }) {
    return renderHook(() => useTypingUsers(options), {
      wrapper: createTestHubWrapper({ queryClient, eventBus }),
    });
  }

  function emitTyping(payload: {
    userId: string;
    channelId?: string;
    directMessageGroupId?: string;
    isTyping: boolean;
  }) {
    act(() => {
      eventBus.emit(ServerEvents.USER_TYPING, payload as never);
    });
  }

  describe('adding typing users', () => {
    it('adds a user when they start typing in the same channel', () => {
      const { result } = renderTypingUsers({
        channelId: 'ch-1',
        currentUserId: 'me',
      });

      emitTyping({ userId: 'user-2', channelId: 'ch-1', isTyping: true });

      expect(result.current).toContain('user-2');
    });

    it('tracks multiple users typing simultaneously', () => {
      const { result } = renderTypingUsers({
        channelId: 'ch-1',
        currentUserId: 'me',
      });

      emitTyping({ userId: 'user-2', channelId: 'ch-1', isTyping: true });
      emitTyping({ userId: 'user-3', channelId: 'ch-1', isTyping: true });

      expect(result.current).toContain('user-2');
      expect(result.current).toContain('user-3');
    });
  });

  describe('removing typing users', () => {
    it('removes a user when they stop typing', () => {
      const { result } = renderTypingUsers({
        channelId: 'ch-1',
        currentUserId: 'me',
      });

      emitTyping({ userId: 'user-2', channelId: 'ch-1', isTyping: true });
      emitTyping({ userId: 'user-2', channelId: 'ch-1', isTyping: false });

      expect(result.current).not.toContain('user-2');
    });

    it('auto-clears a user after the timeout (8s safety net)', () => {
      const { result } = renderTypingUsers({
        channelId: 'ch-1',
        currentUserId: 'me',
      });

      emitTyping({ userId: 'user-2', channelId: 'ch-1', isTyping: true });
      expect(result.current).toContain('user-2');

      act(() => {
        vi.advanceTimersByTime(8000);
      });

      expect(result.current).not.toContain('user-2');
    });
  });

  describe('context filtering', () => {
    it('ignores typing events from a different channel', () => {
      const { result } = renderTypingUsers({
        channelId: 'ch-1',
        currentUserId: 'me',
      });

      emitTyping({ userId: 'user-2', channelId: 'ch-other', isTyping: true });

      expect(result.current).toHaveLength(0);
    });

    it('ignores typing events from a DM when watching a channel', () => {
      const { result } = renderTypingUsers({
        channelId: 'ch-1',
        currentUserId: 'me',
      });

      emitTyping({
        userId: 'user-2',
        directMessageGroupId: 'dm-1',
        isTyping: true,
      });

      expect(result.current).toHaveLength(0);
    });

    it('tracks DM typing events when watching a DM group', () => {
      const { result } = renderTypingUsers({
        directMessageGroupId: 'dm-1',
        currentUserId: 'me',
      });

      emitTyping({
        userId: 'user-2',
        directMessageGroupId: 'dm-1',
        isTyping: true,
      });

      expect(result.current).toContain('user-2');
    });
  });

  describe('self-filtering', () => {
    it('ignores the current user typing events', () => {
      const { result } = renderTypingUsers({
        channelId: 'ch-1',
        currentUserId: 'me',
      });

      emitTyping({ userId: 'me', channelId: 'ch-1', isTyping: true });

      expect(result.current).toHaveLength(0);
    });
  });

  describe('timer management', () => {
    it('resets the timeout when the same user sends another typing start', () => {
      const { result } = renderTypingUsers({
        channelId: 'ch-1',
        currentUserId: 'me',
      });

      emitTyping({ userId: 'user-2', channelId: 'ch-1', isTyping: true });

      // Advance 6s (should still be present)
      act(() => vi.advanceTimersByTime(6000));
      expect(result.current).toContain('user-2');

      // Re-emit typing start, resetting the timer
      emitTyping({ userId: 'user-2', channelId: 'ch-1', isTyping: true });

      // Advance another 6s (2s past original timeout, but timer was reset)
      act(() => vi.advanceTimersByTime(6000));
      expect(result.current).toContain('user-2');

      // Advance past the new timeout
      act(() => vi.advanceTimersByTime(2000));
      expect(result.current).not.toContain('user-2');
    });
  });
});
