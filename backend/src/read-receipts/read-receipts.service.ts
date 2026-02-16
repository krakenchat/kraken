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

/** Filter to exclude thread replies from message counts.
 *  Uses OR pattern for backward compat with messages that predate the field. */
const EXCLUDE_THREAD_REPLIES = {
  OR: [
    { parentMessageId: null },
    { NOT: { parentMessageId: { isSet: true } } },
  ],
};

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

    // Guard against watermark regression: only advance, never go backwards
    const existingReceipt = await this.databaseService.readReceipt.findUnique({
      where: channelId
        ? { userId_channelId: { userId, channelId } }
        : {
            userId_directMessageGroupId: {
              userId,
              directMessageGroupId: directMessageGroupId!,
            },
          },
    });

    if (existingReceipt) {
      const currentWatermarkMessage =
        await this.databaseService.message.findUnique({
          where: { id: existingReceipt.lastReadMessageId },
          select: { sentAt: true },
        });

      // If the current watermark message still exists and is newer than (or same as)
      // the incoming message, skip the update to prevent regression
      if (
        currentWatermarkMessage &&
        currentWatermarkMessage.sentAt >= message.sentAt
      ) {
        return existingReceipt;
      }
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
        where: {
          ...(channelId ? { channelId } : { directMessageGroupId }),
          ...EXCLUDE_THREAD_REPLIES,
        },
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
        where: {
          ...(channelId ? { channelId } : { directMessageGroupId }),
          ...EXCLUDE_THREAD_REPLIES,
        },
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
        ...EXCLUDE_THREAD_REPLIES,
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
            where: {
              channelId: { in: channelsWithoutReceipt },
              ...EXCLUDE_THREAD_REPLIES,
            },
            _count: { channelId: true },
          })
        : Promise.resolve([]),
      dmGroupsWithoutReceipt.length > 0
        ? this.databaseService.message.groupBy({
            by: ['directMessageGroupId'],
            where: {
              directMessageGroupId: { in: dmGroupsWithoutReceipt },
              ...EXCLUDE_THREAD_REPLIES,
            },
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
    const channelReceiptsWithTimestamp: Array<{
      channelId: string;
      lastReadMessageId: string;
      lastReadAt: Date;
      lastReadAtDate: Date;
    }> = [];
    const channelReceiptsWithoutTimestamp: string[] = [];

    for (const receipt of channelReceipts) {
      const lastReadAt = lastReadMessageMap.get(receipt.lastReadMessageId);
      if (lastReadAt) {
        channelReceiptsWithTimestamp.push({
          channelId: receipt.channelId!,
          lastReadMessageId: receipt.lastReadMessageId,
          lastReadAt: receipt.lastReadAt,
          lastReadAtDate: lastReadAt,
        });
      } else {
        channelReceiptsWithoutTimestamp.push(receipt.channelId!);
      }
    }

    // Batch: channels where last read message was deleted — count all messages
    if (channelReceiptsWithoutTimestamp.length > 0) {
      const counts = await this.databaseService.message.groupBy({
        by: ['channelId'],
        where: {
          channelId: { in: channelReceiptsWithoutTimestamp },
          ...EXCLUDE_THREAD_REPLIES,
        },
        _count: { channelId: true },
      });
      const countMap = new Map(
        counts.map((c) => [c.channelId!, c._count.channelId]),
      );
      for (const channelId of channelReceiptsWithoutTimestamp) {
        unreadCounts.push({
          channelId,
          unreadCount: countMap.get(channelId) ?? 0,
        });
      }
    }

    // Parallel: channels with valid timestamps — each has different sentAt threshold
    if (channelReceiptsWithTimestamp.length > 0) {
      const results = await Promise.all(
        channelReceiptsWithTimestamp.map(async (receipt) => {
          const count = await this.databaseService.message.count({
            where: {
              channelId: receipt.channelId,
              sentAt: { gt: receipt.lastReadAtDate },
              ...EXCLUDE_THREAD_REPLIES,
            },
          });
          return {
            channelId: receipt.channelId,
            unreadCount: count,
            lastReadMessageId: receipt.lastReadMessageId,
            lastReadAt: receipt.lastReadAt,
          };
        }),
      );
      unreadCounts.push(...results);
    }

    // Process DM groups with read receipts
    const dmReceipts = readReceipts.filter((r) => r.directMessageGroupId);
    const dmReceiptsWithTimestamp: Array<{
      directMessageGroupId: string;
      lastReadMessageId: string;
      lastReadAt: Date;
      lastReadAtDate: Date;
    }> = [];
    const dmReceiptsWithoutTimestamp: string[] = [];

    for (const receipt of dmReceipts) {
      const lastReadAt = lastReadMessageMap.get(receipt.lastReadMessageId);
      if (lastReadAt) {
        dmReceiptsWithTimestamp.push({
          directMessageGroupId: receipt.directMessageGroupId!,
          lastReadMessageId: receipt.lastReadMessageId,
          lastReadAt: receipt.lastReadAt,
          lastReadAtDate: lastReadAt,
        });
      } else {
        dmReceiptsWithoutTimestamp.push(receipt.directMessageGroupId!);
      }
    }

    // Batch: DM groups where last read message was deleted — count all messages
    if (dmReceiptsWithoutTimestamp.length > 0) {
      const counts = await this.databaseService.message.groupBy({
        by: ['directMessageGroupId'],
        where: {
          directMessageGroupId: { in: dmReceiptsWithoutTimestamp },
          ...EXCLUDE_THREAD_REPLIES,
        },
        _count: { directMessageGroupId: true },
      });
      const countMap = new Map(
        counts.map((c) => [
          c.directMessageGroupId!,
          c._count.directMessageGroupId,
        ]),
      );
      for (const dmGroupId of dmReceiptsWithoutTimestamp) {
        unreadCounts.push({
          directMessageGroupId: dmGroupId,
          unreadCount: countMap.get(dmGroupId) ?? 0,
        });
      }
    }

    // Parallel: DM groups with valid timestamps
    if (dmReceiptsWithTimestamp.length > 0) {
      const results = await Promise.all(
        dmReceiptsWithTimestamp.map(async (receipt) => {
          const count = await this.databaseService.message.count({
            where: {
              directMessageGroupId: receipt.directMessageGroupId,
              sentAt: { gt: receipt.lastReadAtDate },
              ...EXCLUDE_THREAD_REPLIES,
            },
          });
          return {
            directMessageGroupId: receipt.directMessageGroupId,
            unreadCount: count,
            lastReadMessageId: receipt.lastReadMessageId,
            lastReadAt: receipt.lastReadAt,
          };
        }),
      );
      unreadCounts.push(...results);
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

  /**
   * Get all users who have read a specific message
   * A message is considered "read" if the user's lastReadAt >= message.sentAt
   */
  async getMessageReaders(
    messageId: string,
    channelId?: string,
    directMessageGroupId?: string,
    excludeUserId?: string,
  ) {
    if (
      (!channelId && !directMessageGroupId) ||
      (channelId && directMessageGroupId)
    ) {
      throw new BadRequestException(
        'Must provide exactly one of channelId or directMessageGroupId',
      );
    }

    // Get the message to know its timestamp
    const message = await this.databaseService.message.findUnique({
      where: { id: messageId },
      select: { sentAt: true, channelId: true, directMessageGroupId: true },
    });

    if (!message) {
      throw new BadRequestException('Message not found');
    }

    // Verify the message belongs to the specified context
    if (
      (channelId && message.channelId !== channelId) ||
      (directMessageGroupId &&
        message.directMessageGroupId !== directMessageGroupId)
    ) {
      throw new BadRequestException(
        'Message does not belong to the specified channel or DM group',
      );
    }

    // Find all read receipts where:
    // 1. The receipt is for the same channel/DM
    // 2. The lastReadAt is >= message.sentAt (meaning they've read past this message)
    const readReceipts = await this.databaseService.readReceipt.findMany({
      where: {
        ...(channelId ? { channelId } : { directMessageGroupId }),
        lastReadAt: { gte: message.sentAt },
      },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            displayName: true,
            avatarUrl: true,
          },
        },
      },
    });

    return readReceipts
      .filter((r) => r.user !== null)
      .filter((r) => !excludeUserId || r.user!.id !== excludeUserId)
      .map((r) => ({
        userId: r.user!.id,
        username: r.user!.username,
        displayName: r.user!.displayName,
        avatarUrl: r.user!.avatarUrl,
        readAt: r.lastReadAt,
      }));
  }
}
