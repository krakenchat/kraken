import { describe, it, expect, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { useReadReceipts } from '../../hooks/useReadReceipts';
import { readReceiptsControllerGetUnreadCountsQueryKey } from '../../api-client/@tanstack/react-query.gen';
import type { UnreadCountDto } from '../../api-client';

// Mock the options function so useQuery uses our seeded data
vi.mock('../../api-client/@tanstack/react-query.gen', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../api-client/@tanstack/react-query.gen')>();
  return {
    ...actual,
    readReceiptsControllerGetUnreadCountsOptions: () => ({
      queryKey: actual.readReceiptsControllerGetUnreadCountsQueryKey(),
      queryFn: () => Promise.resolve([]),
      staleTime: Infinity,
    }),
  };
});

describe('useReadReceipts', () => {
  function createWrapper(queryClient: QueryClient) {
    return function Wrapper({ children }: { children: React.ReactNode }) {
      return React.createElement(
        QueryClientProvider,
        { client: queryClient },
        children,
      );
    };
  }

  function setupWithData(data: UnreadCountDto[]) {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const key = readReceiptsControllerGetUnreadCountsQueryKey();
    queryClient.setQueryData(key, data);

    return renderHook(() => useReadReceipts(), {
      wrapper: createWrapper(queryClient),
    });
  }

  describe('unreadCount', () => {
    it('returns the unread count for a known channel', async () => {
      const { result } = setupWithData([
        { channelId: 'ch-1', unreadCount: 5, mentionCount: 0 } as UnreadCountDto,
      ]);

      await waitFor(() => {
        expect(result.current.unreadCount('ch-1')).toBe(5);
      });
    });

    it('returns 0 for an unknown channel ID', () => {
      const { result } = setupWithData([]);
      expect(result.current.unreadCount('unknown')).toBe(0);
    });

    it('returns 0 when called with undefined', () => {
      const { result } = setupWithData([]);
      expect(result.current.unreadCount(undefined)).toBe(0);
    });
  });

  describe('mentionCount', () => {
    it('returns the mention count for a known channel', async () => {
      const { result } = setupWithData([
        { channelId: 'ch-1', unreadCount: 10, mentionCount: 3 } as UnreadCountDto,
      ]);

      await waitFor(() => {
        expect(result.current.mentionCount('ch-1')).toBe(3);
      });
    });

    it('returns 0 for an unknown ID', () => {
      const { result } = setupWithData([]);
      expect(result.current.mentionCount('unknown')).toBe(0);
    });

    it('returns 0 when called with undefined', () => {
      const { result } = setupWithData([]);
      expect(result.current.mentionCount(undefined)).toBe(0);
    });
  });

  describe('hasUnread', () => {
    it('returns true when unreadCount > 0', async () => {
      const { result } = setupWithData([
        { channelId: 'ch-1', unreadCount: 1, mentionCount: 0 } as UnreadCountDto,
      ]);

      await waitFor(() => {
        expect(result.current.hasUnread('ch-1')).toBe(true);
      });
    });

    it('returns false when unreadCount is 0', async () => {
      const { result } = setupWithData([
        { channelId: 'ch-1', unreadCount: 0, mentionCount: 0 } as UnreadCountDto,
      ]);

      await waitFor(() => {
        expect(result.current.hasUnread('ch-1')).toBe(false);
      });
    });

    it('returns false for an unknown ID', () => {
      const { result } = setupWithData([]);
      expect(result.current.hasUnread('unknown')).toBe(false);
    });

    it('returns false when called with undefined', () => {
      const { result } = setupWithData([]);
      expect(result.current.hasUnread(undefined)).toBe(false);
    });
  });

  describe('lastReadMessageId', () => {
    it('returns the last read message ID for a known channel', async () => {
      const { result } = setupWithData([
        {
          channelId: 'ch-1',
          unreadCount: 2,
          mentionCount: 0,
          lastReadMessageId: 'msg-42',
        } as UnreadCountDto,
      ]);

      await waitFor(() => {
        expect(result.current.lastReadMessageId('ch-1')).toBe('msg-42');
      });
    });

    it('returns undefined for an unknown ID', () => {
      const { result } = setupWithData([]);
      expect(result.current.lastReadMessageId('unknown')).toBeUndefined();
    });

    it('returns undefined when called with undefined', () => {
      const { result } = setupWithData([]);
      expect(result.current.lastReadMessageId(undefined)).toBeUndefined();
    });
  });

  describe('DM group lookups', () => {
    it('looks up by directMessageGroupId', async () => {
      const { result } = setupWithData([
        {
          directMessageGroupId: 'dm-1',
          unreadCount: 7,
          mentionCount: 2,
        } as UnreadCountDto,
      ]);

      await waitFor(() => {
        expect(result.current.unreadCount('dm-1')).toBe(7);
        expect(result.current.mentionCount('dm-1')).toBe(2);
        expect(result.current.hasUnread('dm-1')).toBe(true);
      });
    });
  });
});
