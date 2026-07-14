export { SpanType, type Span, type Reaction, type FileMetadata, type LinkPreview } from '@semaphore-chat/shared';
import type { Message as SharedMessage } from '@semaphore-chat/shared';

/** Lifecycle status for an optimistically-sent message (PR-13). */
export type SendStatus = 'pending' | 'failed';

/**
 * Frontend message type. Extends the shared wire type (`@semaphore-chat/shared`)
 * with two fields used for optimistic sending:
 *
 * - `sendStatus`: `'pending'` while a locally-created message is waiting for
 *   the server ack/echo, `'failed'` if the send timed out or errored.
 *   Absent (`undefined`) for every real, server-sourced message.
 * - `clientId`: the id the client generated for an optimistic message
 *   (equal to its `id` while pending/failed — see useOptimisticSendMessage).
 *   Used to correlate an optimistic cache entry with its eventual ack/echo
 *   so a retry or reconciliation can find the right row without relying on
 *   `id` staying stable.
 *
 * Both fields are CACHE-LOCAL ONLY — they live in the TanStack Query cache
 * and are never included in an outgoing socket payload. `NewMessagePayload`
 * (hooks/useSendMessage.ts) explicitly omits them from the wire type.
 */
export interface Message extends SharedMessage {
  sendStatus?: SendStatus;
  clientId?: string;
}
