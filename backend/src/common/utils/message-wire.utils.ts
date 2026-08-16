import { Message } from '@semaphore-chat/shared';

/**
 * TODO(any-cleanup): Casts an enriched Prisma message object (from
 * `MessagesService.create()` / `enrichMessageWithFileMetadata()`, or an
 * equivalent hand-built re-read like `LinkPreviewsService.broadcastMessage`)
 * to the shared wire `Message` DTO for WebsocketService emits.
 *
 * The two shapes structurally diverge in ways that go deeper than a single
 * field: Prisma's `SpanType`/`ChannelType` enums are distinct TS types from
 * the shared string-literal enums (identical runtime values, different
 * nominal types), and several columns are raw `Date` / `null` on the Prisma
 * side where the shared DTO documents the post-JSON-serialization wire
 * shape (`string` timestamps, `undefined`-style optionals). Safely closing
 * that gap requires a full field-by-field Prisma -> wire-DTO mapper —
 * a genuine refactor, out of scope for a typing-only cleanup pass (see the
 * Task 3 report for the full list of call sites relying on this cast).
 *
 * The two shapes are wire-compatible: Socket.IO's JSON serialization
 * produces identical bytes whether the raw Prisma object or a "properly"
 * converted one is handed to `.emit()` (Dates serialize to the same ISO
 * string either way; the enum values match 1:1). This cast therefore does
 * not change what is actually emitted — it only satisfies the static type
 * at the WebsocketService boundary.
 */
export function toWireMessage(message: unknown): Message {
  return message as Message;
}
