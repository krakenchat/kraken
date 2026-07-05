import { SpanType } from '@prisma/client';
import { sanitizeEmojiSpans } from './emoji-span.utils';

/** Minimal db double matching the surface sanitizeEmojiSpans consumes. */
function createDb(overrides?: {
  communityId?: string | null;
  validEmojiIds?: string[];
}) {
  return {
    channel: {
      findUnique: jest
        .fn()
        .mockResolvedValue(
          overrides && 'communityId' in overrides
            ? { communityId: overrides.communityId ?? null }
            : { communityId: 'community-1' },
        ),
    },
    customEmoji: {
      findMany: jest
        .fn()
        .mockResolvedValue(
          (overrides?.validEmojiIds ?? []).map((id) => ({ id })),
        ),
    },
  };
}

const plaintext = (text: string) => ({
  type: SpanType.PLAINTEXT,
  text,
  emojiId: null,
});

const emoji = (text: string, emojiId: string | null) => ({
  type: SpanType.EMOJI,
  text,
  emojiId,
});

describe('sanitizeEmojiSpans', () => {
  it('is a no-op (no DB round-trips) when there are no EMOJI spans', async () => {
    const db = createDb();
    const spans = [plaintext('hello'), plaintext('world')];

    const result = await sanitizeEmojiSpans(db, spans, 'channel-1');

    expect(result).toBe(spans);
    expect(db.channel.findUnique).not.toHaveBeenCalled();
    expect(db.customEmoji.findMany).not.toHaveBeenCalled();
  });

  it('keeps EMOJI spans whose emojiId belongs to the channel community', async () => {
    const db = createDb({ validEmojiIds: ['emoji-1'] });
    const spans = [plaintext('hi '), emoji(':smile:', 'emoji-1')];

    const result = await sanitizeEmojiSpans(db, spans, 'channel-1');

    expect(result[1]).toEqual(emoji(':smile:', 'emoji-1'));
    expect(db.customEmoji.findMany).toHaveBeenCalledWith({
      where: { id: { in: ['emoji-1'] }, communityId: 'community-1' },
      select: { id: true },
    });
  });

  it('downgrades EMOJI spans with a non-existent emojiId to PLAINTEXT, keeping text', async () => {
    const db = createDb({ validEmojiIds: [] });
    const spans = [emoji(':ghost:', 'does-not-exist')];

    const result = await sanitizeEmojiSpans(db, spans, 'channel-1');

    expect(result[0]).toEqual({
      type: SpanType.PLAINTEXT,
      text: ':ghost:',
      emojiId: null,
    });
  });

  it("downgrades EMOJI spans referencing another community's emoji", async () => {
    // findMany scoped by communityId returns nothing for the foreign emoji
    const db = createDb({ validEmojiIds: [] });
    const spans = [emoji(':foreign:', 'emoji-from-other-community')];

    const result = await sanitizeEmojiSpans(db, spans, 'channel-1');

    expect(result[0].type).toBe(SpanType.PLAINTEXT);
    expect(result[0].emojiId).toBeNull();
  });

  it('downgrades an EMOJI span with a null emojiId without querying emojis', async () => {
    const db = createDb();
    const spans = [emoji(':empty:', null)];

    const result = await sanitizeEmojiSpans(db, spans, 'channel-1');

    expect(result[0].type).toBe(SpanType.PLAINTEXT);
    expect(db.customEmoji.findMany).not.toHaveBeenCalled();
  });

  it('downgrades all EMOJI spans in a DM (no channelId, no community)', async () => {
    const db = createDb();
    const spans = [emoji(':smile:', 'emoji-1')];

    const result = await sanitizeEmojiSpans(db, spans, null);

    expect(result[0]).toEqual({
      type: SpanType.PLAINTEXT,
      text: ':smile:',
      emojiId: null,
    });
    expect(db.channel.findUnique).not.toHaveBeenCalled();
    expect(db.customEmoji.findMany).not.toHaveBeenCalled();
  });

  it('downgrades all EMOJI spans when the channel has no community', async () => {
    const db = createDb({ communityId: null });
    const spans = [emoji(':smile:', 'emoji-1')];

    const result = await sanitizeEmojiSpans(db, spans, 'channel-1');

    expect(result[0].type).toBe(SpanType.PLAINTEXT);
    expect(db.customEmoji.findMany).not.toHaveBeenCalled();
  });

  it('validates a mix: keeps valid, downgrades invalid, leaves plaintext untouched', async () => {
    const db = createDb({ validEmojiIds: ['good'] });
    const spans = [
      plaintext('a '),
      emoji(':good:', 'good'),
      plaintext(' b '),
      emoji(':bad:', 'bad'),
    ];

    const result = await sanitizeEmojiSpans(db, spans, 'channel-1');

    expect(result[0]).toEqual(plaintext('a '));
    expect(result[1]).toEqual(emoji(':good:', 'good'));
    expect(result[2]).toEqual(plaintext(' b '));
    expect(result[3]).toEqual({
      type: SpanType.PLAINTEXT,
      text: ':bad:',
      emojiId: null,
    });
  });
});
