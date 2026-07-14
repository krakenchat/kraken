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

// --- Optimistic send (PR-13) ---
//
// An optimistic message is inserted with `id === clientId` and
// `sendStatus: 'pending'`. It's reconciled with the server in one of two
// ways depending on which arrives first:
//   - ack-first:  useOptimisticSendMessage's ack callback (has messageId,
//     not the full message) calls `replaceOptimisticMessage`, swapping the
//     optimistic row's identity to the real id in place.
//   - echo-first: the WS NEW_MESSAGE handler calls `prependOrReconcileOptimistic`,
//     which finds the matching optimistic row and swaps it for the full real
//     message in the SAME cache update (not remove-then-insert), so no
//     render can ever show both.
// Whichever runs first "wins" the swap; the other is then a no-op against
// an id/clientId that's already gone — see reconcileAfterSend in
// hooks/useOptimisticSendMessage.ts for the ack-side idempotency check.

/** True if a cached row is a not-yet-settled optimistic message. */
function isOptimisticRow(message: unknown): boolean {
  const status = (message as Message).sendStatus;
  return status === 'pending' || status === 'failed';
}

/**
 * Insert a WS-echoed message, reconciling it in place with a matching
 * 'pending'/'failed' optimistic row from the SAME author if one exists —
 * the echo can arrive before the sender's own ack. Falls back to a plain
 * prepend (dedup-by-id, live-edge-only — same rules as
 * `prependMessageToInfinite`) when there's no match.
 *
 * Correlates by authorId + sendStatus, not clientId: the echo payload never
 * carries clientId (it's cache-local, never sent to the server). Matches the
 * first qualifying row in the page — if a single author somehow has two
 * sends in flight at once, the "wrong" one could be picked, but that's
 * harmless: the ack-side reconciliation (`replaceOptimisticMessage` /
 * `removeOptimisticMessage`) is idempotent regardless of which optimistic
 * row this function already resolved.
 */
export function prependOrReconcileOptimistic(
  old: InfiniteData<PaginatedMessagesResponseDto> | undefined,
  message: Message,
): InfiniteData<PaginatedMessagesResponseDto> | undefined {
  if (!old) return old;
  if (isDetachedFromLiveEdge(old)) return old;
  const firstPage = old.pages[0];
  if (!firstPage) return old;
  if (firstPage.messages.some(m => m.id === message.id)) return old;

  const optimisticIndex = firstPage.messages.findIndex(
    m => isOptimisticRow(m) && m.authorId === message.authorId,
  );

  const messages = optimisticIndex >= 0
    ? firstPage.messages.map((m, i) => (i === optimisticIndex ? (message as never) : m))
    : [message as never, ...firstPage.messages];

  return {
    ...old,
    pages: [{ ...firstPage, messages }, ...old.pages.slice(1)],
  };
}

/**
 * Reconciliation: replace the optimistic row matched by `clientId` with the
 * real, server-sourced message (or server-shaped promotion of the
 * optimistic content). No-op (returns `old` unchanged) if no row with that
 * clientId is found — the echo-first race already reconciled/removed it via
 * `prependOrReconcileOptimistic`, so there's nothing left to do.
 */
export function replaceOptimisticMessage(
  old: InfiniteData<PaginatedMessagesResponseDto> | undefined,
  clientId: string,
  realMessage: Message,
): InfiniteData<PaginatedMessagesResponseDto> | undefined {
  if (!old) return old;
  let found = false;
  const pages = old.pages.map(page => ({
    ...page,
    messages: page.messages.map(m => {
      if ((m as unknown as Message).clientId === clientId) {
        found = true;
        return realMessage as never;
      }
      return m;
    }),
  }));
  if (!found) return old;
  return { ...old, pages };
}

/**
 * Remove the optimistic row matched by `clientId` without inserting
 * anything. Used when the WS echo already inserted the real message
 * (ack-after-echo — the real row already exists under its own id, so the
 * placeholder is redundant) and for the user-facing "delete failed message"
 * action.
 */
export function removeOptimisticMessage(
  old: InfiniteData<PaginatedMessagesResponseDto> | undefined,
  clientId: string,
): InfiniteData<PaginatedMessagesResponseDto> | undefined {
  if (!old) return old;
  return {
    ...old,
    pages: old.pages.map(page => ({
      ...page,
      messages: page.messages.filter(m => (m as unknown as Message).clientId !== clientId),
    })),
  };
}

/** Set `sendStatus: 'failed'` on the optimistic row matched by `clientId`. */
export function markOptimisticFailed(
  old: InfiniteData<PaginatedMessagesResponseDto> | undefined,
  clientId: string,
): InfiniteData<PaginatedMessagesResponseDto> | undefined {
  if (!old) return old;
  return {
    ...old,
    pages: old.pages.map(page => ({
      ...page,
      messages: page.messages.map(m =>
        (m as unknown as Message).clientId === clientId
          ? ({ ...(m as unknown as Message), sendStatus: 'failed' } as never)
          : m,
      ),
    })),
  };
}

/**
 * Reset a 'failed' optimistic row back to 'pending' — used at the start of
 * a retry, before the retry's send has settled. Keeps the same clientId/id
 * so no duplicate row is created.
 */
export function markOptimisticPending(
  old: InfiniteData<PaginatedMessagesResponseDto> | undefined,
  clientId: string,
): InfiniteData<PaginatedMessagesResponseDto> | undefined {
  if (!old) return old;
  return {
    ...old,
    pages: old.pages.map(page => ({
      ...page,
      messages: page.messages.map(m =>
        (m as unknown as Message).clientId === clientId
          ? ({ ...(m as unknown as Message), sendStatus: 'pending' } as never)
          : m,
      ),
    })),
  };
}

