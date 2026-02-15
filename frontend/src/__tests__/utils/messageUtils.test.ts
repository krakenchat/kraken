import { describe, it, expect } from 'vitest';
import { isUserMentioned } from '../../components/Message/messageUtils';
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
