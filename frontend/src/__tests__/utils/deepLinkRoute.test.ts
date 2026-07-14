import { describe, it, expect } from 'vitest';
import { mapDeepLinkRouteToPath, deepLinkRouteRequiresAuth } from '../../utils/deepLinkRoute';

describe('deepLinkRoute', () => {
  describe('mapDeepLinkRouteToPath', () => {
    it('maps a community route', () => {
      expect(mapDeepLinkRouteToPath({ type: 'community', communityId: 'c1' })).toBe(
        '/community/c1',
      );
    });

    it('maps a channel route', () => {
      expect(
        mapDeepLinkRouteToPath({ type: 'channel', communityId: 'c1', channelId: 'ch1' }),
      ).toBe('/community/c1/channel/ch1');
    });

    it('maps the DM inbox route', () => {
      expect(mapDeepLinkRouteToPath({ type: 'dm-inbox' })).toBe('/direct-messages');
    });

    it('maps a DM group route', () => {
      expect(mapDeepLinkRouteToPath({ type: 'dm', dmGroupId: 'g1' })).toBe(
        '/direct-messages/g1',
      );
    });

    it('maps an invite route', () => {
      expect(mapDeepLinkRouteToPath({ type: 'invite', inviteCode: 'abc123' })).toBe(
        '/join/abc123',
      );
    });
  });

  describe('deepLinkRouteRequiresAuth', () => {
    it('requires auth for community, channel, dm-inbox, and dm routes', () => {
      expect(deepLinkRouteRequiresAuth({ type: 'community', communityId: 'c1' })).toBe(true);
      expect(
        deepLinkRouteRequiresAuth({ type: 'channel', communityId: 'c1', channelId: 'ch1' }),
      ).toBe(true);
      expect(deepLinkRouteRequiresAuth({ type: 'dm-inbox' })).toBe(true);
      expect(deepLinkRouteRequiresAuth({ type: 'dm', dmGroupId: 'g1' })).toBe(true);
    });

    it('does not require auth for invite routes (public /join/:inviteCode route)', () => {
      expect(deepLinkRouteRequiresAuth({ type: 'invite', inviteCode: 'abc123' })).toBe(false);
    });
  });
});
