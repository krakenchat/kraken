import { describe, it, expect } from 'vitest';
import {
  getNavigationHash,
  supportsNotificationActions,
  buildNotificationOptions,
  getMarkReadRequest,
} from '../../utils/swPush';

describe('swPush', () => {
  describe('getNavigationHash', () => {
    it('builds a channel hash when community + channel ids are present', () => {
      expect(
        getNavigationHash({ communityId: 'c1', channelId: 'ch1' }),
      ).toBe('#/community/c1/channel/ch1');
    });

    it('builds a DM hash when only a directMessageGroupId is present', () => {
      expect(getNavigationHash({ directMessageGroupId: 'g1' })).toBe(
        '#/direct-messages/g1',
      );
    });

    it('falls back to the root hash when nothing matches', () => {
      expect(getNavigationHash({})).toBe('#/');
      expect(getNavigationHash({ type: 'other' })).toBe('#/');
    });

    it('falls back to the root hash when data is undefined', () => {
      expect(getNavigationHash(undefined)).toBe('#/');
    });
  });

  describe('supportsNotificationActions', () => {
    it('returns true when maxActions is a positive number', () => {
      expect(supportsNotificationActions({ maxActions: 2 })).toBe(true);
    });

    it('returns true for a constructor function with maxActions (the real Notification global)', () => {
      class FakeNotification {
        static maxActions = 2;
      }
      expect(supportsNotificationActions(FakeNotification)).toBe(true);
    });

    it('returns false when maxActions is 0', () => {
      expect(supportsNotificationActions({ maxActions: 0 })).toBe(false);
    });

    it('returns false when maxActions is missing', () => {
      expect(supportsNotificationActions({})).toBe(false);
    });

    it('returns false when passed undefined', () => {
      expect(supportsNotificationActions(undefined)).toBe(false);
    });
  });

  describe('buildNotificationOptions', () => {
    const baseData = {
      title: 'New message',
      body: 'Hello there',
    };

    it('includes the mark-read action when actions are supported and a token is present', () => {
      const options = buildNotificationOptions(
        { ...baseData, data: { markReadToken: 'tok' } },
        true,
      );
      expect(options.actions).toEqual([
        { action: 'mark-read', title: 'Mark as read' },
      ]);
    });

    it('omits actions when actions are supported but no token is present', () => {
      const options = buildNotificationOptions(
        { ...baseData, data: {} },
        true,
      );
      expect(options.actions).toBeUndefined();
    });

    it('omits actions when a token is present but actions are unsupported', () => {
      const options = buildNotificationOptions(
        { ...baseData, data: { markReadToken: 'tok' } },
        false,
      );
      expect(options.actions).toBeUndefined();
    });

    it('omits actions when neither supported nor a token is present', () => {
      const options = buildNotificationOptions(
        { ...baseData, data: {} },
        false,
      );
      expect(options.actions).toBeUndefined();
    });

    it('falls back to /pwa-192x192.png for icon and badge when not provided', () => {
      const options = buildNotificationOptions(baseData, false);
      expect(options.icon).toBe('/pwa-192x192.png');
      expect(options.badge).toBe('/pwa-192x192.png');
    });

    it('uses provided icon/badge when present', () => {
      const options = buildNotificationOptions(
        { ...baseData, icon: '/custom-icon.png', badge: '/custom-badge.png' },
        false,
      );
      expect(options.icon).toBe('/custom-icon.png');
      expect(options.badge).toBe('/custom-badge.png');
    });

    it('passes through tag and data, and sets vibrate/requireInteraction', () => {
      const data = { notificationId: 'n1' };
      const options = buildNotificationOptions(
        { ...baseData, tag: 'msg-1', data },
        false,
      );
      expect(options.body).toBe('Hello there');
      expect(options.tag).toBe('msg-1');
      expect(options.data).toBe(data);
      expect(options.vibrate).toEqual([200, 100, 200]);
      expect(options.requireInteraction).toBe(false);
    });
  });

  describe('getMarkReadRequest', () => {
    it('returns null when there is no markReadToken', () => {
      expect(getMarkReadRequest(undefined)).toBeNull();
      expect(getMarkReadRequest({})).toBeNull();
    });

    it('builds the mark-read request when a token is present', () => {
      const request = getMarkReadRequest({ markReadToken: 'tok123' });
      expect(request).toEqual({
        url: '/api/notifications/push/mark-read',
        init: {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token: 'tok123' }),
        },
      });
    });
  });
});
