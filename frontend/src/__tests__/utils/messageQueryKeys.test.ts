import { describe, it, expect, vi } from 'vitest';

// Mock the generated client to avoid import errors in jsdom
// createQueryKey reads client.getConfig().baseUrl which would be undefined
vi.mock('../../api-client/client.gen', () => ({
  client: {
    getConfig: () => ({ baseUrl: 'http://localhost:3000' }),
  },
}));

import {
  channelMessagesQueryKey,
  dmMessagesQueryKey,
  MESSAGE_STALE_TIME,
  MESSAGE_MAX_PAGES,
} from '../../utils/messageQueryKeys';

describe('channelMessagesQueryKey', () => {
  it('produces a key with the correct _id', () => {
    const key = channelMessagesQueryKey('ch-123');
    expect(key[0]).toEqual(expect.objectContaining({ _id: 'messagesControllerFindAllForChannel' }));
  });

  it('includes the channelId in path', () => {
    const key = channelMessagesQueryKey('ch-123');
    expect(key[0]).toEqual(expect.objectContaining({
      path: { channelId: 'ch-123' },
    }));
  });

  it('includes default query params', () => {
    const key = channelMessagesQueryKey('ch-123');
    expect(key[0]).toEqual(expect.objectContaining({
      query: { limit: 25, continuationToken: '' },
    }));
  });
});

describe('dmMessagesQueryKey', () => {
  it('produces a key with the correct _id', () => {
    const key = dmMessagesQueryKey('dm-456');
    expect(key[0]).toEqual(expect.objectContaining({ _id: 'directMessagesControllerGetDmMessages' }));
  });

  it('includes the dmGroupId in path', () => {
    const key = dmMessagesQueryKey('dm-456');
    expect(key[0]).toEqual(expect.objectContaining({
      path: { id: 'dm-456' },
    }));
  });
});

describe('constants', () => {
  it('MESSAGE_STALE_TIME is Infinity', () => {
    expect(MESSAGE_STALE_TIME).toBe(Infinity);
  });

  it('MESSAGE_MAX_PAGES is 40', () => {
    expect(MESSAGE_MAX_PAGES).toBe(40);
  });
});
