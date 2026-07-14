/**
 * BullMQ queue names shared between producers (enqueue call sites) and
 * processors (@Processor(...) consumers). Keeping these as named constants
 * avoids typo drift between the two sides of a queue.
 */
export const MESSAGE_FANOUT_QUEUE = 'message-fanout';
export const LINK_PREVIEWS_QUEUE = 'link-previews';
