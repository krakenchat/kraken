import { $Enums, SpanType } from '@prisma/client';

interface EmojiSpanLike {
  type: $Enums.SpanType;
  emojiId?: string | null;
}

/** Minimal Prisma-client surface needed for emoji span validation. */
interface EmojiSpanDb {
  channel: {
    findUnique(args: {
      where: { id: string };
      select: { communityId: true };
    }): Promise<{ communityId: string | null } | null>;
  };
  customEmoji: {
    findMany(args: {
      where: { id: { in: string[] }; communityId: string };
      select: { id: true };
    }): Promise<{ id: string }[]>;
  };
}

/**
 * Validate EMOJI spans' `emojiId` against the target channel's community
 * before persisting.
 *
 * Without this, a hand-crafted EMOJI span referencing a non-existent emoji
 * hits the `MessageSpan.emojiId` FK (Prisma P2003) and surfaces as a 500,
 * and a valid emoji from a *different* community would leak cross-community.
 *
 * Invalid EMOJI spans are converted to PLAINTEXT (keeping their
 * `:shortcode:` text) rather than rejecting the whole message. In DMs
 * (no channel) all EMOJI spans are converted.
 *
 * No-op (no DB round-trips) when the message contains no EMOJI spans.
 */
export async function sanitizeEmojiSpans<T extends EmojiSpanLike>(
  db: EmojiSpanDb,
  spans: T[],
  channelId: string | null | undefined,
): Promise<T[]> {
  if (!spans.some((s) => s.type === SpanType.EMOJI)) return spans;

  const emojiIds = [
    ...new Set(
      spans
        .filter((s) => s.type === SpanType.EMOJI && s.emojiId)
        .map((s) => s.emojiId as string),
    ),
  ];

  let validIds = new Set<string>();
  if (channelId && emojiIds.length > 0) {
    const channel = await db.channel.findUnique({
      where: { id: channelId },
      select: { communityId: true },
    });
    if (channel?.communityId) {
      const emojis = await db.customEmoji.findMany({
        where: { id: { in: emojiIds }, communityId: channel.communityId },
        select: { id: true },
      });
      validIds = new Set(emojis.map((e) => e.id));
    }
  }

  return spans.map((s) =>
    s.type === SpanType.EMOJI && (!s.emojiId || !validIds.has(s.emojiId))
      ? { ...s, type: SpanType.PLAINTEXT, emojiId: null }
      : s,
  );
}
