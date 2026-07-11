import { describe, it, expect } from 'vitest';
import { isUserMentioned, isSoleTenorGifLink } from '../../components/Message/messageUtils';
import { SpanType } from '../../types/message.type';
import { createMessage } from '../test-utils/factories';

describe('isUserMentioned', () => {
  it('returns true for direct USER_MENTION with matching userId', () => {
    const message = createMessage({
      spans: [{ type: SpanType.USER_MENTION, text: '@alice', userId: 'user-42' }],
    });
    expect(isUserMentioned(message, 'user-42')).toBe(true);
  });

  it('returns true for SPECIAL_MENTION @here', () => {
    const message = createMessage({
      spans: [{ type: SpanType.SPECIAL_MENTION, text: '@here', specialKind: 'here' }],
    });
    expect(isUserMentioned(message, 'any-user')).toBe(true);
  });

  it('returns true for SPECIAL_MENTION @channel', () => {
    const message = createMessage({
      spans: [{ type: SpanType.SPECIAL_MENTION, text: '@channel', specialKind: 'channel' }],
    });
    expect(isUserMentioned(message, 'any-user')).toBe(true);
  });

  it('returns true for ALIAS_MENTION with matching group ID in userAliasGroupIds', () => {
    const message = createMessage({
      spans: [{ type: SpanType.ALIAS_MENTION, text: '@devs', aliasId: 'alias-1' }],
    });
    expect(isUserMentioned(message, 'user-42', ['alias-1', 'alias-2'])).toBe(true);
  });

  it('returns false for ALIAS_MENTION without userAliasGroupIds', () => {
    const message = createMessage({
      spans: [{ type: SpanType.ALIAS_MENTION, text: '@devs', aliasId: 'alias-1' }],
    });
    expect(isUserMentioned(message, 'user-42')).toBe(false);
  });

  it('returns false when there are no mention spans', () => {
    const message = createMessage({
      spans: [{ type: SpanType.PLAINTEXT, text: 'hello world' }],
    });
    expect(isUserMentioned(message, 'user-42')).toBe(false);
  });

  it('returns false when userId is undefined', () => {
    const message = createMessage({
      spans: [{ type: SpanType.USER_MENTION, text: '@alice', userId: 'user-42' }],
    });
    expect(isUserMentioned(message, undefined)).toBe(false);
  });

  it('returns false for USER_MENTION with different userId', () => {
    const message = createMessage({
      spans: [{ type: SpanType.USER_MENTION, text: '@alice', userId: 'user-42' }],
    });
    expect(isUserMentioned(message, 'user-99')).toBe(false);
  });
});

describe('isSoleTenorGifLink', () => {
  const tenorUrl = 'https://media.tenor.com/abc123/cat.gif';

  it('returns true for a sole media.tenor.com URL with a matching image preview', () => {
    const message = createMessage({
      spans: [{ type: SpanType.PLAINTEXT, text: tenorUrl }],
      linkPreviews: [{ url: tenorUrl, imageUrl: tenorUrl, siteName: 'media.tenor.com' }],
    });
    expect(isSoleTenorGifLink(message)).toBe(true);
  });

  it('returns false when there is no link preview', () => {
    const message = createMessage({
      spans: [{ type: SpanType.PLAINTEXT, text: tenorUrl }],
    });
    expect(isSoleTenorGifLink(message)).toBe(false);
  });

  it('returns false when the link preview has no imageUrl', () => {
    const message = createMessage({
      spans: [{ type: SpanType.PLAINTEXT, text: tenorUrl }],
      linkPreviews: [{ url: tenorUrl, siteName: 'media.tenor.com' }],
    });
    expect(isSoleTenorGifLink(message)).toBe(false);
  });

  it('returns false for a non-Tenor URL', () => {
    const otherUrl = 'https://example.com/image.gif';
    const message = createMessage({
      spans: [{ type: SpanType.PLAINTEXT, text: otherUrl }],
      linkPreviews: [{ url: otherUrl, imageUrl: otherUrl }],
    });
    expect(isSoleTenorGifLink(message)).toBe(false);
  });

  it('returns false when there is more than one span', () => {
    const message = createMessage({
      spans: [
        { type: SpanType.PLAINTEXT, text: 'check this out ' },
        { type: SpanType.PLAINTEXT, text: tenorUrl },
      ],
      linkPreviews: [{ url: tenorUrl, imageUrl: tenorUrl }],
    });
    expect(isSoleTenorGifLink(message)).toBe(false);
  });

  it('returns false when the span has surrounding text besides the URL', () => {
    const message = createMessage({
      spans: [{ type: SpanType.PLAINTEXT, text: `look at this ${tenorUrl}` }],
      linkPreviews: [{ url: tenorUrl, imageUrl: tenorUrl }],
    });
    expect(isSoleTenorGifLink(message)).toBe(false);
  });

  it('returns false when the message has attachments', () => {
    const message = createMessage({
      spans: [{ type: SpanType.PLAINTEXT, text: tenorUrl }],
      linkPreviews: [{ url: tenorUrl, imageUrl: tenorUrl }],
      attachments: [
        { id: 'file-1', filename: 'a.png', mimeType: 'image/png', fileType: 'IMAGE', size: 10 },
      ],
    });
    expect(isSoleTenorGifLink(message)).toBe(false);
  });

  it('returns false for a non-PLAINTEXT sole span', () => {
    const message = createMessage({
      spans: [{ type: SpanType.USER_MENTION, text: tenorUrl, userId: 'user-1' }],
      linkPreviews: [{ url: tenorUrl, imageUrl: tenorUrl }],
    });
    expect(isSoleTenorGifLink(message)).toBe(false);
  });
});
