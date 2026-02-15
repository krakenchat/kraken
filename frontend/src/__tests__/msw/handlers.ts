import { http, HttpResponse } from 'msw';
import type { PaginatedMessagesResponseDto, ThreadRepliesResponseDto } from '../../api-client/types.gen';

const BASE_URL = 'http://localhost:3000';

/** Default channel messages response */
const channelMessagesResponse: PaginatedMessagesResponseDto = {
  messages: [
    {
      id: 'msw-msg-1',
      channelId: 'ch-msw',
      directMessageGroupId: null,
      authorId: 'user-1',
      spans: [],
      attachments: [],
      pendingAttachments: 0,
      reactions: [],
      replyCount: 0,
      lastReplyAt: null,
      pinned: false,
      pinnedAt: null,
      pinnedBy: null,
      sentAt: '2025-01-01T00:00:00Z',
      editedAt: null,
      deletedAt: null,
    },
  ],
  continuationToken: undefined,
};

/** Default DM messages response */
const dmMessagesResponse: PaginatedMessagesResponseDto = {
  messages: [
    {
      id: 'msw-dm-1',
      channelId: null,
      directMessageGroupId: 'dm-msw',
      authorId: 'user-2',
      spans: [],
      attachments: [],
      pendingAttachments: 0,
      reactions: [],
      replyCount: 0,
      lastReplyAt: null,
      pinned: false,
      pinnedAt: null,
      pinnedBy: null,
      sentAt: '2025-01-01T00:00:00Z',
      editedAt: null,
      deletedAt: null,
    },
  ],
  continuationToken: undefined,
};

/** Default thread replies response */
const threadRepliesResponse: ThreadRepliesResponseDto = {
  replies: [
    {
      id: 'msw-reply-1',
      channelId: 'ch-msw',
      directMessageGroupId: null,
      authorId: 'user-1',
      spans: [],
      attachments: [],
      pendingAttachments: 0,
      reactions: [],
      replyCount: 0,
      lastReplyAt: null,
      pinned: false,
      pinnedAt: null,
      pinnedBy: null,
      sentAt: '2025-01-01T00:00:00Z',
      editedAt: null,
      deletedAt: null,
      parentMessageId: 'parent-msw',
    } as never,
  ],
  continuationToken: undefined,
};

/** Auth handlers */
const authHandlers = [
  http.post(`${BASE_URL}/api/auth/login`, async ({ request }) => {
    const body = await request.json() as { username: string; password: string };
    if (body.username === 'invalid') {
      return HttpResponse.json({ message: 'Invalid credentials' }, { status: 401 });
    }
    return HttpResponse.json({
      accessToken: 'mock-access-token',
      refreshToken: 'mock-refresh-token',
    });
  }),
];

/** User handlers */
const userHandlers = [
  http.post(`${BASE_URL}/api/users`, () => {
    return HttpResponse.json({
      id: 'new-user-1',
      username: 'newuser',
      email: 'newuser@test.com',
    });
  }),

  http.get(`${BASE_URL}/api/users/profile`, () => {
    return HttpResponse.json({
      id: 'current-user-1',
      username: 'testuser',
      displayName: 'Test User',
      email: 'test@test.com',
      avatarUrl: null,
    });
  }),
];

/** Channel handlers */
const channelHandlers = [
  http.get(`${BASE_URL}/api/channels/community/:communityId`, () => {
    return HttpResponse.json([
      {
        id: 'ch-1',
        name: 'general',
        communityId: 'community-1',
        type: 'TEXT',
        isPrivate: false,
        createdAt: '2025-01-01T00:00:00Z',
        position: 0,
      },
      {
        id: 'ch-2',
        name: 'voice-chat',
        communityId: 'community-1',
        type: 'VOICE',
        isPrivate: false,
        createdAt: '2025-01-01T00:00:00Z',
        position: 1,
      },
    ]);
  }),
];

/** DM handlers */
const dmHandlers = [
  http.get(`${BASE_URL}/api/direct-messages`, () => {
    return HttpResponse.json([]);
  }),

  http.post(`${BASE_URL}/api/direct-messages`, () => {
    return HttpResponse.json({
      id: 'new-dm-1',
      name: null,
      isGroup: false,
      createdAt: new Date().toISOString(),
      members: [],
    });
  }),

  http.get(`${BASE_URL}/api/direct-messages/:id`, ({ params }) => {
    return HttpResponse.json({
      id: params.id,
      name: null,
      isGroup: false,
      createdAt: '2025-01-01T00:00:00Z',
      members: [
        {
          id: 'member-1',
          userId: 'current-user-1',
          joinedAt: '2025-01-01T00:00:00Z',
          user: { id: 'current-user-1', username: 'testuser', displayName: 'Test User', avatarUrl: null },
        },
        {
          id: 'member-2',
          userId: 'other-user-1',
          joinedAt: '2025-01-01T00:00:00Z',
          user: { id: 'other-user-1', username: 'otheruser', displayName: 'Other User', avatarUrl: null },
        },
      ],
    });
  }),

  http.get(`${BASE_URL}/api/livekit/connection-info`, () => {
    return HttpResponse.json({ url: 'ws://localhost:7880' });
  }),
];

export const handlers = [
  http.get(`${BASE_URL}/api/messages/channel/:channelId`, () => {
    return HttpResponse.json(channelMessagesResponse);
  }),

  http.get(`${BASE_URL}/api/direct-messages/:id/messages`, () => {
    return HttpResponse.json(dmMessagesResponse);
  }),

  http.get(`${BASE_URL}/api/threads/:parentMessageId/replies`, () => {
    return HttpResponse.json(threadRepliesResponse);
  }),

  ...authHandlers,
  ...userHandlers,
  ...channelHandlers,
  ...dmHandlers,
];
