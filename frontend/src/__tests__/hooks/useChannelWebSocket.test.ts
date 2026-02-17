import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { InfiniteData } from '@tanstack/react-query';
import type { PaginatedMessagesResponseDto, UnreadCountDto } from '../../api-client/types.gen';

// Mock the generated client
vi.mock('../../api-client/client.gen', () => ({
  client: {
    getConfig: () => ({ baseUrl: 'http://localhost:3000' }),
  },
}));

import { useChannelWebSocket } from '../../hooks/useChannelWebSocket';
import { channelMessagesQueryKey } from '../../utils/messageQueryKeys';
import {
  readReceiptsControllerGetUnreadCountsQueryKey,
  userControllerGetProfileQueryKey,
} from '../../api-client/@tanstack/react-query.gen';
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

function renderChannelWebSocket() {
  return renderHook(() => useChannelWebSocket(), {
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

    it('increments unread count for the channel in read receipts cache', async () => {
      const unreadKey = readReceiptsControllerGetUnreadCountsQueryKey();
      const existing: UnreadCountDto[] = [
        { channelId: 'channel-1', unreadCount: 2, mentionCount: 0 },
      ];
      queryClient.setQueryData(unreadKey, existing);

      // Seed a current user so the own-message check works
      queryClient.setQueryData(userControllerGetProfileQueryKey(), { id: 'current-user' });

      const key = channelMessagesQueryKey('channel-1');
      queryClient.setQueryData(key, createInfiniteData([]));

      renderChannelWebSocket();

      const newMsg = createMessage({ id: 'new-msg', channelId: 'channel-1', authorId: 'other-user' });
      await act(() => mockSocket.simulateEvent('newMessage', { message: newMsg }));

      const data = queryClient.getQueryData<UnreadCountDto[]>(unreadKey);
      expect(data!.find((c) => c.channelId === 'channel-1')!.unreadCount).toBe(3);
    });

    it('does not increment unread count for own messages', async () => {
      const unreadKey = readReceiptsControllerGetUnreadCountsQueryKey();
      const existing: UnreadCountDto[] = [
        { channelId: 'channel-1', unreadCount: 2, mentionCount: 0 },
      ];
      queryClient.setQueryData(unreadKey, existing);

      // Current user is the author
      queryClient.setQueryData(userControllerGetProfileQueryKey(), { id: 'current-user' });

      const key = channelMessagesQueryKey('channel-1');
      queryClient.setQueryData(key, createInfiniteData([]));

      renderChannelWebSocket();

      const ownMsg = createMessage({ id: 'own-msg', channelId: 'channel-1', authorId: 'current-user' });
      await act(() => mockSocket.simulateEvent('newMessage', { message: ownMsg }));

      const data = queryClient.getQueryData<UnreadCountDto[]>(unreadKey);
      expect(data!.find((c) => c.channelId === 'channel-1')!.unreadCount).toBe(2);
    });

    it('creates new unread entry when channel is not yet tracked', async () => {
      const unreadKey = readReceiptsControllerGetUnreadCountsQueryKey();
      queryClient.setQueryData(unreadKey, []);

      queryClient.setQueryData(userControllerGetProfileQueryKey(), { id: 'current-user' });

      const key = channelMessagesQueryKey('channel-new');
      queryClient.setQueryData(key, createInfiniteData([]));

      renderChannelWebSocket();

      const newMsg = createMessage({ id: 'new-msg', channelId: 'channel-new', authorId: 'other-user' });
      await act(() => mockSocket.simulateEvent('newMessage', { message: newMsg }));

      const data = queryClient.getQueryData<UnreadCountDto[]>(unreadKey);
      const entry = data!.find((c) => c.channelId === 'channel-new');
      expect(entry).toBeDefined();
      expect(entry!.unreadCount).toBe(1);
      expect(entry!.mentionCount).toBe(0);
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

    it('invalidates unread counts on reconnect', async () => {
      const unreadKey = readReceiptsControllerGetUnreadCountsQueryKey();
      const existing: UnreadCountDto[] = [
        { channelId: 'channel-1', unreadCount: 5 },
      ];
      queryClient.setQueryData(unreadKey, existing);

      renderChannelWebSocket();

      await act(() => mockSocket.simulateEvent('connect'));

      const query = queryClient.getQueryCache().find({ queryKey: unreadKey });
      expect(query?.isStale()).toBe(true);
    });
  });

  describe('READ_RECEIPT_UPDATED', () => {
    it('updates unread count and mention count to 0 for a channel', async () => {
      const unreadKey = readReceiptsControllerGetUnreadCountsQueryKey();
      const existing: UnreadCountDto[] = [
        { channelId: 'channel-1', unreadCount: 5, mentionCount: 3, lastReadMessageId: 'old-msg' },
        { channelId: 'channel-2', unreadCount: 3, mentionCount: 1 },
      ];
      queryClient.setQueryData(unreadKey, existing);

      renderChannelWebSocket();

      await act(() =>
        mockSocket.simulateEvent('readReceiptUpdated', {
          channelId: 'channel-1',
          directMessageGroupId: null,
          lastReadMessageId: 'new-msg',
        }),
      );

      const data = queryClient.getQueryData<UnreadCountDto[]>(unreadKey);
      const entry = data!.find((c) => c.channelId === 'channel-1');
      expect(entry!.unreadCount).toBe(0);
      expect(entry!.mentionCount).toBe(0);
      expect(entry!.lastReadMessageId).toBe('new-msg');
      // Other channels untouched
      expect(data!.find((c) => c.channelId === 'channel-2')!.unreadCount).toBe(3);
      expect(data!.find((c) => c.channelId === 'channel-2')!.mentionCount).toBe(1);
    });

    it('adds new entry when channel not in existing cache', async () => {
      const unreadKey = readReceiptsControllerGetUnreadCountsQueryKey();
      const existing: UnreadCountDto[] = [
        { channelId: 'channel-1', unreadCount: 5 },
      ];
      queryClient.setQueryData(unreadKey, existing);

      renderChannelWebSocket();

      await act(() =>
        mockSocket.simulateEvent('readReceiptUpdated', {
          channelId: 'channel-new',
          directMessageGroupId: null,
          lastReadMessageId: 'msg-1',
        }),
      );

      const data = queryClient.getQueryData<UnreadCountDto[]>(unreadKey);
      expect(data).toHaveLength(2);
      const newEntry = data!.find((c) => c.channelId === 'channel-new');
      expect(newEntry).toBeDefined();
      expect(newEntry!.unreadCount).toBe(0);
    });

    it('works for DM groups', async () => {
      const unreadKey = readReceiptsControllerGetUnreadCountsQueryKey();
      const existing: UnreadCountDto[] = [
        { directMessageGroupId: 'dm-1', unreadCount: 10 },
      ];
      queryClient.setQueryData(unreadKey, existing);

      renderChannelWebSocket();

      await act(() =>
        mockSocket.simulateEvent('readReceiptUpdated', {
          channelId: null,
          directMessageGroupId: 'dm-1',
          lastReadMessageId: 'dm-msg-5',
        }),
      );

      const data = queryClient.getQueryData<UnreadCountDto[]>(unreadKey);
      const entry = data!.find((c) => c.directMessageGroupId === 'dm-1');
      expect(entry!.unreadCount).toBe(0);
      expect(entry!.lastReadMessageId).toBe('dm-msg-5');
    });

    it('skips when no channelId or directMessageGroupId', async () => {
      const unreadKey = readReceiptsControllerGetUnreadCountsQueryKey();
      const existing: UnreadCountDto[] = [
        { channelId: 'channel-1', unreadCount: 5 },
      ];
      queryClient.setQueryData(unreadKey, existing);

      renderChannelWebSocket();

      await act(() =>
        mockSocket.simulateEvent('readReceiptUpdated', {
          channelId: null,
          directMessageGroupId: null,
          lastReadMessageId: 'msg-1',
        }),
      );

      const data = queryClient.getQueryData<UnreadCountDto[]>(unreadKey);
      expect(data).toEqual(existing);
    });
  });
});
