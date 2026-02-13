import { describe, it, expect, beforeEach } from 'vitest';
import { QueryClient } from '@tanstack/react-query';
import {
  invalidateByIds,
  invalidateByIdAndPath,
  INVALIDATION_GROUPS,
} from '../../utils/queryInvalidation';

let queryClient: QueryClient;

beforeEach(() => {
  queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
});

describe('invalidateByIds', () => {
  it('invalidates queries matching any of the given operation IDs', async () => {
    // Seed two queries with different _ids
    queryClient.setQueryData(
      [{ _id: 'communityControllerFindAll', baseUrl: '' }],
      { data: 'communities' },
    );
    queryClient.setQueryData(
      [{ _id: 'channelsControllerFindOne', baseUrl: '' }],
      { data: 'channel' },
    );
    queryClient.setQueryData(
      [{ _id: 'unrelated', baseUrl: '' }],
      { data: 'other' },
    );

    invalidateByIds(queryClient, ['communityControllerFindAll']);

    // The targeted query should be invalidated (stale)
    const communityQuery = queryClient.getQueryCache().find({
      queryKey: [{ _id: 'communityControllerFindAll', baseUrl: '' }],
    });
    expect(communityQuery?.isStale()).toBe(true);

    // The unrelated query should not be invalidated
    const unrelatedQuery = queryClient.getQueryCache().find({
      queryKey: [{ _id: 'unrelated', baseUrl: '' }],
    });
    expect(unrelatedQuery?.isStale()).toBe(false);
  });

  it('handles multiple operation IDs', async () => {
    queryClient.setQueryData([{ _id: 'opA', baseUrl: '' }], 'a');
    queryClient.setQueryData([{ _id: 'opB', baseUrl: '' }], 'b');
    queryClient.setQueryData([{ _id: 'opC', baseUrl: '' }], 'c');

    invalidateByIds(queryClient, ['opA', 'opC']);

    const a = queryClient.getQueryCache().find({ queryKey: [{ _id: 'opA', baseUrl: '' }] });
    const b = queryClient.getQueryCache().find({ queryKey: [{ _id: 'opB', baseUrl: '' }] });
    const c = queryClient.getQueryCache().find({ queryKey: [{ _id: 'opC', baseUrl: '' }] });

    expect(a?.isStale()).toBe(true);
    expect(b?.isStale()).toBe(false);
    expect(c?.isStale()).toBe(true);
  });

  it('skips queries without _id in key', async () => {
    queryClient.setQueryData(['simple-key'], 'value');
    // Should not throw
    invalidateByIds(queryClient, ['simple-key']);
    const q = queryClient.getQueryCache().find({ queryKey: ['simple-key'] });
    expect(q?.isStale()).toBe(false);
  });
});

describe('invalidateByIdAndPath', () => {
  it('invalidates only queries with matching _id AND path params', async () => {
    queryClient.setQueryData(
      [{ _id: 'channelsControllerFindOne', baseUrl: '', path: { channelId: 'ch-1' } }],
      'channel1',
    );
    queryClient.setQueryData(
      [{ _id: 'channelsControllerFindOne', baseUrl: '', path: { channelId: 'ch-2' } }],
      'channel2',
    );

    invalidateByIdAndPath(queryClient, 'channelsControllerFindOne', { channelId: 'ch-1' });

    const ch1 = queryClient.getQueryCache().find({
      queryKey: [{ _id: 'channelsControllerFindOne', baseUrl: '', path: { channelId: 'ch-1' } }],
    });
    const ch2 = queryClient.getQueryCache().find({
      queryKey: [{ _id: 'channelsControllerFindOne', baseUrl: '', path: { channelId: 'ch-2' } }],
    });

    expect(ch1?.isStale()).toBe(true);
    expect(ch2?.isStale()).toBe(false);
  });

  it('does not invalidate when _id matches but path does not', async () => {
    queryClient.setQueryData(
      [{ _id: 'op', baseUrl: '', path: { id: 'wrong' } }],
      'value',
    );

    invalidateByIdAndPath(queryClient, 'op', { id: 'target' });

    const q = queryClient.getQueryCache().find({
      queryKey: [{ _id: 'op', baseUrl: '', path: { id: 'wrong' } }],
    });
    expect(q?.isStale()).toBe(false);
  });

  it('does not invalidate when key has no path', async () => {
    queryClient.setQueryData([{ _id: 'op', baseUrl: '' }], 'value');

    invalidateByIdAndPath(queryClient, 'op', { id: 'any' });

    const q = queryClient.getQueryCache().find({ queryKey: [{ _id: 'op', baseUrl: '' }] });
    expect(q?.isStale()).toBe(false);
  });
});

describe('INVALIDATION_GROUPS', () => {
  it('has community group with expected operations', () => {
    expect(INVALIDATION_GROUPS.community).toContain('communityControllerFindAll');
    expect(INVALIDATION_GROUPS.community).toContain('communityControllerFindOne');
  });

  it('has channel group with expected operations', () => {
    expect(INVALIDATION_GROUPS.channel).toContain('channelsControllerFindAllForCommunity');
    expect(INVALIDATION_GROUPS.channel).toContain('channelsControllerFindOne');
  });

  it('has directMessages group', () => {
    expect(INVALIDATION_GROUPS.directMessages).toContain('directMessagesControllerGetDmMessages');
  });

  it('has threadReplies group', () => {
    expect(INVALIDATION_GROUPS.threadReplies).toContain('threadsControllerGetReplies');
  });
});
