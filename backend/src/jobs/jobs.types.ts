import { ServerEvents } from '@semaphore-chat/shared';

/**
 * Payload for the `message-fanout` queue. Deliberately minimal — the
 * processor re-reads the message (with spans/author) from the DB rather
 * than trusting a payload snapshot, so it always fans out against the
 * message's current state even if the job sat in the queue for a while.
 */
export interface MessageFanoutJobData {
  messageId: string;
}

/**
 * Payload for the `link-previews` queue. `room`/`event` are carried through
 * because they describe *where* to broadcast the re-processed message, not
 * its content — the processor re-reads spans from the DB for the same
 * always-current-state reason as message-fanout.
 */
export interface LinkPreviewJobData {
  messageId: string;
  room: string;
  event: ServerEvents;
}
