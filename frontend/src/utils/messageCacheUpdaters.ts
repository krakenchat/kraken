import type { InfiniteData } from '@tanstack/react-query';
import type { PaginatedMessagesResponseDto } from '../api-client/types.gen';
import type { Message } from '../types/message.type';

// `Message` (from @semaphore-chat/shared) and `EnrichedMessageDto` (generated API types) are
// structurally identical but TypeScript treats them as distinct. `as never` is the
// minimal assertion to bridge between WebSocket payloads and the TQ cache type.

// --- InfiniteData updaters (used by both channel and DM caches) ---

/**
 * True when the infinite window no longer contains the live newest page.
 * The live page is fetched with pageParam '' (initialPageParam); after
 * MESSAGE_MAX_PAGES eviction the first stored param is an older cursor.
 * Test factories use `undefined` for the live page — treat both '' and
 * null/undefined as "live".
 */
export function isDetachedFromLiveEdge(
  data: InfiniteData<PaginatedMessagesResponseDto> | undefined,
): boolean {
  const first = data?.pageParams[0];
  return first != null && first !== '';
}

export function prependMessageToInfinite(
  old: InfiniteData<PaginatedMessagesResponseDto> | undefined,
  message: Message,
): InfiniteData<PaginatedMessagesResponseDto> | undefined {
  if (!old) return old;
  // Never insert into a detached window: pages[0] is not the live newest
  // page, so prepending here would splice the message into mid-history.
  if (isDetachedFromLiveEdge(old)) return old;
  const firstPage = old.pages[0];
  if (!firstPage) return old;
  if (firstPage.messages.some(m => m.id === message.id)) return old;
  return {
    ...old,
    pages: [
      { ...firstPage, messages: [message as never, ...firstPage.messages] },
      ...old.pages.slice(1),
    ],
  };
}

export function updateMessageInInfinite(
  old: InfiniteData<PaginatedMessagesResponseDto> | undefined,
  message: Message,
): InfiniteData<PaginatedMessagesResponseDto> | undefined {
  if (!old) return old;
  return {
    ...old,
    pages: old.pages.map(page => ({
      ...page,
      messages: page.messages.map(m => m.id === message.id ? message as never : m),
    })),
  };
}

export function deleteMessageFromInfinite(
  old: InfiniteData<PaginatedMessagesResponseDto> | undefined,
  messageId: string,
): InfiniteData<PaginatedMessagesResponseDto> | undefined {
  if (!old) return old;
  return {
    ...old,
    pages: old.pages.map(page => ({
      ...page,
      messages: page.messages.filter(m => m.id !== messageId),
    })),
  };
}

/** Find a message across all pages of an infinite query */
export function findMessageInInfinite(
  data: InfiniteData<PaginatedMessagesResponseDto> | undefined,
  messageId: string,
): Message | undefined {
  if (!data) return undefined;
  for (const page of data.pages) {
    const found = page.messages.find(m => m.id === messageId);
    if (found) return found as unknown as Message;
  }
  return undefined;
}

