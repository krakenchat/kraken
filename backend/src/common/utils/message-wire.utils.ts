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
 * This cast does not change what is actually emitted — it hands the exact
 * same runtime value to `.emit()` that was passed in, just relabeled to
 * satisfy the static type at the WebsocketService boundary. It does NOT
 * claim the resulting wire bytes match the shared type's documented shape
 * (e.g. Date -> ISO-string correctness across the Redis adapter is a
 * separate, deferred concern — see the Task 3 report).
 *
 * The parameter is constrained to values that are at least plausibly a
 * message (has `id`, `spans`, `sentAt`) rather than `unknown`, so this
 * can't silently launder an unrelated object into a `Message`.
 */
export function toWireMessage<
  T extends { id: string; spans: unknown[]; sentAt: Date },
>(message: T): Message {
  return message as unknown as Message;
}
