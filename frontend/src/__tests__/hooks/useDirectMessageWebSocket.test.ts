import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { PaginatedMessagesResponseDto } from '../../api-client/types.gen';

// Mock the generated client
vi.mock('../../api-client/client.gen', () => ({
  client: {
    getConfig: () => ({ baseUrl: 'http://localhost:3000' }),
  },
}));

import { useDirectMessageWebSocket } from '../../hooks/useDirectMessageWebSocket';
import { dmMessagesQueryKey } from '../../utils/messageQueryKeys';
import { setMessageContext, clearContextIndex } from '../../utils/messageIndex';
import {
  createTestQueryClient,
  createMockSocket,
  createTestWrapper,
  createMessage,
  createFlatData,
  createReaction,
} from '../test-utils';
import type { MockSocket } from '../test-utils';

let queryClient: ReturnType<typeof createTestQueryClient>;
let mockSocket: MockSocket;

beforeEach(() => {
  queryClient = createTestQueryClient();
  mockSocket = createMockSocket();
  clearContextIndex('dm-1');
  clearContextIndex('dm-2');
});

function renderDmWebSocket() {
  return renderHook(() => useDirectMessageWebSocket(), {
    wrapper: createTestWrapper({ queryClient, socket: mockSocket }),
  });
}

describe('useDirectMessageWebSocket', () => {
  it('registers event handlers on mount', () => {
    renderDmWebSocket();
    expect(mockSocket.on).toHaveBeenCalledWith('newDirectMessage', expect.any(Function));
    expect(mockSocket.on).toHaveBeenCalledWith('updateMessage', expect.any(Function));
    expect(mockSocket.on).toHaveBeenCalledWith('deleteMessage', expect.any(Function));
    expect(mockSocket.on).toHaveBeenCalledWith('reactionAdded', expect.any(Function));
    expect(mockSocket.on).toHaveBeenCalledWith('reactionRemoved', expect.any(Function));
    expect(mockSocket.on).toHaveBeenCalledWith('connect', expect.any(Function));
  });

  it('unregisters event handlers on unmount', () => {
    const { unmount } = renderDmWebSocket();
    unmount();
    expect(mockSocket.off).toHaveBeenCalledWith('newDirectMessage', expect.any(Function));
    expect(mockSocket.off).toHaveBeenCalledWith('updateMessage', expect.any(Function));
    expect(mockSocket.off).toHaveBeenCalledWith('deleteMessage', expect.any(Function));
    expect(mockSocket.off).toHaveBeenCalledWith('connect', expect.any(Function));
  });

  describe('NEW_DM', () => {
    it('prepends a new DM to the cache', async () => {
      const key = dmMessagesQueryKey('dm-1');
      queryClient.setQueryData(key, createFlatData([
        createMessage({ id: 'existing', directMessageGroupId: 'dm-1' }),
      ]));

      renderDmWebSocket();

      const newMsg = createMessage({ id: 'new-dm', directMessageGroupId: 'dm-1' });
      await act(() =>
        mockSocket.simulateEvent('newDirectMessage', { message: newMsg }),
      );

      const data = queryClient.getQueryData(key) as PaginatedMessagesResponseDto;
      expect(data.messages).toHaveLength(2);
      expect(data.messages[0]).toMatchObject({ id: 'new-dm' });
    });

    it('cancels in-flight queries before updating cache', async () => {
      const key = dmMessagesQueryKey('dm-1');
      queryClient.setQueryData(key, createFlatData([
        createMessage({ id: 'existing', directMessageGroupId: 'dm-1' }),
      ]));
      const spy = vi.spyOn(queryClient, 'cancelQueries');

      renderDmWebSocket();

      const newMsg = createMessage({ id: 'new-dm', directMessageGroupId: 'dm-1' });
      await act(() =>
        mockSocket.simulateEvent('newDirectMessage', { message: newMsg }),
      );

      expect(spy).toHaveBeenCalledWith({ queryKey: key });
    });

    it('skips message with no directMessageGroupId', async () => {
      renderDmWebSocket();

      const msg = createMessage({ id: 'no-dm-group', directMessageGroupId: undefined });
      await act(() =>
        mockSocket.simulateEvent('newDirectMessage', { message: msg }),
      );
      // Should not throw
    });
  });

  describe('UPDATE_MESSAGE', () => {
    it('updates a DM in cache', async () => {
      const key = dmMessagesQueryKey('dm-1');
      queryClient.setQueryData(key, createFlatData([
        createMessage({ id: 'dm-1-msg', directMessageGroupId: 'dm-1', authorId: 'old' }),
      ]));

      renderDmWebSocket();

      const updated = createMessage({ id: 'dm-1-msg', directMessageGroupId: 'dm-1', authorId: 'new' });
      await act(() =>
        mockSocket.simulateEvent('updateMessage', { message: updated }),
      );

      const data = queryClient.getQueryData(key) as PaginatedMessagesResponseDto;
      expect(data.messages[0]).toMatchObject({ authorId: 'new' });
    });

    it('cancels in-flight queries before updating cache', async () => {
      const key = dmMessagesQueryKey('dm-1');
      queryClient.setQueryData(key, createFlatData([
        createMessage({ id: 'dm-1-msg', directMessageGroupId: 'dm-1' }),
      ]));
      const spy = vi.spyOn(queryClient, 'cancelQueries');

      renderDmWebSocket();

      const updated = createMessage({ id: 'dm-1-msg', directMessageGroupId: 'dm-1', authorId: 'new' });
      await act(() =>
        mockSocket.simulateEvent('updateMessage', { message: updated }),
      );

      expect(spy).toHaveBeenCalledWith({ queryKey: key });
    });
  });

  describe('DELETE_MESSAGE', () => {
    it('removes a DM from cache', async () => {
      const key = dmMessagesQueryKey('dm-1');
      queryClient.setQueryData(key, createFlatData([
        createMessage({ id: 'keep', directMessageGroupId: 'dm-1' }),
        createMessage({ id: 'remove', directMessageGroupId: 'dm-1' }),
      ]));

      renderDmWebSocket();

      await act(() =>
        mockSocket.simulateEvent('deleteMessage', {
          messageId: 'remove',
          channelId: null,
          directMessageGroupId: 'dm-1',
        }),
      );

      const data = queryClient.getQueryData(key) as PaginatedMessagesResponseDto;
      expect(data.messages).toHaveLength(1);
      expect(data.messages[0]).toMatchObject({ id: 'keep' });
    });

    it('cancels in-flight queries before updating cache', async () => {
      const key = dmMessagesQueryKey('dm-1');
      queryClient.setQueryData(key, createFlatData([
        createMessage({ id: 'msg', directMessageGroupId: 'dm-1' }),
      ]));
      const spy = vi.spyOn(queryClient, 'cancelQueries');

      renderDmWebSocket();

      await act(() =>
        mockSocket.simulateEvent('deleteMessage', {
          messageId: 'msg',
          channelId: null,
          directMessageGroupId: 'dm-1',
        }),
      );

      expect(spy).toHaveBeenCalledWith({ queryKey: key });
    });
  });

  describe('REACTION_ADDED', () => {
    it('adds a reaction to a DM message', async () => {
      const msg = createMessage({ id: 'dm-msg', directMessageGroupId: 'dm-1', reactions: [] });
      const key = dmMessagesQueryKey('dm-1');
      queryClient.setQueryData(key, createFlatData([msg]));
      setMessageContext('dm-msg', 'dm-1');

      renderDmWebSocket();

      const reaction = createReaction({ emoji: '❤️', userIds: ['user-2'] });
      await act(() =>
        mockSocket.simulateEvent('reactionAdded', { messageId: 'dm-msg', reaction }),
      );

      const data = queryClient.getQueryData(key) as PaginatedMessagesResponseDto;
      expect(data.messages[0].reactions).toHaveLength(1);
      expect(data.messages[0].reactions[0]).toMatchObject({ emoji: '❤️' });
    });
  });

  describe('REACTION_REMOVED', () => {
    it('replaces reactions on a DM message', async () => {
      const msg = createMessage({
        id: 'dm-msg',
        directMessageGroupId: 'dm-1',
        reactions: [createReaction({ emoji: '👍' }), createReaction({ emoji: '🎉' })],
      });
      const key = dmMessagesQueryKey('dm-1');
      queryClient.setQueryData(key, createFlatData([msg]));
      setMessageContext('dm-msg', 'dm-1');

      renderDmWebSocket();

      await act(() =>
        mockSocket.simulateEvent('reactionRemoved', {
          messageId: 'dm-msg',
          emoji: '👍',
          reactions: [createReaction({ emoji: '🎉' })],
        }),
      );

      const data = queryClient.getQueryData(key) as PaginatedMessagesResponseDto;
      expect(data.messages[0].reactions).toHaveLength(1);
      expect(data.messages[0].reactions[0]).toMatchObject({ emoji: '🎉' });
    });
  });

  describe('connect (reconnect)', () => {
    it('invalidates DM message queries on reconnect', async () => {
      const key = dmMessagesQueryKey('dm-1');
      queryClient.setQueryData(key, createFlatData([
        createMessage({ id: 'dm-msg', directMessageGroupId: 'dm-1' }),
      ]));

      renderDmWebSocket();

      await act(() => mockSocket.simulateEvent('connect'));

      const query = queryClient.getQueryCache().find({ queryKey: key });
      expect(query?.isStale()).toBe(true);
    });
  });

  describe('joinDmGroup / leaveDmGroup', () => {
    it('joinDmGroup emits JOIN_DM_ROOM', () => {
      const { result } = renderDmWebSocket();
      result.current.joinDmGroup('dm-123');
      expect(mockSocket.emit).toHaveBeenCalledWith('joinDmRoom', 'dm-123');
    });

    it('leaveDmGroup emits LEAVE_ROOM', () => {
      const { result } = renderDmWebSocket();
      result.current.leaveDmGroup('dm-123');
      expect(mockSocket.emit).toHaveBeenCalledWith('leaveRoom', 'dm-123');
    });
  });
});
