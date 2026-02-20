import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { DatabaseService } from '@/database/database.service';
import { flattenSpansToText } from '@/common/utils/text.utils';
import { CreateThreadReplyDto } from './dto/create-thread-reply.dto';
import { Message, $Enums } from '@prisma/client';

/**
 * Service for managing message threads.
 * Handles thread replies, subscriptions, and thread metadata.
 */
@Injectable()
export class ThreadsService {
  private readonly logger = new Logger(ThreadsService.name);

  constructor(private readonly databaseService: DatabaseService) {}

  /**
   * Sanitize spans to only include valid Prisma Span fields.
   * This strips any extra fields that may be sent by the client.
   */
  private sanitizeSpans(
    spans: {
      type: $Enums.SpanType;
      text?: string | null;
      userId?: string | null;
      specialKind?: string | null;
      communityId?: string | null;
      aliasId?: string | null;
    }[],
  ) {
    return spans.map((span) => ({
      type: span.type,
      text: span.text ?? null,
      userId: span.userId ?? null,
      specialKind: span.specialKind ?? null,
      communityId: span.communityId ?? null,
      aliasId: span.aliasId ?? null,
    }));
  }

  /**
   * Get the parent message for a thread.
   * Throws NotFoundException if not found.
   */
  async getParentMessage(parentMessageId: string): Promise<Message> {
    const parent = await this.databaseService.message.findUnique({
      where: { id: parentMessageId },
    });

    if (!parent) {
      throw new NotFoundException('Parent message not found');
    }

    // Prevent nested threads - can't reply to a thread reply
    if (parent.parentMessageId) {
      throw new BadRequestException('Cannot create nested threads');
    }

    return parent;
  }

  /**
   * Create a thread reply message.
   * Also increments the parent's replyCount and auto-subscribes the user.
   */
  async createThreadReply(
    dto: CreateThreadReplyDto,
    authorId: string,
  ): Promise<Message> {
    const { parentMessageId, spans, attachments, pendingAttachments } = dto;

    // Validate parent message exists and isn't a thread reply itself
    const parent = await this.getParentMessage(parentMessageId);

    // Sanitize spans to only include valid Prisma fields
    const sanitizedSpans = this.sanitizeSpans(spans);
    const searchText = flattenSpansToText(sanitizedSpans);

    // Use transaction to ensure atomicity
    const result = await this.databaseService.$transaction(async (tx) => {
      // Create the reply message
      const reply = await tx.message.create({
        data: {
          authorId,
          spans: sanitizedSpans,
          searchText,
          attachments: attachments || [],
          pendingAttachments: pendingAttachments || 0,
          // Use relation connect syntax for Prisma
          ...(parent.channelId && {
            channel: { connect: { id: parent.channelId } },
          }),
          ...(parent.directMessageGroupId && {
            directMessageGroup: {
              connect: { id: parent.directMessageGroupId },
            },
          }),
          parentMessage: { connect: { id: parentMessageId } },
        },
      });

      // Update parent message's reply count and lastReplyAt
      await tx.message.update({
        where: { id: parentMessageId },
        data: {
          replyCount: { increment: 1 },
          lastReplyAt: new Date(),
        },
      });

      // Auto-subscribe the replier to the thread (upsert to avoid duplicates)
      await tx.threadSubscriber.upsert({
        where: {
          userId_parentMessageId: {
            userId: authorId,
            parentMessageId,
          },
        },
        create: {
          userId: authorId,
          parentMessageId,
        },
        update: {}, // No update needed if already subscribed
      });

      return reply;
    });

    this.logger.debug(
      `Created thread reply ${result.id} for parent ${parentMessageId}`,
    );

    return result;
  }

  /**
   * Get paginated thread replies for a parent message.
   */
  async getThreadReplies(
    parentMessageId: string,
    limit = 50,
    continuationToken?: string,
  ): Promise<{ replies: Message[]; continuationToken?: string }> {
    // Verify parent exists
    const parent = await this.databaseService.message.findUnique({
      where: { id: parentMessageId },
      select: { id: true },
    });

    if (!parent) {
      throw new NotFoundException('Parent message not found');
    }

    const replies = await this.databaseService.message.findMany({
      where: { parentMessageId },
      orderBy: { sentAt: 'asc' }, // Oldest first for thread context
      take: limit,
      ...(continuationToken
        ? { cursor: { id: continuationToken }, skip: 1 }
        : {}),
    });

    const nextToken =
      replies.length === limit ? replies[replies.length - 1].id : undefined;

    return { replies, continuationToken: nextToken };
  }

  /**
   * Get thread replies with file metadata enrichment.
   */
  async getThreadRepliesWithMetadata(
    parentMessageId: string,
    limit = 50,
    continuationToken?: string,
  ) {
    const { replies, continuationToken: nextToken } =
      await this.getThreadReplies(parentMessageId, limit, continuationToken);

    // Collect all unique file IDs
    const allFileIds = new Set<string>();
    replies.forEach((msg) => {
      msg.attachments.forEach((fileId) => allFileIds.add(fileId));
    });

    // Fetch all files in a single query
    const files =
      allFileIds.size > 0
        ? await this.databaseService.file.findMany({
            where: { id: { in: Array.from(allFileIds) } },
            select: {
              id: true,
              filename: true,
              mimeType: true,
              fileType: true,
              size: true,
              thumbnailPath: true,
            },
          })
        : [];

    const fileMap = new Map(files.map((file) => [file.id, file]));

    // Transform replies to include file metadata (convert thumbnailPath to hasThumbnail)
    const repliesWithMetadata = replies.map((reply) => ({
      ...reply,
      attachments: reply.attachments
        .map((fileId) => fileMap.get(fileId))
        .filter((file): file is NonNullable<typeof file> => file !== undefined)
        .map((file) => ({
          id: file.id,
          filename: file.filename,
          mimeType: file.mimeType,
          fileType: file.fileType,
          size: file.size,
          hasThumbnail: !!file.thumbnailPath,
        })),
    }));

    return { replies: repliesWithMetadata, continuationToken: nextToken };
  }

  /**
   * Subscribe a user to a thread.
   */
  async subscribeToThread(
    parentMessageId: string,
    userId: string,
  ): Promise<void> {
    // Verify parent exists and isn't a thread reply
    await this.getParentMessage(parentMessageId);

    await this.databaseService.threadSubscriber.upsert({
      where: {
        userId_parentMessageId: {
          userId,
          parentMessageId,
        },
      },
      create: {
        userId,
        parentMessageId,
      },
      update: {},
    });

    this.logger.debug(`User ${userId} subscribed to thread ${parentMessageId}`);
  }

  /**
   * Unsubscribe a user from a thread.
   */
  async unsubscribeFromThread(
    parentMessageId: string,
    userId: string,
  ): Promise<void> {
    await this.databaseService.threadSubscriber.deleteMany({
      where: {
        userId,
        parentMessageId,
      },
    });

    this.logger.debug(
      `User ${userId} unsubscribed from thread ${parentMessageId}`,
    );
  }

  /**
   * Get all subscribers for a thread (for notifications).
   * Excludes the specified user (typically the message author).
   */
  async getThreadSubscribers(
    parentMessageId: string,
    excludeUserId?: string,
  ): Promise<string[]> {
    const subscribers = await this.databaseService.threadSubscriber.findMany({
      where: {
        parentMessageId,
        ...(excludeUserId ? { userId: { not: excludeUserId } } : {}),
      },
      select: { userId: true },
    });

    return subscribers.map((s) => s.userId);
  }

  /**
   * Check if a user is subscribed to a thread.
   */
  async isSubscribed(
    parentMessageId: string,
    userId: string,
  ): Promise<boolean> {
    const subscription = await this.databaseService.threadSubscriber.findUnique(
      {
        where: {
          userId_parentMessageId: {
            userId,
            parentMessageId,
          },
        },
      },
    );

    return !!subscription;
  }

  /**
   * Get thread metadata for a parent message.
   * Returns reply count, last reply time, and subscription status.
   */
  async getThreadMetadata(parentMessageId: string, userId?: string) {
    const parent = await this.databaseService.message.findUnique({
      where: { id: parentMessageId },
      select: {
        id: true,
        replyCount: true,
        lastReplyAt: true,
      },
    });

    if (!parent) {
      throw new NotFoundException('Message not found');
    }

    let isSubscribed = false;
    if (userId) {
      isSubscribed = await this.isSubscribed(parentMessageId, userId);
    }

    return {
      parentMessageId: parent.id,
      replyCount: parent.replyCount,
      lastReplyAt: parent.lastReplyAt,
      isSubscribed,
    };
  }

  /**
   * Decrement reply count when a thread reply is deleted.
   */
  async decrementReplyCount(parentMessageId: string): Promise<void> {
    await this.databaseService.message.update({
      where: { id: parentMessageId },
      data: {
        replyCount: { decrement: 1 },
      },
    });
  }
}
