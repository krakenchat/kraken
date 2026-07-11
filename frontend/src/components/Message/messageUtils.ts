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

/**
 * True when a message's entire content is a single `media.tenor.com` URL
 * (i.e. sent via the GIF picker) AND there's a matching link preview with an
 * image. Callers can use this to hide the redundant raw URL text and show
 * only the rendered preview image — Discord-style GIF messages.
 */
export function isSoleTenorGifLink(message: MessageType): boolean {
  if (message.attachments.length > 0) return false;
  if (message.spans.length !== 1) return false;

  const [span] = message.spans;
  if (span.type !== SpanType.PLAINTEXT) return false;

  const text = span.text?.trim();
  if (!text) return false;

  let url: URL;
  try {
    url = new URL(text);
  } catch {
    return false;
  }
  if (url.hostname !== "media.tenor.com") return false;

  return !!message.linkPreviews?.some(
    (preview) => preview.url === text && !!preview.imageUrl,
  );
}
