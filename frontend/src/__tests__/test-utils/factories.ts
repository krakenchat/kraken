import type { InfiniteData } from '@tanstack/react-query';
import type { PaginatedMessagesResponseDto, ThreadRepliesResponseDto, EnrichedThreadReplyDto } from '../../api-client/types.gen';
import type { Message, Reaction } from '../../types/message.type';

let counter = 0;

function nextId(): string {
  return `msg-${++counter}`;
}

export function resetFactoryCounter() {
  counter = 0;
}

export function createMessage(overrides: Partial<Message> = {}): Message {
  const id = overrides.id ?? nextId();
  return {
    id,
    channelId: 'channel-1',
    authorId: 'user-1',
    spans: [],
    attachments: [],
    reactions: [],
    sentAt: new Date().toISOString(),
    ...overrides,
  };
}

/**
 * Creates a message that satisfies both Message and EnrichedMessageDto at runtime.
 * Use `as never` when inserting into typed caches (same pattern as production code).
 */
export function createEnrichedMessage(overrides: Partial<Message> = {}): Message {
  return createMessage({
    pinned: false,
    pinnedAt: undefined,
    pinnedBy: undefined,
    replyCount: 0,
    lastReplyAt: undefined,
    pendingAttachments: 0,
    ...overrides,
  });
}

export function createThreadReply(overrides: Partial<EnrichedThreadReplyDto> = {}): EnrichedThreadReplyDto {
  const id = overrides.id ?? nextId();
  return {
    id,
    channelId: 'channel-1',
    directMessageGroupId: null,
    authorId: 'user-1',
    spans: [],
    attachments: [],
    pendingAttachments: 0,
    reactions: [],
    sentAt: new Date().toISOString(),
    editedAt: null,
    deletedAt: null,
    pinned: false,
    pinnedAt: null,
    pinnedBy: null,
    replyCount: 0,
    lastReplyAt: null,
    parentMessageId: 'parent-1',
    ...overrides,
  } as EnrichedThreadReplyDto;
}

export function createReaction(overrides: Partial<Reaction> = {}): Reaction {
  return {
    emoji: '👍',
    userIds: ['user-1'],
    ...overrides,
  };
}

/** Single-page InfiniteData for channel messages */
export function createInfiniteData(
  messages: Message[],
  continuationToken?: string,
): InfiniteData<PaginatedMessagesResponseDto> {
  return {
    pages: [{ messages: messages as never[], continuationToken }],
    pageParams: [undefined],
  };
}

/** Multi-page InfiniteData for channel messages */
export function createMultiPageInfiniteData(
  pages: { messages: Message[]; continuationToken?: string }[],
): InfiniteData<PaginatedMessagesResponseDto> {
  return {
    pages: pages.map(p => ({
      messages: p.messages as never[],
      continuationToken: p.continuationToken,
    })),
    pageParams: pages.map((_, i) => (i === 0 ? undefined : `token-${i}`)),
  };
}

/** Flat PaginatedMessagesResponseDto for DMs */
export function createFlatData(
  messages: Message[],
  continuationToken?: string,
): PaginatedMessagesResponseDto {
  return {
    messages: messages as never[],
    continuationToken,
  };
}

/** ThreadRepliesResponseDto */
export function createThreadRepliesData(
  replies: EnrichedThreadReplyDto[],
  continuationToken?: string,
): ThreadRepliesResponseDto {
  return {
    replies,
    continuationToken,
  };
}
