import { describe, it, expect, beforeEach, vi } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '../msw/server';
import { createTestQueryClient } from '../test-utils';

// Mock the generated client
vi.mock('../../api-client/client.gen', () => ({
  client: {
    getConfig: () => ({ baseUrl: 'http://localhost:3000' }),
  },
}));

let queryClient: ReturnType<typeof createTestQueryClient>;

beforeEach(() => {
  queryClient = createTestQueryClient();
});

describe('MSW integration: channel messages', () => {
  it('fetches channel messages successfully', async () => {
    const data = await queryClient.fetchQuery({
      queryKey: [{ _id: 'messagesControllerFindAllForChannel', baseUrl: 'http://localhost:3000', path: { channelId: 'ch-msw' }, query: { limit: 25, continuationToken: '' } }],
      queryFn: async () => {
        const res = await fetch('http://localhost:3000/api/messages/channel/ch-msw?limit=25&continuationToken=');
        return res.json();
      },
    });

    expect(data.messages).toHaveLength(1);
    expect(data.messages[0]).toMatchObject({ id: 'msw-msg-1', channelId: 'ch-msw' });
  });

  it('handles server error response', async () => {
    server.use(
      http.get('http://localhost:3000/api/messages/channel/:channelId', () => {
        return new HttpResponse(null, { status: 500 });
      }),
    );

    await expect(
      queryClient.fetchQuery({
        queryKey: [{ _id: 'messagesControllerFindAllForChannel', baseUrl: 'http://localhost:3000', path: { channelId: 'ch-err' } }],
        queryFn: async () => {
          const res = await fetch('http://localhost:3000/api/messages/channel/ch-err');
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          return res.json();
        },
      }),
    ).rejects.toThrow('HTTP 500');
  });
});

describe('MSW integration: DM messages', () => {
  it('fetches DM messages successfully', async () => {
    const data = await queryClient.fetchQuery({
      queryKey: [{ _id: 'messagesControllerFindAllForGroup', baseUrl: 'http://localhost:3000', path: { groupId: 'dm-msw' }, query: { limit: 25, continuationToken: '' } }],
      queryFn: async () => {
        const res = await fetch('http://localhost:3000/api/messages/group/dm-msw?limit=25&continuationToken=');
        return res.json();
      },
    });

    expect(data.messages).toHaveLength(1);
    expect(data.messages[0]).toMatchObject({ id: 'msw-dm-1', directMessageGroupId: 'dm-msw' });
  });
});

describe('MSW integration: thread replies', () => {
  it('fetches thread replies successfully', async () => {
    const data = await queryClient.fetchQuery({
      queryKey: [{ _id: 'threadsControllerGetReplies', baseUrl: 'http://localhost:3000', path: { parentMessageId: 'parent-msw' } }],
      queryFn: async () => {
        const res = await fetch('http://localhost:3000/api/threads/parent-msw/replies');
        return res.json();
      },
    });

    expect(data.replies).toHaveLength(1);
    expect(data.replies[0]).toMatchObject({ id: 'msw-reply-1' });
  });
});
