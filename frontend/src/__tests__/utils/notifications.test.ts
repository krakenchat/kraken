import { describe, it, expect } from 'vitest';
import { formatNotificationContent } from '../../utils/notifications';
import { NotificationType } from '../../types/notification.type';

describe('formatNotificationContent', () => {
  describe('USER_MENTION', () => {
    it('includes the author name and channel in the title', () => {
      const result = formatNotificationContent({
        type: NotificationType.USER_MENTION,
        authorUsername: 'alice',
        messageText: 'hey @bob',
        channelName: 'general',
      });
      expect(result.title).toContain('alice');
      expect(result.title).toContain('mentioned you');
      expect(result.title).toContain('#general');
    });

    it('uses message text as the body', () => {
      const result = formatNotificationContent({
        type: NotificationType.USER_MENTION,
        authorUsername: 'alice',
        messageText: 'hey @bob check this',
      });
      expect(result.body).toBe('hey @bob check this');
    });

    it('falls back to "New mention" when messageText is missing', () => {
      const result = formatNotificationContent({
        type: NotificationType.USER_MENTION,
        authorUsername: 'alice',
      });
      expect(result.body).toBe('New mention');
    });

    it('omits channel info when channelName is not provided', () => {
      const result = formatNotificationContent({
        type: NotificationType.USER_MENTION,
        authorUsername: 'alice',
      });
      expect(result.title).not.toContain('#');
    });
  });

  describe('SPECIAL_MENTION', () => {
    it('includes the author name in the title', () => {
      const result = formatNotificationContent({
        type: NotificationType.SPECIAL_MENTION,
        authorUsername: 'bob',
        channelName: 'announcements',
      });
      expect(result.title).toContain('bob');
      expect(result.title).toContain('mentioned');
    });

    it('falls back to "New mention" when messageText is missing', () => {
      const result = formatNotificationContent({
        type: NotificationType.SPECIAL_MENTION,
        authorUsername: 'bob',
      });
      expect(result.body).toBe('New mention');
    });
  });

  describe('DIRECT_MESSAGE', () => {
    it('uses dmGroupName as title when available', () => {
      const result = formatNotificationContent({
        type: NotificationType.DIRECT_MESSAGE,
        authorUsername: 'carol',
        dmGroupName: 'Project Chat',
        messageText: 'hi there',
      });
      expect(result.title).toBe('Project Chat');
    });

    it('falls back to authorUsername when dmGroupName is not provided', () => {
      const result = formatNotificationContent({
        type: NotificationType.DIRECT_MESSAGE,
        authorUsername: 'carol',
        messageText: 'hi there',
      });
      expect(result.title).toBe('carol');
    });

    it('falls back to "New message" when messageText is missing', () => {
      const result = formatNotificationContent({
        type: NotificationType.DIRECT_MESSAGE,
        authorUsername: 'carol',
      });
      expect(result.body).toBe('New message');
    });
  });

  describe('CHANNEL_MESSAGE', () => {
    it('includes author and channel in the title', () => {
      const result = formatNotificationContent({
        type: NotificationType.CHANNEL_MESSAGE,
        authorUsername: 'dave',
        channelName: 'dev',
        messageText: 'PR is up',
      });
      expect(result.title).toContain('dave');
      expect(result.title).toContain('#dev');
      expect(result.body).toBe('PR is up');
    });

    it('omits channel when channelName is not provided', () => {
      const result = formatNotificationContent({
        type: NotificationType.CHANNEL_MESSAGE,
        authorUsername: 'dave',
      });
      expect(result.title).not.toContain('#');
    });
  });

  describe('unknown type', () => {
    it('returns generic title and body', () => {
      const result = formatNotificationContent({
        type: 'UNKNOWN_TYPE' as NotificationType,
        authorUsername: 'eve',
        messageText: 'something happened',
      });
      expect(result.title).toBe('New notification');
      expect(result.body).toBe('something happened');
    });

    it('returns empty body when messageText is missing', () => {
      const result = formatNotificationContent({
        type: 'UNKNOWN_TYPE' as NotificationType,
        authorUsername: 'eve',
      });
      expect(result.body).toBe('');
    });
  });
});
