/**
 * Message Utilities
 *
 * Helper functions for message component logic.
 */

import type { Message as MessageType } from "../../types/message.type";
import { SpanType } from "../../types/message.type";

/**
 * Check if a message mentions the specified user
 * Returns true if the message contains a direct @mention or @here/@channel
 */
export function isUserMentioned(message: MessageType, userId: string | undefined): boolean {
  if (!userId) return false;

  return message.spans.some(span => {
    if (span.type === SpanType.USER_MENTION && span.userId === userId) {
      return true;
    }
    if (span.type === SpanType.SPECIAL_MENTION && (span.specialKind === 'here' || span.specialKind === 'channel')) {
      // User is mentioned by @here/@channel if they are in the channel
      // For now, we'll assume they are since they can see the message
      return true;
    }
    return false;
  });
}
