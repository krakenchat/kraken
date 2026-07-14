import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor, act } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { server } from '../msw/server';
import { renderWithProviders } from '../test-utils';
import MemberListContainer from '../../components/Message/MemberListContainer';
import { VoiceSessionType } from '../../contexts/VoiceContext';
import { handleUserOnline } from '../../socket-hub/handlers/presenceHandlers';
import type { MemberData } from '../../components/Message/MemberList';

vi.mock('../../api-client/client.gen', async (importOriginal) => {
  const { createClient, createConfig } = await import('../../api-client/client');
  return {
    ...(await importOriginal<Record<string, unknown>>()),
    client: createClient(createConfig({ baseUrl: 'http://localhost:3000' })),
  };
});

const BASE_URL = 'http://localhost:3000';

interface CapturedMemberListProps {
  members: MemberData[];
  hasMore?: boolean;
  isLoadingMore?: boolean;
  onLoadMore?: () => void;
}

let capturedPropsHistory: CapturedMemberListProps[] = [];
vi.mock('../../components/Message/MemberList', () => ({
  default: (props: CapturedMemberListProps) => {
    capturedPropsHistory.push(props);
    return <div data-testid="member-list-mock">{props.members.length}</div>;
  },
}));

function membershipFixture(
  suffix: string,
  username: string,
  displayName: string,
) {
  return {
    id: `membership-${suffix}`,
    userId: `user-${suffix}`,
    communityId: 'community-1',
    joinedAt: '2025-01-01T00:00:00Z',
    roles: [],
    user: {
      id: `user-${suffix}`,
      username,
      displayName,
      avatarUrl: null,
      status: null,
    },
  };
}

describe('MemberListContainer identity-preserving merge', () => {
  beforeEach(() => {
    capturedPropsHistory = [];
  });

  it('reuses the previous member object for members unaffected by a presence event, and creates a new one for the affected member', async () => {
    server.use(
      http.get(`${BASE_URL}/api/membership/community/community-1`, () =>
        HttpResponse.json({
          members: [
            membershipFixture('a', 'alice', 'Alice'),
            membershipFixture('b', 'bob', 'Bob'),
          ],
          continuationToken: undefined,
        }),
      ),
      http.get(`${BASE_URL}/api/presence/users/:userIds`, () =>
        HttpResponse.json({ presence: { 'user-a': false, 'user-b': false } }),
      ),
    );

    const { queryClient } = renderWithProviders(
      <MemberListContainer
        contextType={VoiceSessionType.Channel}
        contextId="channel-1"
        communityId="community-1"
        isPrivate={false}
      />,
    );

    await waitFor(() => {
      expect(screen.getByTestId('member-list-mock')).toHaveTextContent('2');
    });

    const beforeMembers = capturedPropsHistory[capturedPropsHistory.length - 1].members;
    const memberABefore = beforeMembers.find((m) => m.id === 'user-a')!;
    const memberBBefore = beforeMembers.find((m) => m.id === 'user-b')!;
    expect(memberABefore.isOnline).toBe(false);
    expect(memberBBefore.isOnline).toBe(false);

    // Same surgical patch path socket-hub uses in production: setQueryData,
    // not invalidate/refetch.
    act(() => {
      handleUserOnline({ userId: 'user-a' }, queryClient);
    });

    await waitFor(() => {
      const latest = capturedPropsHistory[capturedPropsHistory.length - 1].members;
      const latestA = latest.find((m) => m.id === 'user-a')!;
      expect(latestA.isOnline).toBe(true);
    });

    const afterMembers = capturedPropsHistory[capturedPropsHistory.length - 1].members;
    const memberAAfter = afterMembers.find((m) => m.id === 'user-a')!;
    const memberBAfter = afterMembers.find((m) => m.id === 'user-b')!;

    // The updated member gets a fresh object identity...
    expect(memberAAfter).not.toBe(memberABefore);
    // ...but the unaffected member keeps the exact same object reference,
    // so React.memo(MemberRow) can bail out of re-rendering it.
    expect(memberBAfter).toBe(memberBBefore);
    expect(memberBAfter.isOnline).toBe(false);
  });
});

describe('MemberListContainer paginated community members', () => {
  beforeEach(() => {
    capturedPropsHistory = [];
  });

  it('loads the first page, exposes hasMore, and appends the next page on load-more while preserving member identity', async () => {
    server.use(
      http.get(
        `${BASE_URL}/api/membership/community/community-1`,
        ({ request }) => {
          const url = new URL(request.url);
          const token = url.searchParams.get('continuationToken');
          if (!token) {
            // Page 1: full page with a continuation token
            return HttpResponse.json({
              members: [
                membershipFixture('a', 'alice', 'Alice'),
                membershipFixture('b', 'bob', 'Bob'),
              ],
              continuationToken: 'membership-b',
            });
          }
          // Page 2: final partial page, no token
          return HttpResponse.json({
            members: [membershipFixture('c', 'carol', 'Carol')],
            continuationToken: undefined,
          });
        },
      ),
      http.get(`${BASE_URL}/api/presence/users/:userIds`, () =>
        HttpResponse.json({
          presence: { 'user-a': false, 'user-b': false, 'user-c': false },
        }),
      ),
    );

    renderWithProviders(
      <MemberListContainer
        contextType={VoiceSessionType.Channel}
        contextId="channel-1"
        communityId="community-1"
        isPrivate={false}
      />,
    );

    // Page 1 renders with a load-more affordance
    await waitFor(() => {
      expect(screen.getByTestId('member-list-mock')).toHaveTextContent('2');
    });
    const page1Props = capturedPropsHistory[capturedPropsHistory.length - 1];
    expect(page1Props.hasMore).toBe(true);
    expect(page1Props.onLoadMore).toBeTypeOf('function');

    const memberABefore = page1Props.members.find((m) => m.id === 'user-a')!;

    // Trigger load-more (what the Show more button does in MemberList)
    act(() => {
      page1Props.onLoadMore!();
    });

    // Both pages flattened; no more pages left
    await waitFor(() => {
      expect(screen.getByTestId('member-list-mock')).toHaveTextContent('3');
    });
    const page2Props = capturedPropsHistory[capturedPropsHistory.length - 1];
    expect(page2Props.hasMore).toBe(false);
    expect(page2Props.members.map((m) => m.id)).toEqual([
      'user-a',
      'user-b',
      'user-c',
    ]);

    // Identity-preserving merge still holds across page appends: the
    // unaffected page-1 member keeps its object reference.
    const memberAAfter = page2Props.members.find((m) => m.id === 'user-a')!;
    expect(memberAAfter).toBe(memberABefore);
  });
});
