import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { ThreadRepliesResponseDto } from '../../api-client/types.gen';

// Mock the generated client
vi.mock('../../api-client/client.gen', () => ({
  client: {
    getConfig: () => ({ baseUrl: 'http://localhost:3000' }),
  },
}));

import { useThreadWebSocket } from '../../hooks/useThreadWebSocket';
import { threadsControllerGetRepliesQueryKey } from '../../api-client/@tanstack/react-query.gen';
import {
  createTestQueryClient,
  createMockSocket,
  createTestWrapper,
  createThreadReply,
  createThreadRepliesData,
} from '../test-utils';
import type { MockSocket } from '../test-utils';

let queryClient: ReturnType<typeof createTestQueryClient>;
let mockSocket: MockSocket;

function getRepliesKey(parentMessageId: string) {
  return threadsControllerGetRepliesQueryKey({
    path: { parentMessageId },
    query: { limit: 50, continuationToken: '' },
  });
}

beforeEach(() => {
  queryClient = createTestQueryClient();
  mockSocket = createMockSocket();
});

function renderThreadWebSocket() {
  return renderHook(() => useThreadWebSocket(), {
    wrapper: createTestWrapper({ queryClient, socket: mockSocket }),
  });
}

describe('useThreadWebSocket', () => {
  it('registers event handlers on mount', () => {
    renderThreadWebSocket();
    expect(mockSocket.on).toHaveBeenCalledWith('newThreadReply', expect.any(Function));
    expect(mockSocket.on).toHaveBeenCalledWith('updateThreadReply', expect.any(Function));
    expect(mockSocket.on).toHaveBeenCalledWith('deleteThreadReply', expect.any(Function));
  });

  it('unregisters event handlers on unmount', () => {
    const { unmount } = renderThreadWebSocket();
    unmount();
    expect(mockSocket.off).toHaveBeenCalledWith('newThreadReply', expect.any(Function));
    expect(mockSocket.off).toHaveBeenCalledWith('updateThreadReply', expect.any(Function));
    expect(mockSocket.off).toHaveBeenCalledWith('deleteThreadReply', expect.any(Function));
  });

  describe('NEW_THREAD_REPLY', () => {
    it('appends a new reply to the cache', async () => {
      const parentId = 'parent-1';
      const key = getRepliesKey(parentId);
      const existingReply = createThreadReply({ id: 'reply-1', parentMessageId: parentId });
      queryClient.setQueryData(key, createThreadRepliesData([existingReply]));

      renderThreadWebSocket();

      const newReply = createThreadReply({ id: 'reply-2', parentMessageId: parentId });
      await act(() =>
        mockSocket.simulateEvent('newThreadReply', {
          reply: newReply,
          parentMessageId: parentId,
        }),
      );

      const data = queryClient.getQueryData(key) as ThreadRepliesResponseDto;
      expect(data.replies).toHaveLength(2);
      expect(data.replies[1]).toMatchObject({ id: 'reply-2' });
    });

    it('deduplicates replies with same id', async () => {
      const parentId = 'parent-1';
      const key = getRepliesKey(parentId);
      const reply = createThreadReply({ id: 'reply-1', parentMessageId: parentId });
      queryClient.setQueryData(key, createThreadRepliesData([reply]));

      renderThreadWebSocket();

      await act(() =>
        mockSocket.simulateEvent('newThreadReply', {
          reply: createThreadReply({ id: 'reply-1', parentMessageId: parentId }),
          parentMessageId: parentId,
        }),
      );

      const data = queryClient.getQueryData(key) as ThreadRepliesResponseDto;
      expect(data.replies).toHaveLength(1);
    });

    it('returns undefined (no-op) when cache has no data', async () => {
      renderThreadWebSocket();

      await act(() =>
        mockSocket.simulateEvent('newThreadReply', {
          reply: createThreadReply({ id: 'reply-1' }),
          parentMessageId: 'no-cache-parent',
        }),
      );
      // Should not throw; cache remains empty
      const key = getRepliesKey('no-cache-parent');
      expect(queryClient.getQueryData(key)).toBeUndefined();
    });
  });

  describe('UPDATE_THREAD_REPLY', () => {
    it('updates an existing reply in cache', async () => {
      const parentId = 'parent-1';
      const key = getRepliesKey(parentId);
      const reply = createThreadReply({ id: 'reply-1', parentMessageId: parentId, authorId: 'old' });
      queryClient.setQueryData(key, createThreadRepliesData([reply]));

      renderThreadWebSocket();

      const updatedReply = createThreadReply({ id: 'reply-1', parentMessageId: parentId, authorId: 'new' });
      await act(() =>
        mockSocket.simulateEvent('updateThreadReply', {
          reply: updatedReply,
          parentMessageId: parentId,
        }),
      );

      const data = queryClient.getQueryData(key) as ThreadRepliesResponseDto;
      expect(data.replies[0]).toMatchObject({ authorId: 'new' });
    });
  });

  describe('DELETE_THREAD_REPLY', () => {
    it('removes a reply from cache', async () => {
      const parentId = 'parent-1';
      const key = getRepliesKey(parentId);
      queryClient.setQueryData(key, createThreadRepliesData([
        createThreadReply({ id: 'keep', parentMessageId: parentId }),
        createThreadReply({ id: 'remove', parentMessageId: parentId }),
      ]));

      renderThreadWebSocket();

      await act(() =>
        mockSocket.simulateEvent('deleteThreadReply', {
          parentMessageId: parentId,
          replyId: 'remove',
        }),
      );

      const data = queryClient.getQueryData(key) as ThreadRepliesResponseDto;
      expect(data.replies).toHaveLength(1);
      expect(data.replies[0]).toMatchObject({ id: 'keep' });
    });
  });
});
