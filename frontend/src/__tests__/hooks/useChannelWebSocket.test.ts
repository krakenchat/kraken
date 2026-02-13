import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { InfiniteData } from '@tanstack/react-query';
import type { PaginatedMessagesResponseDto } from '../../api-client/types.gen';

// Mock the generated client
vi.mock('../../api-client/client.gen', () => ({
  client: {
    getConfig: () => ({ baseUrl: 'http://localhost:3000' }),
  },
}));

import { useChannelWebSocket } from '../../hooks/useChannelWebSocket';
import { channelMessagesQueryKey } from '../../utils/messageQueryKeys';
import { setMessageContext, clearContextIndex } from '../../utils/messageIndex';
import {
  createTestQueryClient,
  createMockSocket,
  createTestWrapper,
  createMessage,
  createEnrichedMessage,
  createInfiniteData,
  createReaction,
} from '../test-utils';
import type { MockSocket } from '../test-utils';

let queryClient: ReturnType<typeof createTestQueryClient>;
let mockSocket: MockSocket;

beforeEach(() => {
  queryClient = createTestQueryClient();
  mockSocket = createMockSocket();
  clearContextIndex('channel-1');
  clearContextIndex('channel-2');
});

function renderChannelWebSocket(communityId = 'community-1') {
  return renderHook(() => useChannelWebSocket(communityId), {
    wrapper: createTestWrapper({ queryClient, socket: mockSocket }),
  });
}

describe('useChannelWebSocket', () => {
  it('registers event handlers on mount', () => {
    renderChannelWebSocket();
    expect(mockSocket.on).toHaveBeenCalledWith('newMessage', expect.any(Function));
    expect(mockSocket.on).toHaveBeenCalledWith('updateMessage', expect.any(Function));
    expect(mockSocket.on).toHaveBeenCalledWith('deleteMessage', expect.any(Function));
    expect(mockSocket.on).toHaveBeenCalledWith('reactionAdded', expect.any(Function));
    expect(mockSocket.on).toHaveBeenCalledWith('reactionRemoved', expect.any(Function));
    expect(mockSocket.on).toHaveBeenCalledWith('messagePinned', expect.any(Function));
    expect(mockSocket.on).toHaveBeenCalledWith('messageUnpinned', expect.any(Function));
    expect(mockSocket.on).toHaveBeenCalledWith('threadReplyCountUpdated', expect.any(Function));
    expect(mockSocket.on).toHaveBeenCalledWith('readReceiptUpdated', expect.any(Function));
    expect(mockSocket.on).toHaveBeenCalledWith('connect', expect.any(Function));
  });

  it('unregisters event handlers on unmount', () => {
    const { unmount } = renderChannelWebSocket();
    unmount();
    expect(mockSocket.off).toHaveBeenCalledWith('newMessage', expect.any(Function));
    expect(mockSocket.off).toHaveBeenCalledWith('updateMessage', expect.any(Function));
    expect(mockSocket.off).toHaveBeenCalledWith('deleteMessage', expect.any(Function));
    expect(mockSocket.off).toHaveBeenCalledWith('connect', expect.any(Function));
  });

  describe('NEW_MESSAGE', () => {
    it('prepends a new message to the channel cache', async () => {
      const key = channelMessagesQueryKey('channel-1');
      const existingMsg = createEnrichedMessage({ id: 'existing', channelId: 'channel-1' });
      queryClient.setQueryData(key, createInfiniteData([existingMsg]));

      renderChannelWebSocket();

      const newMsg = createMessage({ id: 'new-msg', channelId: 'channel-1' });
      await act(() => mockSocket.simulateEvent('newMessage', { message: newMsg }));

      const data = queryClient.getQueryData(key) as InfiniteData<PaginatedMessagesResponseDto>;
      expect(data.pages[0].messages).toHaveLength(2);
      expect(data.pages[0].messages[0]).toMatchObject({ id: 'new-msg' });
    });

    it('skips message with no contextId', async () => {
      renderChannelWebSocket();

      const msg = createMessage({ id: 'no-ctx', channelId: undefined, directMessageGroupId: undefined });
      await act(() => mockSocket.simulateEvent('newMessage', { message: msg }));
      // No throw, no change
    });
  });

  describe('UPDATE_MESSAGE', () => {
    it('updates an existing message in cache', async () => {
      const key = channelMessagesQueryKey('channel-1');
      queryClient.setQueryData(key, createInfiniteData([
        createEnrichedMessage({ id: 'msg-1', channelId: 'channel-1', authorId: 'old' }),
      ]));

      renderChannelWebSocket();

      const updated = createMessage({ id: 'msg-1', channelId: 'channel-1', authorId: 'new' });
      await act(() => mockSocket.simulateEvent('updateMessage', { message: updated }));

      const data = queryClient.getQueryData(key) as InfiniteData<PaginatedMessagesResponseDto>;
      expect(data.pages[0].messages[0]).toMatchObject({ authorId: 'new' });
    });
  });

  describe('DELETE_MESSAGE', () => {
    it('removes a message from cache', async () => {
      const key = channelMessagesQueryKey('channel-1');
      queryClient.setQueryData(key, createInfiniteData([
        createEnrichedMessage({ id: 'keep', channelId: 'channel-1' }),
        createEnrichedMessage({ id: 'remove', channelId: 'channel-1' }),
      ]));

      renderChannelWebSocket();

      await act(() =>
        mockSocket.simulateEvent('deleteMessage', {
          messageId: 'remove',
          channelId: 'channel-1',
          directMessageGroupId: null,
        }),
      );

      const data = queryClient.getQueryData(key) as InfiniteData<PaginatedMessagesResponseDto>;
      expect(data.pages[0].messages).toHaveLength(1);
      expect(data.pages[0].messages[0]).toMatchObject({ id: 'keep' });
    });
  });

  describe('REACTION_ADDED', () => {
    it('adds a new reaction to a message', async () => {
      const msg = createEnrichedMessage({ id: 'msg-1', channelId: 'channel-1', reactions: [] });
      const key = channelMessagesQueryKey('channel-1');
      queryClient.setQueryData(key, createInfiniteData([msg]));
      setMessageContext('msg-1', 'channel-1');

      renderChannelWebSocket();

      const reaction = createReaction({ emoji: '🎉', userIds: ['user-2'] });
      await act(() =>
        mockSocket.simulateEvent('reactionAdded', { messageId: 'msg-1', reaction }),
      );

      const data = queryClient.getQueryData(key) as InfiniteData<PaginatedMessagesResponseDto>;
      const updatedMsg = data.pages[0].messages[0];
      expect(updatedMsg.reactions).toHaveLength(1);
      expect(updatedMsg.reactions[0]).toMatchObject({ emoji: '🎉' });
    });

    it('updates an existing reaction (same emoji)', async () => {
      const existingReaction = createReaction({ emoji: '👍', userIds: ['user-1'] });
      const msg = createEnrichedMessage({ id: 'msg-1', channelId: 'channel-1', reactions: [existingReaction] });
      const key = channelMessagesQueryKey('channel-1');
      queryClient.setQueryData(key, createInfiniteData([msg]));
      setMessageContext('msg-1', 'channel-1');

      renderChannelWebSocket();

      const updatedReaction = createReaction({ emoji: '👍', userIds: ['user-1', 'user-2'] });
      await act(() =>
        mockSocket.simulateEvent('reactionAdded', { messageId: 'msg-1', reaction: updatedReaction }),
      );

      const data = queryClient.getQueryData(key) as InfiniteData<PaginatedMessagesResponseDto>;
      expect(data.pages[0].messages[0].reactions).toHaveLength(1);
      expect(data.pages[0].messages[0].reactions[0].userIds).toEqual(['user-1', 'user-2']);
    });

    it('skips when message context is unknown', async () => {
      renderChannelWebSocket();
      // Don't call setMessageContext - no context for this messageId
      const reaction = createReaction();
      await act(() =>
        mockSocket.simulateEvent('reactionAdded', { messageId: 'unknown', reaction }),
      );
      // Should not throw
    });
  });

  describe('REACTION_REMOVED', () => {
    it('replaces reactions on the message', async () => {
      const msg = createEnrichedMessage({
        id: 'msg-1',
        channelId: 'channel-1',
        reactions: [createReaction({ emoji: '👍' }), createReaction({ emoji: '🎉' })],
      });
      const key = channelMessagesQueryKey('channel-1');
      queryClient.setQueryData(key, createInfiniteData([msg]));
      setMessageContext('msg-1', 'channel-1');

      renderChannelWebSocket();

      // After removal, only one reaction remains
      const remaining = [createReaction({ emoji: '🎉' })];
      await act(() =>
        mockSocket.simulateEvent('reactionRemoved', {
          messageId: 'msg-1',
          emoji: '👍',
          reactions: remaining,
        }),
      );

      const data = queryClient.getQueryData(key) as InfiniteData<PaginatedMessagesResponseDto>;
      expect(data.pages[0].messages[0].reactions).toHaveLength(1);
      expect(data.pages[0].messages[0].reactions[0]).toMatchObject({ emoji: '🎉' });
    });
  });

  describe('MESSAGE_PINNED', () => {
    it('sets pinned fields on the message', async () => {
      const msg = createEnrichedMessage({ id: 'msg-1', channelId: 'channel-1', pinned: false });
      const key = channelMessagesQueryKey('channel-1');
      queryClient.setQueryData(key, createInfiniteData([msg]));

      renderChannelWebSocket();

      await act(() =>
        mockSocket.simulateEvent('messagePinned', {
          messageId: 'msg-1',
          channelId: 'channel-1',
          pinnedBy: 'admin-1',
          pinnedAt: '2025-01-01T00:00:00Z',
        }),
      );

      const data = queryClient.getQueryData(key) as InfiniteData<PaginatedMessagesResponseDto>;
      const updated = data.pages[0].messages[0];
      expect(updated.pinned).toBe(true);
      expect(updated.pinnedBy).toBe('admin-1');
      expect(updated.pinnedAt).toBe('2025-01-01T00:00:00Z');
    });
  });

  describe('MESSAGE_UNPINNED', () => {
    it('clears pinned fields on the message', async () => {
      const msg = createEnrichedMessage({
        id: 'msg-1',
        channelId: 'channel-1',
        pinned: true,
        pinnedBy: 'admin-1',
        pinnedAt: '2025-01-01T00:00:00Z',
      });
      const key = channelMessagesQueryKey('channel-1');
      queryClient.setQueryData(key, createInfiniteData([msg]));

      renderChannelWebSocket();

      await act(() =>
        mockSocket.simulateEvent('messageUnpinned', {
          messageId: 'msg-1',
          channelId: 'channel-1',
          unpinnedBy: 'admin-1',
        }),
      );

      const data = queryClient.getQueryData(key) as InfiniteData<PaginatedMessagesResponseDto>;
      const updated = data.pages[0].messages[0];
      expect(updated.pinned).toBe(false);
      expect(updated.pinnedBy).toBeNull();
      expect(updated.pinnedAt).toBeNull();
    });
  });

  describe('THREAD_REPLY_COUNT_UPDATED', () => {
    it('updates replyCount and lastReplyAt on the parent message', async () => {
      const msg = createEnrichedMessage({
        id: 'parent-1',
        channelId: 'channel-1',
        replyCount: 0,
        lastReplyAt: undefined,
      });
      const key = channelMessagesQueryKey('channel-1');
      queryClient.setQueryData(key, createInfiniteData([msg]));
      setMessageContext('parent-1', 'channel-1');

      renderChannelWebSocket();

      await act(() =>
        mockSocket.simulateEvent('threadReplyCountUpdated', {
          parentMessageId: 'parent-1',
          replyCount: 5,
          lastReplyAt: '2025-01-02T12:00:00Z',
        }),
      );

      const data = queryClient.getQueryData(key) as InfiniteData<PaginatedMessagesResponseDto>;
      const updated = data.pages[0].messages[0];
      expect(updated.replyCount).toBe(5);
      expect(updated.lastReplyAt).toBe('2025-01-02T12:00:00Z');
    });
  });

  describe('connect (reconnect)', () => {
    it('invalidates channel message queries on reconnect', async () => {
      const key = channelMessagesQueryKey('channel-1');
      queryClient.setQueryData(key, createInfiniteData([createEnrichedMessage({ id: 'msg-1', channelId: 'channel-1' })]));

      renderChannelWebSocket();

      await act(() => mockSocket.simulateEvent('connect'));

      const query = queryClient.getQueryCache().find({ queryKey: key });
      expect(query?.isStale()).toBe(true);
    });
  });

  describe('sendMessage', () => {
    it('emits SEND_MESSAGE via socket', () => {
      const { result } = renderChannelWebSocket();

      const msg = createMessage({ channelId: 'channel-1' });
      const { id: _id, ...msgWithoutId } = msg;
      result.current.sendMessage(msgWithoutId);

      expect(mockSocket.emit).toHaveBeenCalledWith('sendMessage', msgWithoutId);
    });
  });
});
