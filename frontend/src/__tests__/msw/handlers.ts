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
];
