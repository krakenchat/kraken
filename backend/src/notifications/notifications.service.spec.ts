import { TestBed } from '@suites/unit';
import type { Mocked } from '@suites/doubles.jest';
import { NotificationsService } from './notifications.service';

import { DatabaseService } from '@/database/database.service';
import { PushNotificationsService } from '@/push-notifications/push-notifications.service';
import { NotificationType, SpanType } from '@prisma/client';
import {
  createMockDatabase,
  NotificationFactory,
  UserNotificationSettingsFactory,
  ChannelNotificationOverrideFactory,
  MessageFactory,
} from '@/test-utils';

describe('NotificationsService', () => {
  let service: NotificationsService;
  let mockDatabase: ReturnType<typeof createMockDatabase>;

  let pushNotificationsService: Mocked<PushNotificationsService>;

  beforeEach(async () => {
    mockDatabase = createMockDatabase();

    const { unit, unitRef } = await TestBed.solitary(NotificationsService)
      .mock(DatabaseService)
      .final(mockDatabase)
      .compile();

    service = unit;

    pushNotificationsService = unitRef.get(PushNotificationsService);

    // Default mock behaviors
    pushNotificationsService.isEnabled.mockReturnValue(false);
    pushNotificationsService.sendToUser.mockResolvedValue({
      sent: 0,
      failed: 0,
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('processMessageForNotifications', () => {
    it('should create notifications for mentioned users', async () => {
      const userId1 = 'user-1';
      const userId2 = 'user-2';
      const authorId = 'author-1';
      const channelId = 'channel-1';

      const message = MessageFactory.build({
        id: 'msg-1',
        channelId,
        authorId,
        spans: [
          {
            type: SpanType.USER_MENTION,
            userId: userId1,
            text: null,
            specialKind: null,
            communityId: null,
            aliasId: null,
          },
          {
            type: SpanType.USER_MENTION,
            userId: userId2,
            text: null,
            specialKind: null,
            communityId: null,
            aliasId: null,
          },
        ],
      } as any);

      const settings = UserNotificationSettingsFactory.build();
      mockDatabase.userNotificationSettings.upsert.mockResolvedValue(settings);
      mockDatabase.channelNotificationOverride.findUnique.mockResolvedValue(
        null,
      );
      mockDatabase.notification.create.mockImplementation((args) =>
        Promise.resolve({
          ...NotificationFactory.build(args.data),
          author: {
            id: authorId,
            username: 'test',
            displayName: null,
            avatarUrl: null,
          },
          message: {
            id: 'msg-1',
            spans: [],
            channelId,
            directMessageGroupId: null,
          },
        }),
      );

      await service.processMessageForNotifications(message as any);

      // Should create 2 notifications (one for each mentioned user)
      expect(mockDatabase.notification.create).toHaveBeenCalledTimes(2);
      expect(mockDatabase.notification.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: userId1,
            type: NotificationType.USER_MENTION,
            messageId: message.id,
            channelId,
            authorId,
          }),
          include: expect.any(Object),
        }),
      );
      expect(mockDatabase.notification.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: userId2,
          }),
          include: expect.any(Object),
        }),
      );
    });

    it('should not create notification for message author', async () => {
      const authorId = 'author-1';
      const message = MessageFactory.build({
        authorId,
        spans: [
          {
            type: SpanType.USER_MENTION,
            userId: authorId, // Author mentioning themselves
            text: null,
            specialKind: null,
            communityId: null,
            aliasId: null,
          },
        ],
      } as any);

      await service.processMessageForNotifications(message as any);

      expect(mockDatabase.notification.create).not.toHaveBeenCalled();
    });

    it('should handle @channel special mention in private channel', async () => {
      const channelId = 'channel-1';
      const message = MessageFactory.build({
        channelId,
        authorId: 'author-1',
        spans: [
          {
            type: SpanType.SPECIAL_MENTION,
            specialKind: 'channel',
            userId: null,
            text: null,
            communityId: null,
            aliasId: null,
          },
        ],
      } as any);

      mockDatabase.channel.findUnique.mockResolvedValue({
        isPrivate: true,
        communityId: 'community-1',
      });

      const members = [
        { userId: 'user-1' },
        { userId: 'user-2' },
        { userId: 'user-3' },
      ];

      mockDatabase.channelMembership.findMany.mockResolvedValue(members);
      const settings = UserNotificationSettingsFactory.build();
      mockDatabase.userNotificationSettings.upsert.mockResolvedValue(settings);
      mockDatabase.channelNotificationOverride.findUnique.mockResolvedValue(
        null,
      );
      mockDatabase.notification.create.mockImplementation((args) =>
        Promise.resolve(NotificationFactory.build(args.data)),
      );

      await service.processMessageForNotifications(message as any);

      // Should create 3 notifications via channelMembership
      expect(mockDatabase.notification.create).toHaveBeenCalledTimes(3);
      expect(mockDatabase.channelMembership.findMany).toHaveBeenCalledWith({
        where: { channelId },
        select: { userId: true },
      });
    });

    it('should handle @channel special mention in public channel using community membership', async () => {
      const channelId = 'channel-1';
      const communityId = 'community-1';
      const message = MessageFactory.build({
        channelId,
        authorId: 'author-1',
        spans: [
          {
            type: SpanType.SPECIAL_MENTION,
            specialKind: 'channel',
            userId: null,
            text: null,
            communityId: null,
            aliasId: null,
          },
        ],
      } as any);

      mockDatabase.channel.findUnique.mockResolvedValue({
        isPrivate: false,
        communityId,
      });

      const members = [
        { userId: 'user-1' },
        { userId: 'user-2' },
        { userId: 'user-3' },
        { userId: 'user-4' },
      ];

      mockDatabase.membership.findMany.mockResolvedValue(members);
      const settings = UserNotificationSettingsFactory.build();
      mockDatabase.userNotificationSettings.upsert.mockResolvedValue(settings);
      mockDatabase.channelNotificationOverride.findUnique.mockResolvedValue(
        null,
      );
      mockDatabase.notification.create.mockImplementation((args) =>
        Promise.resolve(NotificationFactory.build(args.data)),
      );

      await service.processMessageForNotifications(message as any);

      // Should create 4 notifications via community membership
      expect(mockDatabase.notification.create).toHaveBeenCalledTimes(4);
      expect(mockDatabase.membership.findMany).toHaveBeenCalledWith({
        where: { communityId },
        select: { userId: true },
      });
    });

    it('should handle @here special mention (only online users) in private channel', async () => {
      const channelId = 'channel-1';
      const message = MessageFactory.build({
        channelId,
        authorId: 'author-1',
        spans: [
          {
            type: SpanType.SPECIAL_MENTION,
            specialKind: 'here',
            userId: null,
            text: null,
            communityId: null,
            aliasId: null,
          },
        ],
      } as any);

      mockDatabase.channel.findUnique.mockResolvedValue({
        isPrivate: true,
        communityId: 'community-1',
      });

      const now = new Date();
      const fourMinutesAgo = new Date(now.getTime() - 4 * 60 * 1000);
      const tenMinutesAgo = new Date(now.getTime() - 10 * 60 * 1000);

      const members = [
        { userId: 'user-1', user: { id: 'user-1', lastSeen: fourMinutesAgo } }, // Online
        { userId: 'user-2', user: { id: 'user-2', lastSeen: tenMinutesAgo } }, // Offline
        { userId: 'user-3', user: { id: 'user-3', lastSeen: null } }, // Never logged in
      ];

      mockDatabase.channelMembership.findMany.mockResolvedValue(members);
      const settings = UserNotificationSettingsFactory.build();
      mockDatabase.userNotificationSettings.upsert.mockResolvedValue(settings);
      mockDatabase.channelNotificationOverride.findUnique.mockResolvedValue(
        null,
      );
      mockDatabase.notification.create.mockImplementation((args) =>
        Promise.resolve({
          ...NotificationFactory.build(args.data),
          author: {
            id: 'author-1',
            username: 'test',
            displayName: null,
            avatarUrl: null,
          },
          message: {
            id: message.id,
            spans: [],
            channelId,
            directMessageGroupId: null,
          },
        }),
      );

      await service.processMessageForNotifications(message as any);

      // Should create only 1 notification (for online user)
      expect(mockDatabase.notification.create).toHaveBeenCalledTimes(1);
      expect(mockDatabase.notification.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: 'user-1',
          }),
          include: expect.any(Object),
        }),
      );
    });

    it('should handle @here in public channel using community membership', async () => {
      const channelId = 'channel-1';
      const communityId = 'community-1';
      const message = MessageFactory.build({
        channelId,
        authorId: 'author-1',
        spans: [
          {
            type: SpanType.SPECIAL_MENTION,
            specialKind: 'here',
            userId: null,
            text: null,
            communityId: null,
            aliasId: null,
          },
        ],
      } as any);

      mockDatabase.channel.findUnique.mockResolvedValue({
        isPrivate: false,
        communityId,
      });

      const now = new Date();
      const fourMinutesAgo = new Date(now.getTime() - 4 * 60 * 1000);
      const tenMinutesAgo = new Date(now.getTime() - 10 * 60 * 1000);

      const members = [
        { userId: 'user-1', user: { id: 'user-1', lastSeen: fourMinutesAgo } },
        { userId: 'user-2', user: { id: 'user-2', lastSeen: tenMinutesAgo } },
      ];

      mockDatabase.membership.findMany.mockResolvedValue(members);
      const settings = UserNotificationSettingsFactory.build();
      mockDatabase.userNotificationSettings.upsert.mockResolvedValue(settings);
      mockDatabase.channelNotificationOverride.findUnique.mockResolvedValue(
        null,
      );
      mockDatabase.notification.create.mockImplementation((args) =>
        Promise.resolve({
          ...NotificationFactory.build(args.data),
          author: {
            id: 'author-1',
            username: 'test',
            displayName: null,
            avatarUrl: null,
          },
          message: {
            id: message.id,
            spans: [],
            channelId,
            directMessageGroupId: null,
          },
        }),
      );

      await service.processMessageForNotifications(message as any);

      // Should create only 1 notification (user-1 is online)
      expect(mockDatabase.notification.create).toHaveBeenCalledTimes(1);
      expect(mockDatabase.membership.findMany).toHaveBeenCalledWith({
        where: { communityId },
        include: {
          user: {
            select: { id: true, lastSeen: true },
          },
        },
      });
    });

    it('should notify all DM members when message has @mention (mention + regular DM)', async () => {
      const dmGroupId = 'dm-group-1';
      const authorId = 'author-1';
      const mentionedUserId = 'user-1';
      const message = MessageFactory.buildDirectMessage({
        directMessageGroupId: dmGroupId,
        authorId,
        spans: [
          {
            type: SpanType.USER_MENTION,
            userId: mentionedUserId,
            text: null,
            specialKind: null,
            communityId: null,
            aliasId: null,
          },
        ],
      } as any);

      // 4-person DM group
      const members = [
        { userId: authorId },
        { userId: mentionedUserId },
        { userId: 'user-2' },
        { userId: 'user-3' },
      ];

      mockDatabase.directMessageGroupMember.findMany.mockResolvedValue(members);
      const settings = UserNotificationSettingsFactory.build();
      mockDatabase.userNotificationSettings.upsert.mockResolvedValue(settings);
      mockDatabase.notification.create.mockImplementation((args) =>
        Promise.resolve(NotificationFactory.build(args.data)),
      );

      await service.processMessageForNotifications(message as any);

      // Should create 3 notifications total:
      // 1 DIRECT_MESSAGE (mention) for user-1, 2 DIRECT_MESSAGE for user-2 and user-3
      expect(mockDatabase.notification.create).toHaveBeenCalledTimes(3);
      // user-1 gets a DIRECT_MESSAGE via mention path
      expect(mockDatabase.notification.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: mentionedUserId,
            type: NotificationType.DIRECT_MESSAGE,
          }),
          include: expect.any(Object),
        }),
      );
      // user-2 and user-3 get DIRECT_MESSAGE via DM path
      expect(mockDatabase.notification.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: 'user-2',
            type: NotificationType.DIRECT_MESSAGE,
          }),
          include: expect.any(Object),
        }),
      );
      expect(mockDatabase.notification.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: 'user-3',
            type: NotificationType.DIRECT_MESSAGE,
          }),
          include: expect.any(Object),
        }),
      );
    });

    it('should handle DM notifications', async () => {
      const dmGroupId = 'dm-group-1';
      const message = MessageFactory.buildDirectMessage({
        directMessageGroupId: dmGroupId,
        authorId: 'author-1',
        spans: [],
      } as any);

      const members = [{ userId: 'user-1' }, { userId: 'user-2' }];

      mockDatabase.directMessageGroupMember.findMany.mockResolvedValue(members);
      const settings = UserNotificationSettingsFactory.build();
      mockDatabase.userNotificationSettings.upsert.mockResolvedValue(settings);
      mockDatabase.notification.create.mockImplementation((args) =>
        Promise.resolve(NotificationFactory.build(args.data)),
      );

      await service.processMessageForNotifications(message as any);

      expect(mockDatabase.notification.create).toHaveBeenCalledTimes(2);
    });

    it('should create CHANNEL_MESSAGE notifications for users with "all" level', async () => {
      const channelId = 'channel-1';
      const communityId = 'community-1';
      const authorId = 'author-1';
      const message = MessageFactory.build({
        id: 'msg-1',
        channelId,
        authorId,
        spans: [],
      } as any);

      // Public channel
      mockDatabase.channel.findUnique.mockResolvedValue({
        isPrivate: false,
        communityId,
      });
      mockDatabase.membership.count.mockResolvedValue(10);
      mockDatabase.membership.findMany.mockResolvedValue([
        { userId: 'user-1' },
        { userId: 'user-2' },
      ]);

      // User settings: "all" level
      const settings = UserNotificationSettingsFactory.buildAllChannelsMode();
      mockDatabase.userNotificationSettings.upsert.mockResolvedValue(settings);
      mockDatabase.channelNotificationOverride.findUnique.mockResolvedValue(
        null,
      );
      mockDatabase.notification.create.mockImplementation((args) =>
        Promise.resolve(NotificationFactory.build(args.data)),
      );

      await service.processMessageForNotifications(message as any);

      // Should create CHANNEL_MESSAGE notifications for user-1 and user-2
      expect(mockDatabase.notification.create).toHaveBeenCalledTimes(2);
      expect(mockDatabase.notification.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            type: NotificationType.CHANNEL_MESSAGE,
          }),
          include: expect.any(Object),
        }),
      );
    });

    it('should not create CHANNEL_MESSAGE notifications when default level is "mentions"', async () => {
      const channelId = 'channel-1';
      const communityId = 'community-1';
      const message = MessageFactory.build({
        id: 'msg-1',
        channelId,
        authorId: 'author-1',
        spans: [],
      } as any);

      mockDatabase.channel.findUnique.mockResolvedValue({
        isPrivate: false,
        communityId,
      });
      mockDatabase.membership.count.mockResolvedValue(10);
      mockDatabase.membership.findMany.mockResolvedValue([
        { userId: 'user-1' },
      ]);

      // Default level is 'mentions' — CHANNEL_MESSAGE should be filtered
      const settings = UserNotificationSettingsFactory.buildMentionsOnlyMode();
      mockDatabase.userNotificationSettings.upsert.mockResolvedValue(settings);
      mockDatabase.channelNotificationOverride.findUnique.mockResolvedValue(
        null,
      );

      await service.processMessageForNotifications(message as any);

      // shouldNotify returns false for CHANNEL_MESSAGE with 'mentions' level
      expect(mockDatabase.notification.create).not.toHaveBeenCalled();
    });

    it('should skip CHANNEL_MESSAGE notifications for large communities', async () => {
      const channelId = 'channel-1';
      const communityId = 'community-1';
      const message = MessageFactory.build({
        id: 'msg-1',
        channelId,
        authorId: 'author-1',
        spans: [],
      } as any);

      mockDatabase.channel.findUnique.mockResolvedValue({
        isPrivate: false,
        communityId,
      });
      // Large community exceeds threshold
      mockDatabase.membership.count.mockResolvedValue(501);

      await service.processMessageForNotifications(message as any);

      // Should not query for members or create notifications
      expect(mockDatabase.membership.findMany).not.toHaveBeenCalled();
      expect(mockDatabase.notification.create).not.toHaveBeenCalled();
    });

    it('should not throw error if notification creation fails', async () => {
      const message = MessageFactory.build({
        spans: [
          {
            type: SpanType.USER_MENTION,
            userId: 'user-1',
            text: null,
            specialKind: null,
            communityId: null,
            aliasId: null,
          },
        ],
      } as any);

      mockDatabase.userNotificationSettings.upsert.mockResolvedValue(
        UserNotificationSettingsFactory.build(),
      );
      mockDatabase.notification.create.mockRejectedValue(new Error('DB error'));

      // Should not throw
      await expect(
        service.processMessageForNotifications(message as any),
      ).resolves.toBeUndefined();
    });
  });

  describe('shouldNotify', () => {
    const userId = 'user-1';
    const channelId = 'channel-1';

    it('should still create notification records when desktop notifications are disabled', async () => {
      const settings = UserNotificationSettingsFactory.buildMutedDesktop();
      mockDatabase.userNotificationSettings.upsert.mockResolvedValue(settings);
      mockDatabase.channelNotificationOverride.findUnique.mockResolvedValue(
        null,
      );

      const result = await service.shouldNotify(
        userId,
        channelId,
        null,
        NotificationType.USER_MENTION,
      );

      expect(result).toBe(true);
    });

    it('should still create notification records when in DND time window', async () => {
      const settings = UserNotificationSettingsFactory.buildWithDND({
        dndStartTime: '22:00',
        dndEndTime: '08:00',
      });
      mockDatabase.userNotificationSettings.upsert.mockResolvedValue(settings);
      mockDatabase.channelNotificationOverride.findUnique.mockResolvedValue(
        null,
      );

      const result = await service.shouldNotify(
        userId,
        channelId,
        null,
        NotificationType.USER_MENTION,
      );

      expect(result).toBe(true);
    });

    it('should return false when DM notifications are disabled for DMs', async () => {
      const settings = UserNotificationSettingsFactory.buildMutedDMs();
      mockDatabase.userNotificationSettings.upsert.mockResolvedValue(settings);

      const result = await service.shouldNotify(
        userId,
        null,
        'dm-group-1',
        NotificationType.DIRECT_MESSAGE,
      );

      expect(result).toBe(false);
    });

    it('should return false when channel is muted', async () => {
      const settings = UserNotificationSettingsFactory.build();
      const override = ChannelNotificationOverrideFactory.buildMuted({
        userId,
        channelId,
      });

      mockDatabase.userNotificationSettings.upsert.mockResolvedValue(settings);
      mockDatabase.channelNotificationOverride.findUnique.mockResolvedValue(
        override,
      );

      const result = await service.shouldNotify(
        userId,
        channelId,
        null,
        NotificationType.USER_MENTION,
      );

      expect(result).toBe(false);
    });

    it('should return false for channel messages when set to mentions-only', async () => {
      const settings = UserNotificationSettingsFactory.buildMentionsOnlyMode();
      mockDatabase.userNotificationSettings.upsert.mockResolvedValue(settings);
      mockDatabase.channelNotificationOverride.findUnique.mockResolvedValue(
        null,
      );

      const result = await service.shouldNotify(
        userId,
        channelId,
        null,
        NotificationType.CHANNEL_MESSAGE,
      );

      expect(result).toBe(false);
    });

    it('should return true for mentions when set to mentions-only', async () => {
      const settings = UserNotificationSettingsFactory.buildMentionsOnlyMode();
      mockDatabase.userNotificationSettings.upsert.mockResolvedValue(settings);
      mockDatabase.channelNotificationOverride.findUnique.mockResolvedValue(
        null,
      );

      const result = await service.shouldNotify(
        userId,
        channelId,
        null,
        NotificationType.USER_MENTION,
      );

      expect(result).toBe(true);
    });

    it('should return true for thread reply even when channel is muted', async () => {
      const settings = UserNotificationSettingsFactory.build();
      const override = ChannelNotificationOverrideFactory.buildMuted({
        userId,
        channelId,
      });

      mockDatabase.userNotificationSettings.upsert.mockResolvedValue(settings);
      mockDatabase.channelNotificationOverride.findUnique.mockResolvedValue(
        override,
      );

      const result = await service.shouldNotify(
        userId,
        channelId,
        null,
        NotificationType.THREAD_REPLY,
      );

      expect(result).toBe(true);
    });

    it('should return false for thread reply when DM notifications are disabled', async () => {
      const settings = UserNotificationSettingsFactory.buildMutedDMs();
      mockDatabase.userNotificationSettings.upsert.mockResolvedValue(settings);

      const result = await service.shouldNotify(
        userId,
        null,
        'dm-group-1',
        NotificationType.DIRECT_MESSAGE,
      );

      expect(result).toBe(false);
    });

    it('should use upsert to get-or-create settings', async () => {
      const newSettings = UserNotificationSettingsFactory.build({ userId });
      mockDatabase.userNotificationSettings.upsert.mockResolvedValue(
        newSettings,
      );
      mockDatabase.channelNotificationOverride.findUnique.mockResolvedValue(
        null,
      );

      await service.shouldNotify(
        userId,
        channelId,
        null,
        NotificationType.USER_MENTION,
      );

      expect(mockDatabase.userNotificationSettings.upsert).toHaveBeenCalledWith(
        {
          where: { userId },
          create: { userId },
          update: {},
        },
      );
    });
  });

  describe('getUserNotifications', () => {
    it('should return paginated notifications', async () => {
      const userId = 'user-1';
      const notifications = NotificationFactory.buildMany(3, { userId });

      mockDatabase.notification.findMany.mockResolvedValue(notifications);

      const result = await service.getUserNotifications(userId, {
        limit: 50,
        offset: 0,
      });

      expect(result).toHaveLength(3);
      expect(mockDatabase.notification.findMany).toHaveBeenCalledWith({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 50,
        skip: 0,
        include: expect.any(Object),
      });
    });

    it('should filter by unread only', async () => {
      const userId = 'user-1';
      mockDatabase.notification.findMany.mockResolvedValue([]);

      await service.getUserNotifications(userId, {
        unreadOnly: true,
        limit: 50,
        offset: 0,
      });

      expect(mockDatabase.notification.findMany).toHaveBeenCalledWith({
        where: { userId, read: false },
        orderBy: { createdAt: 'desc' },
        take: 50,
        skip: 0,
        include: expect.any(Object),
      });
    });
  });

  describe('getUnreadCount', () => {
    it('should return unread notification count', async () => {
      const userId = 'user-1';
      mockDatabase.notification.count.mockResolvedValue(5);

      const result = await service.getUnreadCount(userId);

      expect(result).toBe(5);
      expect(mockDatabase.notification.count).toHaveBeenCalledWith({
        where: { userId, read: false },
      });
    });
  });

  describe('markAsRead', () => {
    it('should mark notification as read', async () => {
      const userId = 'user-1';
      const notificationId = 'notif-1';
      const notification = NotificationFactory.build({
        id: notificationId,
        userId,
      });
      const updatedNotification = { ...notification, read: true };

      mockDatabase.notification.findFirst.mockResolvedValue(notification);
      mockDatabase.notification.update.mockResolvedValue(updatedNotification);

      const result = await service.markAsRead(notificationId, userId);

      expect(result.read).toBe(true);
      expect(mockDatabase.notification.update).toHaveBeenCalledWith({
        where: { id: notificationId },
        data: { read: true },
      });
    });

    it('should throw NotFoundException if notification not found', async () => {
      mockDatabase.notification.findFirst.mockResolvedValue(null);

      await expect(service.markAsRead('nonexistent', 'user-1')).rejects.toThrow(
        'Notification not found',
      );
    });
  });

  describe('markContextNotificationsAsRead', () => {
    it('should mark channel mention notifications as read', async () => {
      mockDatabase.notification.updateMany.mockResolvedValue({ count: 3 });

      const result = await service.markContextNotificationsAsRead(
        'user-1',
        'channel-1',
        null,
      );

      expect(result).toBe(3);
      expect(mockDatabase.notification.updateMany).toHaveBeenCalledWith({
        where: {
          userId: 'user-1',
          read: false,
          channelId: 'channel-1',
          type: { in: ['USER_MENTION', 'SPECIAL_MENTION', 'CHANNEL_MESSAGE'] },
        },
        data: { read: true },
      });
    });

    it('should include DIRECT_MESSAGE type for DM groups', async () => {
      mockDatabase.notification.updateMany.mockResolvedValue({ count: 2 });

      const result = await service.markContextNotificationsAsRead(
        'user-1',
        null,
        'dm-group-1',
      );

      expect(result).toBe(2);
      expect(mockDatabase.notification.updateMany).toHaveBeenCalledWith({
        where: {
          userId: 'user-1',
          read: false,
          directMessageGroupId: 'dm-group-1',
          type: { in: ['USER_MENTION', 'SPECIAL_MENTION', 'DIRECT_MESSAGE'] },
        },
        data: { read: true },
      });
    });

    it('should return 0 when no context provided', async () => {
      const result = await service.markContextNotificationsAsRead(
        'user-1',
        null,
        null,
      );

      expect(result).toBe(0);
      expect(mockDatabase.notification.updateMany).not.toHaveBeenCalled();
    });
  });

  describe('markAllAsRead', () => {
    it('should mark all notifications as read', async () => {
      const userId = 'user-1';
      mockDatabase.notification.updateMany.mockResolvedValue({ count: 10 });

      const result = await service.markAllAsRead(userId);

      expect(result.count).toBe(10);
      expect(mockDatabase.notification.updateMany).toHaveBeenCalledWith({
        where: { userId, read: false },
        data: { read: true },
      });
    });
  });

  describe('getUserSettings', () => {
    it('should return existing settings', async () => {
      const userId = 'user-1';
      const settings = UserNotificationSettingsFactory.build({ userId });

      mockDatabase.userNotificationSettings.upsert.mockResolvedValue(settings);

      const result = await service.getUserSettings(userId);

      expect(result).toEqual(settings);
    });

    it('should create default settings if none exist', async () => {
      const userId = 'user-1';
      const newSettings = UserNotificationSettingsFactory.build({ userId });

      mockDatabase.userNotificationSettings.upsert.mockResolvedValue(
        newSettings,
      );

      const result = await service.getUserSettings(userId);

      expect(result).toEqual(newSettings);
    });

    it('should use upsert instead of find-then-create', async () => {
      const userId = 'user-1';
      const settings = UserNotificationSettingsFactory.build({ userId });

      mockDatabase.userNotificationSettings.upsert.mockResolvedValue(settings);

      await service.getUserSettings(userId);

      expect(mockDatabase.userNotificationSettings.upsert).toHaveBeenCalledWith(
        {
          where: { userId },
          create: { userId },
          update: {},
        },
      );
      // Verify the old find-then-create pattern is NOT used
      expect(
        mockDatabase.userNotificationSettings.findUnique,
      ).not.toHaveBeenCalled();
      expect(
        mockDatabase.userNotificationSettings.create,
      ).not.toHaveBeenCalled();
    });
  });

  describe('updateUserSettings', () => {
    it('should update user settings', async () => {
      const userId = 'user-1';
      const existingSettings = UserNotificationSettingsFactory.build({
        userId,
      });
      const updates = {
        doNotDisturb: true,
        dndStartTime: '22:00',
        dndEndTime: '08:00',
      };

      mockDatabase.userNotificationSettings.upsert.mockResolvedValue(
        existingSettings,
      );
      mockDatabase.userNotificationSettings.update.mockResolvedValue({
        ...existingSettings,
        ...updates,
      });

      const result = await service.updateUserSettings(userId, updates);

      expect(result.doNotDisturb).toBe(true);
      expect(mockDatabase.userNotificationSettings.update).toHaveBeenCalledWith(
        {
          where: { userId },
          data: updates,
        },
      );
    });
  });

  describe('getChannelOverride', () => {
    it('should return channel override if exists', async () => {
      const userId = 'user-1';
      const channelId = 'channel-1';
      const override = ChannelNotificationOverrideFactory.build({
        userId,
        channelId,
      });

      mockDatabase.channelNotificationOverride.findUnique.mockResolvedValue(
        override,
      );

      const result = await service.getChannelOverride(userId, channelId);

      expect(result).toEqual(override);
    });

    it('should return null if no override exists', async () => {
      mockDatabase.channelNotificationOverride.findUnique.mockResolvedValue(
        null,
      );

      const result = await service.getChannelOverride('user-1', 'channel-1');

      expect(result).toBeNull();
    });
  });

  describe('setChannelOverride', () => {
    it('should create new channel override', async () => {
      const userId = 'user-1';
      const channelId = 'channel-1';
      const override = ChannelNotificationOverrideFactory.buildMuted({
        userId,
        channelId,
      });

      mockDatabase.channelNotificationOverride.upsert.mockResolvedValue(
        override,
      );

      const result = await service.setChannelOverride(userId, channelId, {
        level: 'none',
      });

      expect(result).toEqual(override);
      expect(
        mockDatabase.channelNotificationOverride.upsert,
      ).toHaveBeenCalledWith({
        where: { userId_channelId: { userId, channelId } },
        update: { level: 'none' },
        create: { userId, channelId, level: 'none' },
      });
    });
  });

  describe('deleteChannelOverride', () => {
    it('should delete channel override', async () => {
      const userId = 'user-1';
      const channelId = 'channel-1';

      mockDatabase.channelNotificationOverride.deleteMany.mockResolvedValue({
        count: 1,
      });

      await service.deleteChannelOverride(userId, channelId);

      expect(
        mockDatabase.channelNotificationOverride.deleteMany,
      ).toHaveBeenCalledWith({
        where: { userId, channelId },
      });
    });
  });

  // ============================================================================
  // PUSH NOTIFICATION BODY
  // ============================================================================

  describe('push notification body formatting', () => {
    const authorId = 'author-1';
    const channelId = 'channel-1';
    const communityId = 'community-1';

    const authorInfo = {
      id: authorId,
      username: 'johndoe',
      displayName: 'John Doe',
      avatarUrl: null,
    };

    const channelInfo = {
      id: channelId,
      name: 'general',
      communityId,
    };

    beforeEach(() => {
      pushNotificationsService.isEnabled.mockReturnValue(true);
    });

    function setupNotificationCreate(
      type: NotificationType,
      spans: any[],
      options: { channel?: boolean } = {},
    ) {
      const notification = NotificationFactory.build({
        type,
        authorId,
        channelId: options.channel !== false ? channelId : null,
      });

      mockDatabase.notification.create.mockResolvedValue({
        ...notification,
        author: authorInfo,
        message: { id: 'msg-1', spans, channelId, directMessageGroupId: null },
        channel: options.channel !== false ? channelInfo : null,
      });

      return notification;
    }

    it('should include message text in USER_MENTION push body', async () => {
      const spans = [
        {
          type: SpanType.PLAINTEXT,
          text: 'Hello world',
          userId: null,
          specialKind: null,
          communityId: null,
          aliasId: null,
        },
      ];
      setupNotificationCreate(NotificationType.USER_MENTION, spans);

      const settings = UserNotificationSettingsFactory.build();
      mockDatabase.userNotificationSettings.upsert.mockResolvedValue(settings);
      mockDatabase.channelNotificationOverride.findUnique.mockResolvedValue(
        null,
      );

      const message = MessageFactory.build({
        id: 'msg-1',
        channelId,
        authorId,
        spans: [
          {
            type: SpanType.USER_MENTION,
            userId: 'target-user',
            text: null,
            specialKind: null,
            communityId: null,
            aliasId: null,
          },
        ],
      } as any);

      await service.processMessageForNotifications(message as any);

      expect(pushNotificationsService.sendToUser).toHaveBeenCalledWith(
        'target-user',
        expect.objectContaining({
          body: 'John Doe: Hello world',
        }),
      );
    });

    it('should fallback to generic text for USER_MENTION when message has no text spans', async () => {
      setupNotificationCreate(NotificationType.USER_MENTION, []);

      const settings = UserNotificationSettingsFactory.build();
      mockDatabase.userNotificationSettings.upsert.mockResolvedValue(settings);
      mockDatabase.channelNotificationOverride.findUnique.mockResolvedValue(
        null,
      );

      const message = MessageFactory.build({
        id: 'msg-1',
        channelId,
        authorId,
        spans: [
          {
            type: SpanType.USER_MENTION,
            userId: 'target-user',
            text: null,
            specialKind: null,
            communityId: null,
            aliasId: null,
          },
        ],
      } as any);

      await service.processMessageForNotifications(message as any);

      expect(pushNotificationsService.sendToUser).toHaveBeenCalledWith(
        'target-user',
        expect.objectContaining({
          body: 'John Doe mentioned you',
        }),
      );
    });

    it('should include message text in DIRECT_MESSAGE push body', async () => {
      const spans = [
        {
          type: SpanType.PLAINTEXT,
          text: 'Hey there!',
          userId: null,
          specialKind: null,
          communityId: null,
          aliasId: null,
        },
      ];
      const notification = NotificationFactory.build({
        type: NotificationType.DIRECT_MESSAGE,
        authorId,
        channelId: null,
        directMessageGroupId: 'dm-group-1',
      });

      mockDatabase.notification.create.mockResolvedValue({
        ...notification,
        author: authorInfo,
        message: {
          id: 'msg-1',
          spans,
          channelId: null,
          directMessageGroupId: 'dm-group-1',
        },
        channel: null,
      });

      const settings = UserNotificationSettingsFactory.build();
      mockDatabase.userNotificationSettings.upsert.mockResolvedValue(settings);

      const message = MessageFactory.buildDirectMessage({
        id: 'msg-1',
        directMessageGroupId: 'dm-group-1',
        authorId,
        spans: [],
      } as any);

      mockDatabase.directMessageGroupMember.findMany.mockResolvedValue([
        { userId: 'recipient-1' },
      ]);

      await service.processMessageForNotifications(message as any);

      expect(pushNotificationsService.sendToUser).toHaveBeenCalledWith(
        'recipient-1',
        expect.objectContaining({
          body: 'Hey there!',
        }),
      );
    });

    it('should fallback to generic text for DIRECT_MESSAGE when message has no text spans', async () => {
      const notification = NotificationFactory.build({
        type: NotificationType.DIRECT_MESSAGE,
        authorId,
        channelId: null,
        directMessageGroupId: 'dm-group-1',
      });

      mockDatabase.notification.create.mockResolvedValue({
        ...notification,
        author: authorInfo,
        message: {
          id: 'msg-1',
          spans: [],
          channelId: null,
          directMessageGroupId: 'dm-group-1',
        },
        channel: null,
      });

      const settings = UserNotificationSettingsFactory.build();
      mockDatabase.userNotificationSettings.upsert.mockResolvedValue(settings);

      const message = MessageFactory.buildDirectMessage({
        id: 'msg-1',
        directMessageGroupId: 'dm-group-1',
        authorId,
        spans: [],
      } as any);

      mockDatabase.directMessageGroupMember.findMany.mockResolvedValue([
        { userId: 'recipient-1' },
      ]);

      await service.processMessageForNotifications(message as any);

      expect(pushNotificationsService.sendToUser).toHaveBeenCalledWith(
        'recipient-1',
        expect.objectContaining({
          body: 'New message',
        }),
      );
    });

    it('should include message text in THREAD_REPLY push body', async () => {
      const spans = [
        {
          type: SpanType.PLAINTEXT,
          text: 'I agree!',
          userId: null,
          specialKind: null,
          communityId: null,
          aliasId: null,
        },
      ];
      const notification = NotificationFactory.build({
        type: NotificationType.THREAD_REPLY,
        authorId,
        channelId,
      });

      mockDatabase.notification.create.mockResolvedValue({
        ...notification,
        author: authorInfo,
        message: {
          id: 'reply-1',
          spans,
          channelId,
          directMessageGroupId: null,
        },
        channel: channelInfo,
      });

      const settings = UserNotificationSettingsFactory.build();
      mockDatabase.userNotificationSettings.upsert.mockResolvedValue(settings);
      mockDatabase.channelNotificationOverride.findUnique.mockResolvedValue(
        null,
      );

      mockDatabase.threadSubscriber.findMany.mockResolvedValue([
        { userId: 'subscriber-1' },
      ]);

      const reply = MessageFactory.build({
        id: 'reply-1',
        channelId,
        authorId,
        spans: [
          {
            type: SpanType.PLAINTEXT,
            text: 'I agree!',
            userId: null,
            specialKind: null,
            communityId: null,
            aliasId: null,
          },
        ],
      } as any);

      await service.processThreadReplyNotifications(
        reply,
        'parent-msg-1',
        authorId,
      );

      expect(pushNotificationsService.sendToUser).toHaveBeenCalledWith(
        'subscriber-1',
        expect.objectContaining({
          body: 'John Doe: I agree!',
        }),
      );
    });

    it('should truncate long message text to 100 characters', async () => {
      const longText = 'A'.repeat(150);
      const spans = [
        {
          type: SpanType.PLAINTEXT,
          text: longText,
          userId: null,
          specialKind: null,
          communityId: null,
          aliasId: null,
        },
      ];
      setupNotificationCreate(NotificationType.USER_MENTION, spans);

      const settings = UserNotificationSettingsFactory.build();
      mockDatabase.userNotificationSettings.upsert.mockResolvedValue(settings);
      mockDatabase.channelNotificationOverride.findUnique.mockResolvedValue(
        null,
      );

      const message = MessageFactory.build({
        id: 'msg-1',
        channelId,
        authorId,
        spans: [
          {
            type: SpanType.USER_MENTION,
            userId: 'target-user',
            text: null,
            specialKind: null,
            communityId: null,
            aliasId: null,
          },
        ],
      } as any);

      await service.processMessageForNotifications(message as any);

      expect(pushNotificationsService.sendToUser).toHaveBeenCalledWith(
        'target-user',
        expect.objectContaining({
          body: `John Doe: ${'A'.repeat(100)}...`,
        }),
      );
    });

    it('should preserve original case in message text', async () => {
      const spans = [
        {
          type: SpanType.PLAINTEXT,
          text: 'Hello World! Testing CaSe',
          userId: null,
          specialKind: null,
          communityId: null,
          aliasId: null,
        },
      ];
      setupNotificationCreate(NotificationType.USER_MENTION, spans);

      const settings = UserNotificationSettingsFactory.build();
      mockDatabase.userNotificationSettings.upsert.mockResolvedValue(settings);
      mockDatabase.channelNotificationOverride.findUnique.mockResolvedValue(
        null,
      );

      const message = MessageFactory.build({
        id: 'msg-1',
        channelId,
        authorId,
        spans: [
          {
            type: SpanType.USER_MENTION,
            userId: 'target-user',
            text: null,
            specialKind: null,
            communityId: null,
            aliasId: null,
          },
        ],
      } as any);

      await service.processMessageForNotifications(message as any);

      expect(pushNotificationsService.sendToUser).toHaveBeenCalledWith(
        'target-user',
        expect.objectContaining({
          body: 'John Doe: Hello World! Testing CaSe',
        }),
      );
    });

    it('should join multiple spans into a single text', async () => {
      const spans = [
        {
          type: SpanType.PLAINTEXT,
          text: 'Hello',
          userId: null,
          specialKind: null,
          communityId: null,
          aliasId: null,
        },
        {
          type: SpanType.PLAINTEXT,
          text: 'World',
          userId: null,
          specialKind: null,
          communityId: null,
          aliasId: null,
        },
      ];
      setupNotificationCreate(NotificationType.USER_MENTION, spans);

      const settings = UserNotificationSettingsFactory.build();
      mockDatabase.userNotificationSettings.upsert.mockResolvedValue(settings);
      mockDatabase.channelNotificationOverride.findUnique.mockResolvedValue(
        null,
      );

      const message = MessageFactory.build({
        id: 'msg-1',
        channelId,
        authorId,
        spans: [
          {
            type: SpanType.USER_MENTION,
            userId: 'target-user',
            text: null,
            specialKind: null,
            communityId: null,
            aliasId: null,
          },
        ],
      } as any);

      await service.processMessageForNotifications(message as any);

      expect(pushNotificationsService.sendToUser).toHaveBeenCalledWith(
        'target-user',
        expect.objectContaining({
          body: 'John Doe: Hello World',
        }),
      );
    });
  });

  // ============================================================================
  // DEBUG METHODS
  // ============================================================================

  describe('createTestNotification', () => {
    it('should create a test notification for the user', async () => {
      const userId = 'user-1';
      const type = NotificationType.DIRECT_MESSAGE;
      const notification = NotificationFactory.build({
        userId,
        type,
        authorId: userId,
      });

      mockDatabase.notification.create.mockResolvedValue({
        ...notification,
        author: {
          id: userId,
          username: 'test',
          displayName: null,
          avatarUrl: null,
        },
        message: null,
      });

      const result = await service.createTestNotification(userId, type);

      expect(result).toBeDefined();
      expect(mockDatabase.notification.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId,
            type,
            authorId: userId,
          }),
        }),
      );
    });

    it('should create test notification with USER_MENTION type', async () => {
      const userId = 'user-1';
      const type = NotificationType.USER_MENTION;
      const notification = NotificationFactory.build({
        userId,
        type,
        authorId: userId,
      });

      mockDatabase.notification.create.mockResolvedValue({
        ...notification,
        author: {
          id: userId,
          username: 'test',
          displayName: null,
          avatarUrl: null,
        },
        message: null,
      });

      const result = await service.createTestNotification(userId, type);

      expect(result).toBeDefined();
      expect(result.type).toBe(type);
    });
  });

  describe('clearUserNotificationData', () => {
    it('should delete all notification data for the user', async () => {
      const userId = 'user-1';

      mockDatabase.notification.deleteMany.mockResolvedValue({ count: 5 });
      mockDatabase.userNotificationSettings.deleteMany.mockResolvedValue({
        count: 1,
      });
      mockDatabase.channelNotificationOverride.deleteMany.mockResolvedValue({
        count: 3,
      });

      const result = await service.clearUserNotificationData(userId);

      expect(result).toEqual({
        notificationsDeleted: 5,
        settingsDeleted: 1,
        overridesDeleted: 3,
      });

      expect(mockDatabase.notification.deleteMany).toHaveBeenCalledWith({
        where: { userId },
      });
      expect(
        mockDatabase.userNotificationSettings.deleteMany,
      ).toHaveBeenCalledWith({
        where: { userId },
      });
      expect(
        mockDatabase.channelNotificationOverride.deleteMany,
      ).toHaveBeenCalledWith({
        where: { userId },
      });
    });

    it('should return zeros when no data exists', async () => {
      const userId = 'user-1';

      mockDatabase.notification.deleteMany.mockResolvedValue({ count: 0 });
      mockDatabase.userNotificationSettings.deleteMany.mockResolvedValue({
        count: 0,
      });
      mockDatabase.channelNotificationOverride.deleteMany.mockResolvedValue({
        count: 0,
      });

      const result = await service.clearUserNotificationData(userId);

      expect(result).toEqual({
        notificationsDeleted: 0,
        settingsDeleted: 0,
        overridesDeleted: 0,
      });
    });
  });
});
