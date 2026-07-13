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

let capturedMembersHistory: MemberData[][] = [];
vi.mock('../../components/Message/MemberList', () => ({
  default: (props: { members: MemberData[] }) => {
    capturedMembersHistory.push(props.members);
    return <div data-testid="member-list-mock">{props.members.length}</div>;
  },
}));

describe('MemberListContainer identity-preserving merge', () => {
  beforeEach(() => {
    capturedMembersHistory = [];
  });

  it('reuses the previous member object for members unaffected by a presence event, and creates a new one for the affected member', async () => {
    server.use(
      http.get(`${BASE_URL}/api/membership/community/community-1`, () =>
        HttpResponse.json([
          {
            id: 'membership-a',
            userId: 'user-a',
            communityId: 'community-1',
            joinedAt: '2025-01-01T00:00:00Z',
            roles: [],
            user: {
              id: 'user-a',
              username: 'alice',
              displayName: 'Alice',
              avatarUrl: null,
              status: null,
            },
          },
          {
            id: 'membership-b',
            userId: 'user-b',
            communityId: 'community-1',
            joinedAt: '2025-01-01T00:00:00Z',
            roles: [],
            user: {
              id: 'user-b',
              username: 'bob',
              displayName: 'Bob',
              avatarUrl: null,
              status: null,
            },
          },
        ]),
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

    const beforeMembers = capturedMembersHistory[capturedMembersHistory.length - 1];
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
      const latest = capturedMembersHistory[capturedMembersHistory.length - 1];
      const latestA = latest.find((m) => m.id === 'user-a')!;
      expect(latestA.isOnline).toBe(true);
    });

    const afterMembers = capturedMembersHistory[capturedMembersHistory.length - 1];
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
