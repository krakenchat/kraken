import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { DatabaseService } from '@/database/database.service';
import { MarkAsReadDto } from './dto/mark-as-read.dto';

export interface UnreadCount {
  channelId?: string;
  directMessageGroupId?: string;
  unreadCount: number;
  lastReadMessageId?: string;
  lastReadAt?: Date;
}

@Injectable()
export class ReadReceiptsService {
  private readonly logger = new Logger(ReadReceiptsService.name);

  constructor(private readonly databaseService: DatabaseService) {}

  /**
   * Mark messages as read up to a specific message ID
   * Creates or updates a read receipt for the user
   */
  async markAsRead(userId: string, markAsReadDto: MarkAsReadDto) {
    const { lastReadMessageId, channelId, directMessageGroupId } =
      markAsReadDto;

    // Validate that exactly one of channelId or directMessageGroupId is provided
    if (
      (!channelId && !directMessageGroupId) ||
      (channelId && directMessageGroupId)
    ) {
      throw new BadRequestException(
        'Must provide exactly one of channelId or directMessageGroupId',
      );
    }

    // Verify the message exists and belongs to the specified channel/DM group
    const message = await this.databaseService.message.findUnique({
      where: { id: lastReadMessageId },
    });

    if (!message) {
      throw new BadRequestException('Message not found');
    }

    if (
      (channelId && message.channelId !== channelId) ||
      (directMessageGroupId &&
        message.directMessageGroupId !== directMessageGroupId)
    ) {
      throw new BadRequestException(
        'Message does not belong to the specified channel or DM group',
      );
    }

    // Upsert the read receipt
    const readReceipt = channelId
      ? await this.databaseService.readReceipt.upsert({
          where: { userId_channelId: { userId, channelId } },
          update: {
            lastReadMessageId,
            lastReadAt: new Date(),
          },
          create: {
            userId,
            channelId,
            lastReadMessageId,
            lastReadAt: new Date(),
          },
        })
      : await this.databaseService.readReceipt.upsert({
          where: {
            userId_directMessageGroupId: {
              userId,
              directMessageGroupId: directMessageGroupId!,
            },
          },
          update: {
            lastReadMessageId,
            lastReadAt: new Date(),
          },
          create: {
            userId,
            directMessageGroupId: directMessageGroupId!,
            lastReadMessageId,
            lastReadAt: new Date(),
          },
        });

    this.logger.debug(
      `User ${userId} marked ${channelId || directMessageGroupId} as read up to message ${lastReadMessageId}`,
    );

    return readReceipt;
  }

  /**
   * Get the unread count for a specific channel or DM group
   */
  async getUnreadCount(
    userId: string,
    channelId?: string,
    directMessageGroupId?: string,
  ): Promise<UnreadCount> {
    // Validate that exactly one is provided
    if (
      (!channelId && !directMessageGroupId) ||
      (channelId && directMessageGroupId)
    ) {
      throw new BadRequestException(
        'Must provide exactly one of channelId or directMessageGroupId',
      );
    }

    // Find the read receipt
    const readReceipt = await this.databaseService.readReceipt.findUnique({
      where: channelId
        ? { userId_channelId: { userId, channelId } }
        : {
            userId_directMessageGroupId: {
              userId,
              directMessageGroupId: directMessageGroupId!,
            },
          },
    });

    // If no read receipt exists, all messages are unread
    if (!readReceipt) {
      const unreadCount = await this.databaseService.message.count({
        where: channelId ? { channelId } : { directMessageGroupId },
      });

      return {
        channelId,
        directMessageGroupId,
        unreadCount,
      };
    }

    // Find the last read message to get its timestamp
    const lastReadMessage = await this.databaseService.message.findUnique({
      where: { id: readReceipt.lastReadMessageId },
      select: { sentAt: true },
    });

    if (!lastReadMessage) {
      // If the last read message was deleted, treat all messages as unread
      const unreadCount = await this.databaseService.message.count({
        where: channelId ? { channelId } : { directMessageGroupId },
      });

      return {
        channelId,
        directMessageGroupId,
        unreadCount,
      };
    }

    // Count messages sent after the last read message
    const unreadCount = await this.databaseService.message.count({
      where: {
        ...(channelId ? { channelId } : { directMessageGroupId }),
        sentAt: { gt: lastReadMessage.sentAt },
      },
    });

    return {
      channelId,
      directMessageGroupId,
      unreadCount,
      lastReadMessageId: readReceipt.lastReadMessageId,
      lastReadAt: readReceipt.lastReadAt,
    };
  }

  /**
   * Get unread counts for all channels and DM groups the user has access to
   * Optimized to avoid N+1 queries by batching database operations
   */
  async getUnreadCounts(userId: string): Promise<UnreadCount[]> {
    // Get all read receipts for this user
    const readReceipts = await this.databaseService.readReceipt.findMany({
      where: { userId },
    });

    // Get all channels the user is a member of (through community membership)
    const memberships = await this.databaseService.membership.findMany({
      where: { userId },
      include: {
        community: {
          include: {
            channels: {
              where: {
                OR: [
                  { isPrivate: false }, // Public channels
                  {
                    ChannelMembership: {
                      some: { userId },
                    },
                  }, // Private channels where user is a member
                ],
              },
            },
          },
        },
      },
    });

    // Get all DM groups the user is a member of
    const dmGroupMemberships =
      await this.databaseService.directMessageGroupMember.findMany({
        where: { userId },
        include: {
          group: true,
        },
      });

    // Build a list of all channel IDs and DM group IDs
    const channelIds = memberships.flatMap((m) =>
      m.community.channels.map((c) => c.id),
    );
    const dmGroupIds = dmGroupMemberships.map((dm) => dm.groupId);

    const unreadCounts: UnreadCount[] = [];

    // Batch fetch all last read message timestamps
    const lastReadMessageIds = readReceipts
      .map((r) => r.lastReadMessageId)
      .filter(Boolean);

    const lastReadMessages =
      lastReadMessageIds.length > 0
        ? await this.databaseService.message.findMany({
            where: { id: { in: lastReadMessageIds } },
            select: { id: true, sentAt: true },
          })
        : [];

    const lastReadMessageMap = new Map(
      lastReadMessages.map((m) => [m.id, m.sentAt]),
    );

    // Batch count all messages for channels/DMs without read receipts
    const channelsWithoutReceipt = channelIds.filter(
      (id) => !readReceipts.some((r) => r.channelId === id),
    );
    const dmGroupsWithoutReceipt = dmGroupIds.filter(
      (id) => !readReceipts.some((r) => r.directMessageGroupId === id),
    );

    // Parallel batch counting for channels and DMs without receipts
    const [channelCounts, dmGroupCounts] = await Promise.all([
      channelsWithoutReceipt.length > 0
        ? this.databaseService.message.groupBy({
            by: ['channelId'],
            where: { channelId: { in: channelsWithoutReceipt } },
            _count: { channelId: true },
          })
        : Promise.resolve([]),
      dmGroupsWithoutReceipt.length > 0
        ? this.databaseService.message.groupBy({
            by: ['directMessageGroupId'],
            where: { directMessageGroupId: { in: dmGroupsWithoutReceipt } },
            _count: { directMessageGroupId: true },
          })
        : Promise.resolve([]),
    ]);

    // Add counts for channels/DMs without read receipts
    for (const count of channelCounts) {
      unreadCounts.push({
        channelId: count.channelId!,
        unreadCount: count._count.channelId,
      });
    }
    for (const count of dmGroupCounts) {
      unreadCounts.push({
        directMessageGroupId: count.directMessageGroupId!,
        unreadCount: count._count.directMessageGroupId,
      });
    }

    // Process channels with read receipts
    const channelReceipts = readReceipts.filter((r) => r.channelId);
    for (const receipt of channelReceipts) {
      const lastReadAt = lastReadMessageMap.get(receipt.lastReadMessageId);

      if (!lastReadAt) {
        // Last read message was deleted, count all messages
        const count = await this.databaseService.message.count({
          where: { channelId: receipt.channelId! },
        });
        unreadCounts.push({ channelId: receipt.channelId!, unreadCount: count });
      } else {
        // Count messages after last read timestamp
        const count = await this.databaseService.message.count({
          where: {
            channelId: receipt.channelId!,
            sentAt: { gt: lastReadAt },
          },
        });
        unreadCounts.push({
          channelId: receipt.channelId!,
          unreadCount: count,
          lastReadMessageId: receipt.lastReadMessageId,
          lastReadAt: receipt.lastReadAt,
        });
      }
    }

    // Process DM groups with read receipts
    const dmReceipts = readReceipts.filter((r) => r.directMessageGroupId);
    for (const receipt of dmReceipts) {
      const lastReadAt = lastReadMessageMap.get(receipt.lastReadMessageId);

      if (!lastReadAt) {
        // Last read message was deleted, count all messages
        const count = await this.databaseService.message.count({
          where: { directMessageGroupId: receipt.directMessageGroupId! },
        });
        unreadCounts.push({
          directMessageGroupId: receipt.directMessageGroupId!,
          unreadCount: count,
        });
      } else {
        // Count messages after last read timestamp
        const count = await this.databaseService.message.count({
          where: {
            directMessageGroupId: receipt.directMessageGroupId!,
            sentAt: { gt: lastReadAt },
          },
        });
        unreadCounts.push({
          directMessageGroupId: receipt.directMessageGroupId!,
          unreadCount: count,
          lastReadMessageId: receipt.lastReadMessageId,
          lastReadAt: receipt.lastReadAt,
        });
      }
    }

    return unreadCounts;
  }

  /**
   * Get the last read message ID for a specific channel or DM group
   */
  async getLastReadMessageId(
    userId: string,
    channelId?: string,
    directMessageGroupId?: string,
  ): Promise<string | null> {
    if (
      (!channelId && !directMessageGroupId) ||
      (channelId && directMessageGroupId)
    ) {
      throw new BadRequestException(
        'Must provide exactly one of channelId or directMessageGroupId',
      );
    }

    const readReceipt = await this.databaseService.readReceipt.findUnique({
      where: channelId
        ? { userId_channelId: { userId, channelId } }
        : {
            userId_directMessageGroupId: {
              userId,
              directMessageGroupId: directMessageGroupId!,
            },
          },
    });

    return readReceipt?.lastReadMessageId || null;
  }
}
