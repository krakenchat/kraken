import { Injectable, Logger, NotFoundException, forwardRef, Inject } from '@nestjs/common';
import { DatabaseService } from '@/database/database.service';
import {
  Message,
  SpanType,
  NotificationType,
  Notification,
  UserNotificationSettings,
  ChannelNotificationOverride,
} from '@prisma/client';
import { CreateNotificationDto } from './dto/create-notification.dto';
import { UpdateNotificationSettingsDto } from './dto/update-notification-settings.dto';
import { UpdateChannelOverrideDto } from './dto/update-channel-override.dto';
import { NotificationQueryDto } from './dto/notification-query.dto';
import { NotificationsGateway } from './notifications.gateway';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly databaseService: DatabaseService,
    @Inject(forwardRef(() => NotificationsGateway))
    private readonly notificationsGateway: NotificationsGateway,
  ) {}

  /**
   * Process a message to detect mentions and create notifications
   * This is the main entry point called after a message is created
   */
  async processMessageForNotifications(message: Message): Promise<void> {
    try {
      // Don't create notifications for deleted messages
      if (message.deletedAt) {
        return;
      }

      const mentionedUserIds = new Set<string>();

      // Extract mentioned users from spans
      for (const span of message.spans) {
        if (span.type === SpanType.USER_MENTION && span.userId) {
          mentionedUserIds.add(span.userId);
        }

        // Handle @here and @channel special mentions
        if (span.type === SpanType.SPECIAL_MENTION) {
          const users = await this.getSpecialMentionUsers(
            message.channelId,
            span.specialKind,
          );
          users.forEach((userId) => mentionedUserIds.add(userId));
        }
      }

      // Remove the author from mentioned users (don't notify yourself)
      mentionedUserIds.delete(message.authorId);

      // Create notifications for mentioned users
      const mentionPromises = Array.from(mentionedUserIds).map((userId) =>
        this.createNotificationIfAllowed(
          userId,
          message.channelId
            ? NotificationType.USER_MENTION
            : NotificationType.DIRECT_MESSAGE,
          message,
        ),
      );

      await Promise.all(mentionPromises);

      // Handle DM notifications (if no mentions, still notify all DM members)
      if (message.directMessageGroupId && mentionedUserIds.size === 0) {
        await this.createDMNotifications(message);
      }
    } catch (error) {
      this.logger.error(
        `Error processing message ${message.id} for notifications`,
        error,
      );
      // Don't throw - notification failures shouldn't break message sending
    }
  }

  /**
   * Get users for special mentions (@here, @channel)
   */
  private async getSpecialMentionUsers(
    channelId: string | null,
    specialKind: string | null,
  ): Promise<string[]> {
    if (!channelId) return [];

    if (specialKind === 'channel') {
      // @channel - all channel members
      const memberships = await this.databaseService.channelMembership.findMany(
        {
          where: { channelId },
          select: { userId: true },
        },
      );
      return memberships.map((m) => m.userId);
    }

    if (specialKind === 'here') {
      // @here - only online members (users with recent lastSeen)
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
      const memberships = await this.databaseService.channelMembership.findMany(
        {
          where: { channelId },
          include: {
            user: {
              select: { id: true, lastSeen: true },
            },
          },
        },
      );

      return memberships
        .filter((m) => m.user.lastSeen && m.user.lastSeen > fiveMinutesAgo)
        .map((m) => m.userId);
    }

    return [];
  }

  /**
   * Create DM notifications for all members except author
   */
  private async createDMNotifications(message: Message): Promise<void> {
    if (!message.directMessageGroupId) return;

    const members =
      await this.databaseService.directMessageGroupMember.findMany({
        where: { groupId: message.directMessageGroupId },
        select: { userId: true },
      });

    const notificationPromises = members
      .filter((m) => m.userId !== message.authorId)
      .map((m) =>
        this.createNotificationIfAllowed(
          m.userId,
          NotificationType.DIRECT_MESSAGE,
          message,
        ),
      );

    await Promise.all(notificationPromises);
  }

  /**
   * Create a notification if user's settings allow it
   */
  private async createNotificationIfAllowed(
    userId: string,
    type: NotificationType,
    message: Message,
  ): Promise<Notification | null> {
    // Check if user should be notified based on settings
    const shouldNotify = await this.shouldNotify(
      userId,
      message.channelId,
      message.directMessageGroupId,
      type,
    );

    if (!shouldNotify) {
      return null;
    }

    return this.createNotification({
      userId,
      type,
      messageId: message.id,
      channelId: message.channelId ?? undefined,
      directMessageGroupId: message.directMessageGroupId ?? undefined,
      authorId: message.authorId,
    });
  }

  /**
   * Check if user should receive notification based on settings
   */
  async shouldNotify(
    userId: string,
    channelId: string | null,
    directMessageGroupId: string | null,
    type: NotificationType,
  ): Promise<boolean> {
    // Get user notification settings (creates default if missing)
    const settings = await this.getUserSettings(userId);

    // Check if desktop notifications are globally disabled
    if (!settings.desktopEnabled) {
      return false;
    }

    // Check DND mode
    if (settings.doNotDisturb) {
      const isInDND = this.isInDoNotDisturbWindow(
        settings.dndStartTime,
        settings.dndEndTime,
      );
      if (isInDND) {
        return false;
      }
    }

    // Check DM notifications
    if (type === NotificationType.DIRECT_MESSAGE && !settings.dmNotifications) {
      return false;
    }

    // Check channel-specific settings
    if (channelId) {
      const channelOverride = await this.getChannelOverride(userId, channelId);
      const level = channelOverride?.level ?? settings.defaultChannelLevel;

      if (level === 'none') {
        return false;
      }

      if (level === 'mentions' && type === NotificationType.CHANNEL_MESSAGE) {
        return false;
      }
    }

    return true;
  }

  /**
   * Check if current time is within DND window
   */
  private isInDoNotDisturbWindow(
    startTime: string | null,
    endTime: string | null,
  ): boolean {
    if (!startTime || !endTime) {
      return false;
    }

    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();

    const [startHour, startMinute] = startTime.split(':').map(Number);
    const startMinutes = startHour * 60 + startMinute;

    const [endHour, endMinute] = endTime.split(':').map(Number);
    const endMinutes = endHour * 60 + endMinute;

    // Handle overnight DND (e.g., 22:00 - 08:00)
    if (startMinutes > endMinutes) {
      return currentMinutes >= startMinutes || currentMinutes < endMinutes;
    }

    // Normal DND window
    return currentMinutes >= startMinutes && currentMinutes < endMinutes;
  }

  /**
   * Create a notification record and emit WebSocket event
   */
  async createNotification(dto: CreateNotificationDto): Promise<Notification> {
    const notification = await this.databaseService.notification.create({
      data: {
        userId: dto.userId,
        type: dto.type,
        messageId: dto.messageId,
        channelId: dto.channelId,
        directMessageGroupId: dto.directMessageGroupId,
        authorId: dto.authorId,
      },
      include: {
        author: {
          select: {
            id: true,
            username: true,
            displayName: true,
            avatarUrl: true,
          },
        },
        message: {
          select: {
            id: true,
            spans: true,
          },
        },
      },
    });

    // Emit WebSocket event to notify the user in real-time
    this.notificationsGateway.emitNotificationToUser(dto.userId, notification);

    return notification;
  }

  /**
   * Get notifications for a user with pagination
   */
  async getUserNotifications(
    userId: string,
    query: NotificationQueryDto,
  ): Promise<Notification[]> {
    const { unreadOnly, limit = 50, offset = 0 } = query;

    return this.databaseService.notification.findMany({
      where: {
        userId,
        ...(unreadOnly && { read: false }),
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
      include: {
        author: {
          select: {
            id: true,
            username: true,
            displayName: true,
            avatarUrl: true,
          },
        },
        message: {
          select: {
            id: true,
            spans: true,
            channelId: true,
            directMessageGroupId: true,
          },
        },
      },
    });
  }

  /**
   * Get unread notification count for user
   */
  async getUnreadCount(userId: string): Promise<number> {
    return this.databaseService.notification.count({
      where: {
        userId,
        read: false,
      },
    });
  }

  /**
   * Mark a notification as read and emit WebSocket event
   */
  async markAsRead(
    notificationId: string,
    userId: string,
  ): Promise<Notification> {
    // Verify notification belongs to user
    const notification = await this.databaseService.notification.findFirst({
      where: { id: notificationId, userId },
    });

    if (!notification) {
      throw new NotFoundException('Notification not found');
    }

    const updatedNotification = await this.databaseService.notification.update({
      where: { id: notificationId },
      data: { read: true },
    });

    // Emit WebSocket event to update other connected clients
    this.notificationsGateway.emitNotificationRead(userId, notificationId);

    return updatedNotification;
  }

  /**
   * Mark all notifications as read for a user
   */
  async markAllAsRead(userId: string): Promise<{ count: number }> {
    const result = await this.databaseService.notification.updateMany({
      where: { userId, read: false },
      data: { read: true },
    });

    return { count: result.count };
  }

  /**
   * Dismiss a notification
   */
  async dismissNotification(
    notificationId: string,
    userId: string,
  ): Promise<Notification> {
    const notification = await this.databaseService.notification.findFirst({
      where: { id: notificationId, userId },
    });

    if (!notification) {
      throw new NotFoundException('Notification not found');
    }

    return this.databaseService.notification.update({
      where: { id: notificationId },
      data: { dismissed: true },
    });
  }

  /**
   * Delete a notification
   */
  async deleteNotification(
    notificationId: string,
    userId: string,
  ): Promise<void> {
    const notification = await this.databaseService.notification.findFirst({
      where: { id: notificationId, userId },
    });

    if (!notification) {
      throw new NotFoundException('Notification not found');
    }

    await this.databaseService.notification.delete({
      where: { id: notificationId },
    });
  }

  /**
   * Get user notification settings (creates default if missing)
   */
  async getUserSettings(userId: string): Promise<UserNotificationSettings> {
    let settings =
      await this.databaseService.userNotificationSettings.findUnique({
        where: { userId },
      });

    if (!settings) {
      // Create default settings
      settings = await this.databaseService.userNotificationSettings.create({
        data: { userId },
      });
    }

    return settings;
  }

  /**
   * Update user notification settings
   */
  async updateUserSettings(
    userId: string,
    dto: UpdateNotificationSettingsDto,
  ): Promise<UserNotificationSettings> {
    // Ensure settings exist
    await this.getUserSettings(userId);

    return this.databaseService.userNotificationSettings.update({
      where: { userId },
      data: dto,
    });
  }

  /**
   * Get channel notification override for user
   */
  async getChannelOverride(
    userId: string,
    channelId: string,
  ): Promise<ChannelNotificationOverride | null> {
    return this.databaseService.channelNotificationOverride.findUnique({
      where: {
        userId_channelId: { userId, channelId },
      },
    });
  }

  /**
   * Set channel notification override
   */
  async setChannelOverride(
    userId: string,
    channelId: string,
    dto: UpdateChannelOverrideDto,
  ): Promise<ChannelNotificationOverride> {
    return this.databaseService.channelNotificationOverride.upsert({
      where: {
        userId_channelId: { userId, channelId },
      },
      update: {
        level: dto.level,
      },
      create: {
        userId,
        channelId,
        level: dto.level,
      },
    });
  }

  /**
   * Delete channel notification override
   */
  async deleteChannelOverride(
    userId: string,
    channelId: string,
  ): Promise<void> {
    await this.databaseService.channelNotificationOverride.deleteMany({
      where: { userId, channelId },
    });
  }
}
