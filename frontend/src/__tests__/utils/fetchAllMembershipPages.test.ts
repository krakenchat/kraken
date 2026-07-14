import { describe, it, expect, vi } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '../msw/server';
import { fetchAllMembershipPages } from '../../utils/fetchAllMembershipPages';

vi.mock('../../api-client/client.gen', async (importOriginal) => {
  const { createClient, createConfig } = await import('../../api-client/client');
  return {
    ...(await importOriginal<Record<string, unknown>>()),
    client: createClient(createConfig({ baseUrl: 'http://localhost:3000' })),
  };
});

const BASE_URL = 'http://localhost:3000';

function makeMember(index: number) {
  return {
    id: `membership-${index}`,
    userId: `user-${index}`,
    communityId: 'community-1',
    joinedAt: '2025-01-01T00:00:00Z',
    roles: [],
    user: {
      id: `user-${index}`,
      username: `user${index}`,
      displayName: `User ${index}`,
      avatarUrl: null,
      status: null,
    },
  };
}

describe('fetchAllMembershipPages', () => {
  it('follows continuation tokens and returns the flattened member list', async () => {
    const requests: Array<{ limit: string | null; token: string | null }> = [];

    server.use(
      http.get(
        `${BASE_URL}/api/membership/community/community-1`,
        ({ request }) => {
          const url = new URL(request.url);
          const token = url.searchParams.get('continuationToken');
          requests.push({ limit: url.searchParams.get('limit'), token });

          if (!token) {
            return HttpResponse.json({
              members: [makeMember(0), makeMember(1)],
              continuationToken: 'membership-1',
            });
          }
          if (token === 'membership-1') {
            return HttpResponse.json({
              members: [makeMember(2), makeMember(3)],
              continuationToken: 'membership-3',
            });
          }
          // Final partial page
          return HttpResponse.json({
            members: [makeMember(4)],
            continuationToken: undefined,
          });
        },
      ),
    );

    const members = await fetchAllMembershipPages('community-1', { limit: 2 });

    expect(members.map((m) => m.userId)).toEqual([
      'user-0',
      'user-1',
      'user-2',
      'user-3',
      'user-4',
    ]);
    expect(requests).toHaveLength(3);
    expect(requests[0].token).toBeFalsy();
    expect(requests[1].token).toBe('membership-1');
    expect(requests[2].token).toBe('membership-3');
    expect(requests.every((r) => r.limit === '2')).toBe(true);
  });

  it('stops after maxPages even when the server keeps returning tokens', async () => {
    let requestCount = 0;

    server.use(
      http.get(`${BASE_URL}/api/membership/community/community-1`, () => {
        requestCount++;
        return HttpResponse.json({
          members: [makeMember(requestCount)],
          // Always a token — a buggy/enormous server response must not
          // cause an unbounded fetch loop.
          continuationToken: `membership-${requestCount}`,
        });
      }),
    );

    const members = await fetchAllMembershipPages('community-1', {
      limit: 1,
      maxPages: 2,
    });

    expect(requestCount).toBe(2);
    expect(members).toHaveLength(2);
  });

  it('returns an empty array for an empty community', async () => {
    server.use(
      http.get(`${BASE_URL}/api/membership/community/community-1`, () =>
        HttpResponse.json({ members: [], continuationToken: undefined }),
      ),
    );

    const members = await fetchAllMembershipPages('community-1');
    expect(members).toEqual([]);
  });
});
