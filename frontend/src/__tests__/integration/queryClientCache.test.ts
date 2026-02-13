import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { InfiniteData } from '@tanstack/react-query';
import type { PaginatedMessagesResponseDto } from '../../api-client/types.gen';

// Mock the generated client before importing query key functions
vi.mock('../../api-client/client.gen', () => ({
  client: {
    getConfig: () => ({ baseUrl: 'http://localhost:3000' }),
  },
}));

import { channelMessagesQueryKey, dmMessagesQueryKey } from '../../utils/messageQueryKeys';
import {
  prependMessageToInfinite,
  updateMessageInInfinite,
  deleteMessageFromInfinite,
  prependMessageToFlat,
  updateMessageInFlat,
  deleteMessageFromFlat,
} from '../../utils/messageCacheUpdaters';
import { invalidateByIds, invalidateByIdAndPath } from '../../utils/queryInvalidation';
import {
  createTestQueryClient,
  createMessage,
  createInfiniteData,
  createFlatData,
} from '../test-utils';

let queryClient: ReturnType<typeof createTestQueryClient>;

beforeEach(() => {
  queryClient = createTestQueryClient();
});

describe('QueryClient round-trip: channel messages (InfiniteData)', () => {
  const channelId = 'ch-test';

  it('setQueryData + getQueryData round-trip preserves data', () => {
    const key = channelMessagesQueryKey(channelId);
    const data = createInfiniteData([createMessage({ id: 'msg-1' })]);

    queryClient.setQueryData(key, data);
    const retrieved = queryClient.getQueryData(key);

    expect(retrieved).toEqual(data);
  });

  it('prepend via setQueryData callback', () => {
    const key = channelMessagesQueryKey(channelId);
    const existing = createMessage({ id: 'existing' });
    queryClient.setQueryData(key, createInfiniteData([existing]));

    const newMsg = createMessage({ id: 'new' });
    queryClient.setQueryData(key, (old: unknown) =>
      prependMessageToInfinite(old as InfiniteData<PaginatedMessagesResponseDto> | undefined, newMsg),
    );

    const result = queryClient.getQueryData(key) as InfiniteData<PaginatedMessagesResponseDto>;
    expect(result.pages[0].messages).toHaveLength(2);
    expect(result.pages[0].messages[0]).toMatchObject({ id: 'new' });
  });

  it('update via setQueryData callback', () => {
    const key = channelMessagesQueryKey(channelId);
    queryClient.setQueryData(key, createInfiniteData([createMessage({ id: 'msg-1', authorId: 'old' })]));

    const updated = createMessage({ id: 'msg-1', authorId: 'updated' });
    queryClient.setQueryData(key, (old: unknown) =>
      updateMessageInInfinite(old as InfiniteData<PaginatedMessagesResponseDto> | undefined, updated),
    );

    const result = queryClient.getQueryData(key) as InfiniteData<PaginatedMessagesResponseDto>;
    expect(result.pages[0].messages[0]).toMatchObject({ authorId: 'updated' });
  });

  it('delete via setQueryData callback', () => {
    const key = channelMessagesQueryKey(channelId);
    queryClient.setQueryData(key, createInfiniteData([
      createMessage({ id: 'keep' }),
      createMessage({ id: 'remove' }),
    ]));

    queryClient.setQueryData(key, (old: unknown) =>
      deleteMessageFromInfinite(old as InfiniteData<PaginatedMessagesResponseDto> | undefined, 'remove'),
    );

    const result = queryClient.getQueryData(key) as InfiniteData<PaginatedMessagesResponseDto>;
    expect(result.pages[0].messages).toHaveLength(1);
    expect(result.pages[0].messages[0]).toMatchObject({ id: 'keep' });
  });
});

describe('QueryClient round-trip: DM messages (flat)', () => {
  const dmGroupId = 'dm-test';

  it('setQueryData + getQueryData round-trip preserves data', () => {
    const key = dmMessagesQueryKey(dmGroupId);
    const data = createFlatData([createMessage({ id: 'dm-1' })]);

    queryClient.setQueryData(key, data);
    const retrieved = queryClient.getQueryData(key);

    expect(retrieved).toEqual(data);
  });

  it('prepend via setQueryData callback', () => {
    const key = dmMessagesQueryKey(dmGroupId);
    queryClient.setQueryData(key, createFlatData([createMessage({ id: 'existing' })]));

    const newMsg = createMessage({ id: 'new' });
    queryClient.setQueryData(key, (old: unknown) =>
      prependMessageToFlat(old as PaginatedMessagesResponseDto | undefined, newMsg),
    );

    const result = queryClient.getQueryData(key) as PaginatedMessagesResponseDto;
    expect(result.messages).toHaveLength(2);
    expect(result.messages[0]).toMatchObject({ id: 'new' });
  });

  it('update via setQueryData callback', () => {
    const key = dmMessagesQueryKey(dmGroupId);
    queryClient.setQueryData(key, createFlatData([createMessage({ id: 'dm-1', authorId: 'old' })]));

    queryClient.setQueryData(key, (old: unknown) =>
      updateMessageInFlat(old as PaginatedMessagesResponseDto | undefined, createMessage({ id: 'dm-1', authorId: 'new' })),
    );

    const result = queryClient.getQueryData(key) as PaginatedMessagesResponseDto;
    expect(result.messages[0]).toMatchObject({ authorId: 'new' });
  });

  it('delete via setQueryData callback', () => {
    const key = dmMessagesQueryKey(dmGroupId);
    queryClient.setQueryData(key, createFlatData([
      createMessage({ id: 'keep' }),
      createMessage({ id: 'remove' }),
    ]));

    queryClient.setQueryData(key, (old: unknown) =>
      deleteMessageFromFlat(old as PaginatedMessagesResponseDto | undefined, 'remove'),
    );

    const result = queryClient.getQueryData(key) as PaginatedMessagesResponseDto;
    expect(result.messages).toHaveLength(1);
    expect(result.messages[0]).toMatchObject({ id: 'keep' });
  });
});

describe('QueryClient invalidation with seeded cache', () => {
  it('invalidateByIds invalidates seeded channel message cache', () => {
    const key = channelMessagesQueryKey('ch-1');
    queryClient.setQueryData(key, createInfiniteData([createMessage({ id: 'msg' })]));

    invalidateByIds(queryClient, ['messagesControllerFindAllForChannel']);

    const query = queryClient.getQueryCache().find({ queryKey: key });
    expect(query?.isStale()).toBe(true);
  });

  it('invalidateByIdAndPath invalidates specific channel', () => {
    const key1 = channelMessagesQueryKey('ch-target');
    const key2 = channelMessagesQueryKey('ch-other');
    queryClient.setQueryData(key1, createInfiniteData([createMessage({ id: 'a' })]));
    queryClient.setQueryData(key2, createInfiniteData([createMessage({ id: 'b' })]));

    invalidateByIdAndPath(queryClient, 'messagesControllerFindAllForChannel', { channelId: 'ch-target' });

    const target = queryClient.getQueryCache().find({ queryKey: key1 });
    const other = queryClient.getQueryCache().find({ queryKey: key2 });
    expect(target?.isStale()).toBe(true);
    expect(other?.isStale()).toBe(false);
  });
});
