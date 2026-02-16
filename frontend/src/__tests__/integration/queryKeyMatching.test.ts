import { describe, it, expect, beforeEach } from 'vitest';
import { createTestQueryClient } from '../test-utils';

/**
 * Tests that TanStack Query's native partial key matching works correctly
 * with our generated query key format: [{ _id: 'operationId', baseUrl, path?, query? }]
 *
 * This is the pattern used across all mutation onSuccess callbacks to invalidate
 * related queries by operation ID.
 */

let queryClient: ReturnType<typeof createTestQueryClient>;

beforeEach(() => {
  queryClient = createTestQueryClient();
});

describe('Native query key partial matching', () => {
  it('matches queries by _id regardless of other key properties', async () => {
    // Seed two queries with the same _id but different paths
    queryClient.setQueryData(
      [{ _id: 'channelsControllerFindAllForCommunity', baseUrl: 'http://localhost:3000', path: { communityId: 'c1' } }],
      [{ id: 'ch-1', name: 'general' }],
    );
    queryClient.setQueryData(
      [{ _id: 'channelsControllerFindAllForCommunity', baseUrl: 'http://localhost:3000', path: { communityId: 'c2' } }],
      [{ id: 'ch-2', name: 'random' }],
    );
    // Seed a query with a different _id
    queryClient.setQueryData(
      [{ _id: 'channelsControllerFindOne', baseUrl: 'http://localhost:3000', path: { channelId: 'ch-1' } }],
      { id: 'ch-1', name: 'general' },
    );

    // Invalidate by partial key — only _id
    await queryClient.invalidateQueries({ queryKey: [{ _id: 'channelsControllerFindAllForCommunity' }] });

    // Both queries with that _id should be invalidated (stale)
    const cache = queryClient.getQueryCache().getAll();
    const findAllQueries = cache.filter(
      (q) => (q.queryKey[0] as { _id: string })._id === 'channelsControllerFindAllForCommunity',
    );
    const findOneQuery = cache.find(
      (q) => (q.queryKey[0] as { _id: string })._id === 'channelsControllerFindOne',
    );

    // invalidateQueries marks queries as stale (isStale=true)
    expect(findAllQueries).toHaveLength(2);
    for (const q of findAllQueries) {
      expect(q.isStale()).toBe(true);
    }
    // The unrelated query should still be fresh
    expect(findOneQuery!.isStale()).toBe(false);
  });

  it('does not match queries with different _id', async () => {
    queryClient.setQueryData(
      [{ _id: 'communityControllerFindAll', baseUrl: 'http://localhost:3000' }],
      [{ id: 'c1' }],
    );
    queryClient.setQueryData(
      [{ _id: 'communityControllerFindOne', baseUrl: 'http://localhost:3000', path: { id: 'c1' } }],
      { id: 'c1' },
    );

    await queryClient.invalidateQueries({ queryKey: [{ _id: 'communityControllerFindAll' }] });

    const cache = queryClient.getQueryCache().getAll();
    const findAll = cache.find((q) => (q.queryKey[0] as { _id: string })._id === 'communityControllerFindAll');
    const findOne = cache.find((q) => (q.queryKey[0] as { _id: string })._id === 'communityControllerFindOne');

    expect(findAll!.isStale()).toBe(true);
    expect(findOne!.isStale()).toBe(false);
  });

  it('invalidating multiple _ids independently works', async () => {
    queryClient.setQueryData(
      [{ _id: 'moderationControllerGetBanList', baseUrl: 'http://localhost:3000', path: { communityId: 'c1' } }],
      [],
    );
    queryClient.setQueryData(
      [{ _id: 'moderationControllerGetModerationLogs', baseUrl: 'http://localhost:3000', path: { communityId: 'c1' } }],
      [],
    );
    queryClient.setQueryData(
      [{ _id: 'membershipControllerFindAllForCommunity', baseUrl: 'http://localhost:3000', path: { communityId: 'c1' } }],
      [],
    );

    // Simulate what BanDialog does: invalidate banList + moderationLogs but not membership
    await queryClient.invalidateQueries({ queryKey: [{ _id: 'moderationControllerGetBanList' }] });
    await queryClient.invalidateQueries({ queryKey: [{ _id: 'moderationControllerGetModerationLogs' }] });

    const cache = queryClient.getQueryCache().getAll();
    const banList = cache.find((q) => (q.queryKey[0] as { _id: string })._id === 'moderationControllerGetBanList');
    const logs = cache.find((q) => (q.queryKey[0] as { _id: string })._id === 'moderationControllerGetModerationLogs');
    const membership = cache.find((q) => (q.queryKey[0] as { _id: string })._id === 'membershipControllerFindAllForCommunity');

    expect(banList!.isStale()).toBe(true);
    expect(logs!.isStale()).toBe(true);
    expect(membership!.isStale()).toBe(false);
  });

  it('handles queries with query params in key', async () => {
    queryClient.setQueryData(
      [{ _id: 'messagesControllerFindAllForChannel', baseUrl: 'http://localhost:3000', path: { channelId: 'ch-1' }, query: { limit: 25 } }],
      { messages: [] },
    );
    queryClient.setQueryData(
      [{ _id: 'messagesControllerFindAllForChannel', baseUrl: 'http://localhost:3000', path: { channelId: 'ch-2' }, query: { limit: 50 } }],
      { messages: [] },
    );

    await queryClient.invalidateQueries({ queryKey: [{ _id: 'messagesControllerFindAllForChannel' }] });

    const cache = queryClient.getQueryCache().getAll();
    const messageQueries = cache.filter(
      (q) => (q.queryKey[0] as { _id: string })._id === 'messagesControllerFindAllForChannel',
    );

    expect(messageQueries).toHaveLength(2);
    for (const q of messageQueries) {
      expect(q.isStale()).toBe(true);
    }
  });
});
