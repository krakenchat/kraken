/**
 * Message Utilities
 *
 * Helper functions for message component logic.
 */

import type { Message as MessageType } from "../../types/message.type";
import { SpanType } from "../../types/message.type";

/**
 * Check if a message mentions the specified user
 * Returns true if the message contains a direct @mention, @here/@channel, or alias group mention
 *
 * @param message - The message to check
 * @param userId - The user ID to check for mentions
 * @param userAliasGroupIds - Optional array of alias group IDs the user belongs to
 */
export function isUserMentioned(
  message: MessageType,
  userId: string | undefined,
  userAliasGroupIds?: string[]
): boolean {
  if (!userId) return false;

  return message.spans.some(span => {
    // Direct user mention
    if (span.type === SpanType.USER_MENTION && span.userId === userId) {
      return true;
    }
    // Special mentions (@here, @channel)
    if (span.type === SpanType.SPECIAL_MENTION && (span.specialKind === 'here' || span.specialKind === 'channel')) {
      // User is mentioned by @here/@channel if they are in the channel
      // For now, we'll assume they are since they can see the message
      return true;
    }
    // Alias group mention - check if user is in the mentioned group
    if (span.type === SpanType.ALIAS_MENTION && span.aliasId) {
      // If we have the user's alias group IDs, check for membership
      if (userAliasGroupIds && userAliasGroupIds.includes(span.aliasId)) {
        return true;
      }
      // If we don't have the info, we can't determine membership
      // The backend handles the actual notification
    }
    return false;
  });
}
