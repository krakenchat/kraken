import type { InfiniteData } from '@tanstack/react-query';
import type { PaginatedMessagesResponseDto } from '../api-client/types.gen';
import type { Message } from '../types/message.type';

// `Message` (from @kraken/shared) and `EnrichedMessageDto` (generated API types) are
// structurally identical but TypeScript treats them as distinct. `as never` is the
// minimal assertion to bridge between WebSocket payloads and the TQ cache type.

// --- InfiniteData updaters (used by both channel and DM caches) ---

export function prependMessageToInfinite(
  old: InfiniteData<PaginatedMessagesResponseDto> | undefined,
  message: Message,
): InfiniteData<PaginatedMessagesResponseDto> | undefined {
  if (!old) return old;
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

