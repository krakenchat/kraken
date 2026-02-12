import type { InfiniteData } from '@tanstack/react-query';
import type { PaginatedMessagesResponseDto } from '../api-client/types.gen';
import type { Message } from '../types/message.type';

// `Message` (from @kraken/shared) and `EnrichedMessageDto` (generated API types) are
// structurally identical but TypeScript treats them as distinct. `as never` is the
// minimal assertion to bridge between WebSocket payloads and the TQ cache type.

// --- Channel (InfiniteData) updaters ---

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

// --- DM (flat PaginatedMessagesResponseDto) updaters ---

export function prependMessageToFlat(
  old: PaginatedMessagesResponseDto | undefined,
  message: Message,
): PaginatedMessagesResponseDto | undefined {
  if (!old) return old;
  if (old.messages.some(m => m.id === message.id)) return old;
  return { ...old, messages: [message as never, ...old.messages] };
}

export function updateMessageInFlat(
  old: PaginatedMessagesResponseDto | undefined,
  message: Message,
): PaginatedMessagesResponseDto | undefined {
  if (!old) return old;
  return {
    ...old,
    messages: old.messages.map(m => m.id === message.id ? message as never : m),
  };
}

export function deleteMessageFromFlat(
  old: PaginatedMessagesResponseDto | undefined,
  messageId: string,
): PaginatedMessagesResponseDto | undefined {
  if (!old) return old;
  return { ...old, messages: old.messages.filter(m => m.id !== messageId) };
}

/** Find a message in a flat paginated response */
export function findMessageInFlat(
  data: PaginatedMessagesResponseDto | undefined,
  messageId: string,
): Message | undefined {
  if (!data) return undefined;
  const found = data.messages.find(m => m.id === messageId);
  return found as unknown as Message | undefined;
}
