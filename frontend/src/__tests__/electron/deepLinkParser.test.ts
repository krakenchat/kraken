import { describe, it, expect } from 'vitest';
import {
  parseDeepLink,
  extractDeepLinkUrls,
  DEEP_LINK_SCHEME,
  DEEP_LINK_PROTOCOL,
} from '../../../electron/deep-link-parser';

const COMMUNITY_ID = 'a1b2c3d4-1111-4222-8333-444455556666';
const CHANNEL_ID = 'b2c3d4e5-2222-4333-8444-555566667777';
const DM_GROUP_ID = 'c3d4e5f6-3333-4444-8555-666677778888';
const INVITE_CODE = 'AbCd12_-xyZ9';

describe('deep-link-parser', () => {
  describe('constants', () => {
    it('DEEP_LINK_SCHEME is DEEP_LINK_PROTOCOL + ":"', () => {
      expect(DEEP_LINK_SCHEME).toBe(`${DEEP_LINK_PROTOCOL}:`);
    });
  });

  describe('valid forms', () => {
    it('parses a community route', () => {
      expect(parseDeepLink(`semaphore://community/${COMMUNITY_ID}`)).toEqual({
        type: 'community',
        communityId: COMMUNITY_ID,
      });
    });

    it('parses a community route with a trailing slash', () => {
      expect(parseDeepLink(`semaphore://community/${COMMUNITY_ID}/`)).toEqual({
        type: 'community',
        communityId: COMMUNITY_ID,
      });
    });

    it('parses a channel route', () => {
      expect(
        parseDeepLink(`semaphore://community/${COMMUNITY_ID}/channel/${CHANNEL_ID}`)
      ).toEqual({
        type: 'channel',
        communityId: COMMUNITY_ID,
        channelId: CHANNEL_ID,
      });
    });

    it('parses the bare DM inbox route (no id)', () => {
      expect(parseDeepLink('semaphore://direct-messages')).toEqual({ type: 'dm-inbox' });
      expect(parseDeepLink('semaphore://direct-messages/')).toEqual({ type: 'dm-inbox' });
    });

    it('parses a DM group route', () => {
      expect(parseDeepLink(`semaphore://direct-messages/${DM_GROUP_ID}`)).toEqual({
        type: 'dm',
        dmGroupId: DM_GROUP_ID,
      });
    });

    it('parses an invite route', () => {
      expect(parseDeepLink(`semaphore://join/${INVITE_CODE}`)).toEqual({
        type: 'invite',
        inviteCode: INVITE_CODE,
      });
    });

    it('is case-insensitive on the scheme (URL parser lowercases protocol)', () => {
      expect(parseDeepLink(`SEMAPHORE://community/${COMMUNITY_ID}`)).toEqual({
        type: 'community',
        communityId: COMMUNITY_ID,
      });
    });

    it('is case-insensitive on the host', () => {
      expect(parseDeepLink(`semaphore://Community/${COMMUNITY_ID}`)).toEqual({
        type: 'community',
        communityId: COMMUNITY_ID,
      });
    });

    it('ignores an unrelated query string and fragment', () => {
      expect(parseDeepLink(`semaphore://community/${COMMUNITY_ID}?utm_source=x#frag`)).toEqual({
        type: 'community',
        communityId: COMMUNITY_ID,
      });
    });
  });

  describe('wrong scheme', () => {
    it.each([
      'https://community/abc',
      'http://community/abc',
      'file:///etc/passwd',
      'javascript:alert(1)',
      'ftp://community/abc',
      'semaphores://community/abc', // similar but distinct scheme
      'semaphor://community/abc',
    ])('rejects %s', (url) => {
      expect(parseDeepLink(url)).toBeNull();
    });

    it('rejects the scheme with no "//" (opaque, non-authority form)', () => {
      // new URL('semaphore:community/x') parses with an empty host, which
      // doesn't match any known route host.
      expect(parseDeepLink('semaphore:community/x')).toBeNull();
    });
  });

  describe('missing segments', () => {
    it('rejects a bare community host with no id', () => {
      expect(parseDeepLink('semaphore://community')).toBeNull();
      expect(parseDeepLink('semaphore://community/')).toBeNull();
    });

    it('rejects a channel route missing the channel id', () => {
      expect(parseDeepLink(`semaphore://community/${COMMUNITY_ID}/channel`)).toBeNull();
      expect(parseDeepLink(`semaphore://community/${COMMUNITY_ID}/channel/`)).toBeNull();
    });

    it('rejects an invite route with no code', () => {
      expect(parseDeepLink('semaphore://join')).toBeNull();
      expect(parseDeepLink('semaphore://join/')).toBeNull();
    });

    it('rejects an unknown host', () => {
      expect(parseDeepLink('semaphore://')).toBeNull();
      expect(parseDeepLink('semaphore://unknown/abc')).toBeNull();
    });
  });

  describe('extra segments', () => {
    it('rejects a community route with a trailing extra segment', () => {
      expect(parseDeepLink(`semaphore://community/${COMMUNITY_ID}/extra`)).toBeNull();
    });

    it('rejects a channel route with a trailing extra segment', () => {
      expect(
        parseDeepLink(`semaphore://community/${COMMUNITY_ID}/channel/${CHANNEL_ID}/extra`)
      ).toBeNull();
    });

    it('rejects a channel route whose middle segment is not "channel"', () => {
      expect(
        parseDeepLink(`semaphore://community/${COMMUNITY_ID}/notchannel/${CHANNEL_ID}`)
      ).toBeNull();
    });

    it('rejects a DM route with a trailing extra segment', () => {
      expect(parseDeepLink(`semaphore://direct-messages/${DM_GROUP_ID}/extra`)).toBeNull();
    });

    it('rejects an invite route with a trailing extra segment', () => {
      expect(parseDeepLink(`semaphore://join/${INVITE_CODE}/extra`)).toBeNull();
    });
  });

  describe('path traversal attempts', () => {
    it('rejects literal ".." segments (collapsed by URL, then shape-mismatched)', () => {
      expect(parseDeepLink('semaphore://community/../../etc/passwd')).toBeNull();
    });

    it('rejects percent-encoded ".." segments (%2e%2e)', () => {
      expect(parseDeepLink('semaphore://community/%2e%2e/%2e%2e/etc')).toBeNull();
    });

    it('rejects an encoded slash smuggled inside a single segment (%2f)', () => {
      // Raw pathname segment is "..%2fescape" — after our own decode step
      // this becomes "../escape", which must be rejected for containing "/".
      expect(parseDeepLink('semaphore://community/%2e%2e%2fescape')).toBeNull();
    });

    it('rejects a doubly-encoded traversal attempt', () => {
      expect(parseDeepLink('semaphore://community/%252e%252e/channel/x')).toBeNull();
    });

    it('rejects a bare "." segment', () => {
      expect(parseDeepLink('semaphore://community/./channel/x')).toBeNull();
    });

    it('rejects malformed percent-encoding without throwing', () => {
      expect(() => parseDeepLink('semaphore://community/%zz')).not.toThrow();
      expect(parseDeepLink('semaphore://community/%zz')).toBeNull();
    });

    it('rejects a decoded null byte', () => {
      expect(parseDeepLink('semaphore://community/%00')).toBeNull();
    });
  });

  describe('absurd lengths', () => {
    it('rejects a URL longer than the overall length cap', () => {
      const huge = `semaphore://community/${'a'.repeat(3000)}`;
      expect(parseDeepLink(huge)).toBeNull();
    });

    it('rejects an oversized single segment even under the URL length cap', () => {
      const longSegment = 'a'.repeat(500);
      expect(parseDeepLink(`semaphore://community/${longSegment}`)).toBeNull();
    });
  });

  describe('non-UUID ids', () => {
    it('rejects a non-UUID communityId', () => {
      expect(parseDeepLink('semaphore://community/not-a-uuid')).toBeNull();
    });

    it('rejects a non-UUID channelId with a valid communityId', () => {
      expect(
        parseDeepLink(`semaphore://community/${COMMUNITY_ID}/channel/not-a-uuid`)
      ).toBeNull();
    });

    it('rejects a non-UUID dmGroupId', () => {
      expect(parseDeepLink('semaphore://direct-messages/not-a-uuid')).toBeNull();
    });

    it('rejects a UUID with an out-of-range hex character', () => {
      const badUuid = 'g1b2c3d4-1111-4222-8333-444455556666';
      expect(parseDeepLink(`semaphore://community/${badUuid}`)).toBeNull();
    });

    it('accepts an invite code that is not UUID-shaped (invite codes are base64url, not UUIDs)', () => {
      expect(parseDeepLink(`semaphore://join/${INVITE_CODE}`)).toEqual({
        type: 'invite',
        inviteCode: INVITE_CODE,
      });
    });

    it('rejects an invite code containing characters outside the base64url alphabet', () => {
      expect(parseDeepLink('semaphore://join/not valid!')).toBeNull();
      expect(parseDeepLink('semaphore://join/has/slash')).toBeNull();
    });
  });

  describe('empty / malformed input', () => {
    it('rejects an empty string', () => {
      expect(parseDeepLink('')).toBeNull();
    });

    it('rejects non-string input', () => {
      expect(parseDeepLink(undefined)).toBeNull();
      expect(parseDeepLink(null)).toBeNull();
      expect(parseDeepLink(123)).toBeNull();
      expect(parseDeepLink({})).toBeNull();
    });

    it('rejects an unparseable URL without throwing', () => {
      expect(() => parseDeepLink('not a url at all')).not.toThrow();
      expect(parseDeepLink('not a url at all')).toBeNull();
    });
  });

  describe('extractDeepLinkUrls', () => {
    it('picks out semaphore:// entries from an argv-shaped array', () => {
      const argv = [
        '/usr/bin/semaphore-chat',
        '--flag',
        `semaphore://community/${COMMUNITY_ID}`,
        '--another-flag=value',
      ];
      expect(extractDeepLinkUrls(argv)).toEqual([`semaphore://community/${COMMUNITY_ID}`]);
    });

    it('returns an empty array when nothing matches', () => {
      expect(extractDeepLinkUrls(['/usr/bin/semaphore-chat', '--smoke-test'])).toEqual([]);
    });

    it('does not match a scheme-only prefix without "//"', () => {
      expect(extractDeepLinkUrls(['semaphore:community/x'])).toEqual([]);
    });

    it('handles an empty argv array', () => {
      expect(extractDeepLinkUrls([])).toEqual([]);
    });
  });
});
