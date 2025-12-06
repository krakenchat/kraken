import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { CreateMessageDto } from './dto/create-message.dto';
import { UpdateMessageDto } from './dto/update-message.dto';
import { DatabaseService } from '@/database/database.service';
import { FileService } from '@/file/file.service';
import { Message, Prisma } from '@prisma/client';

/**
 * Raw MongoDB document structure returned by aggregateRaw
 * MongoDB returns ObjectIds and dates in extended JSON format
 */
interface RawMongoMessage {
  _id: { $oid: string };
  channelId?: { $oid: string } | null;
  directMessageGroupId?: { $oid: string } | null;
  authorId: { $oid: string };
  sentAt: { $date: string };
  editedAt?: { $date: string } | null;
  deletedAt?: { $date: string } | null;
  pinnedAt?: { $date: string } | null;
  attachments: string[];
  spans: Prisma.JsonValue;
  searchText?: string | null;
  reactions: Prisma.JsonValue;
  replyToId?: { $oid: string } | null;
  pendingAttachments?: number | null;
  pinned?: boolean;
  pinnedBy?: { $oid: string } | null;
  deletedBy?: { $oid: string } | null;
  deletedByReason?: string | null;
}

@Injectable()
export class MessagesService {
  private readonly logger = new Logger(MessagesService.name);

  constructor(
    private readonly databaseService: DatabaseService,
    private readonly fileService: FileService,
  ) {}

  /**
   * Flattens message spans into a single searchable text string.
   * Extracts text from all spans and joins them with spaces.
   * Returns lowercase for case-insensitive search compatibility with MongoDB.
   */
  private flattenSpansToText(
    spans: { text: string | null }[],
  ): string | undefined {
    const text = spans
      .filter((span) => span.text)
      .map((span) => span.text)
      .join(' ')
      .trim()
      .toLowerCase(); // Store as lowercase for MongoDB case-insensitive search
    return text.length > 0 ? text : undefined;
  }

  async create(createMessageDto: CreateMessageDto) {
    const searchText = this.flattenSpansToText(createMessageDto.spans);
    return this.databaseService.message.create({
      data: {
        ...createMessageDto,
        searchText,
      },
    });
  }

  async findOne(id: string) {
    try {
      return await this.databaseService.message.findUniqueOrThrow({
        where: { id },
      });
    } catch (error) {
      this.logger.error('Error finding message', error);
      throw new NotFoundException('Message not found');
    }
  }

  async update(
    id: string,
    updateMessageDto: UpdateMessageDto,
    originalAttachments?: string[],
  ) {
    try {
      // Wrap in transaction to ensure message update and file marking are atomic
      return await this.databaseService.$transaction(
        async (tx: Prisma.TransactionClient) => {
          // If spans are being updated, recompute searchText
          const dataToUpdate = { ...updateMessageDto };
          if (updateMessageDto.spans) {
            (dataToUpdate as Record<string, unknown>).searchText =
              this.flattenSpansToText(updateMessageDto.spans);
          }

          // Update the message first
          const updatedMessage = await tx.message.update({
            where: { id },
            data: dataToUpdate,
          });

          // If attachments are being updated and we have the original list, mark removed ones for deletion
          if (
            updateMessageDto.attachments &&
            originalAttachments &&
            Array.isArray(originalAttachments)
          ) {
            const newAttachments = updateMessageDto.attachments;
            const removedAttachments = originalAttachments.filter(
              (oldId) => !newAttachments.includes(oldId),
            );

            // Mark removed attachments for deletion within transaction
            for (const fileId of removedAttachments) {
              await this.fileService.markForDeletion(fileId, tx);
            }

            if (removedAttachments.length > 0) {
              this.logger.debug(
                `Marked ${removedAttachments.length} removed attachments for deletion`,
              );
            }
          }

          return updatedMessage;
        },
      );
    } catch (error) {
      this.logger.error('Error updating message', error);
      throw error;
    }
  }

  async remove(id: string, attachments?: string[]) {
    try {
      // Wrap in transaction to ensure message delete and file marking are atomic
      return await this.databaseService.$transaction(
        async (tx: Prisma.TransactionClient) => {
          // Delete the message first
          const deletedMessage = await tx.message.delete({
            where: { id },
          });

          // Mark all attachments for deletion after message is deleted
          if (
            attachments &&
            Array.isArray(attachments) &&
            attachments.length > 0
          ) {
            for (const fileId of attachments) {
              await this.fileService.markForDeletion(fileId, tx);
            }
            this.logger.debug(
              `Marked ${attachments.length} attachments for deletion`,
            );
          }

          return deletedMessage;
        },
      );
    } catch (error) {
      this.logger.error('Error deleting message', error);
      // probably 404
      throw error;
    }
  }

  async findAllForChannel(
    channelId: string,
    limit = 50,
    continuationToken?: string,
  ) {
    if (!channelId) {
      throw new NotFoundException('No channelId provided');
    }
    return this.findAllByField(
      'channelId',
      channelId,
      limit,
      continuationToken,
    );
  }

  async findAllForDirectMessageGroup(
    directMessageGroupId: string,
    limit = 50,
    continuationToken?: string,
  ) {
    if (!directMessageGroupId) {
      throw new NotFoundException('No directMessageGroupId provided');
    }
    return this.findAllByField(
      'directMessageGroupId',
      directMessageGroupId,
      limit,
      continuationToken,
    );
  }

  async addReaction(messageId: string, emoji: string, userId: string) {
    try {
      const message = await this.findOne(messageId);

      // Find existing reaction for this emoji
      const reactionIndex = message.reactions.findIndex(
        (r) => r.emoji === emoji,
      );

      if (reactionIndex >= 0) {
        // Add user to existing reaction if not already present
        const reaction = message.reactions[reactionIndex];
        if (!reaction.userIds.includes(userId)) {
          reaction.userIds.push(userId);
        }
      } else {
        // Create new reaction
        message.reactions.push({
          emoji,
          userIds: [userId],
        });
      }

      return await this.update(messageId, { reactions: message.reactions });
    } catch (error) {
      this.logger.error('Error adding reaction', error);
      throw error;
    }
  }

  async removeReaction(messageId: string, emoji: string, userId: string) {
    try {
      const message = await this.findOne(messageId);

      const reactionIndex = message.reactions.findIndex(
        (r) => r.emoji === emoji,
      );
      if (reactionIndex >= 0) {
        const reaction = message.reactions[reactionIndex];
        reaction.userIds = reaction.userIds.filter((id) => id !== userId);

        // Remove reaction entirely if no users left
        if (reaction.userIds.length === 0) {
          message.reactions.splice(reactionIndex, 1);
        }
      }

      return await this.update(messageId, { reactions: message.reactions });
    } catch (error) {
      this.logger.error('Error removing reaction', error);
      throw error;
    }
  }

  async addAttachment(messageId: string, fileId?: string) {
    try {
      // If fileId is provided, add it to attachments array
      // Always decrement pendingAttachments (handles both success and failure)
      const updatedMessage = await this.databaseService.message.update({
        where: { id: messageId },
        data: {
          ...(fileId && {
            attachments: {
              push: fileId,
            },
          }),
          pendingAttachments: {
            decrement: 1,
          },
        },
      });

      return updatedMessage;
    } catch (error) {
      this.logger.error('Error updating message attachments', error);
      throw error;
    }
  }

  async enrichMessageWithFileMetadata(message: Message) {
    if (!message.attachments || message.attachments.length === 0) {
      return { ...message, attachments: [] };
    }

    // Fetch all file metadata for this message
    const files = await this.databaseService.file.findMany({
      where: { id: { in: message.attachments } },
      select: {
        id: true,
        filename: true,
        mimeType: true,
        fileType: true,
        size: true,
      },
    });

    // Create a map for quick lookup
    const fileMap = new Map(files.map((file) => [file.id, file]));

    // Transform attachments to include file metadata
    return {
      ...message,
      attachments: message.attachments
        .map((fileId) => fileMap.get(fileId))
        .filter((file): file is NonNullable<typeof file> => file !== undefined),
    };
  }

  private async findAllByField(
    field: 'channelId' | 'directMessageGroupId',
    value: string,
    limit = 50,
    continuationToken?: string,
  ) {
    const where = { [field]: value };
    const query = {
      where,
      orderBy: { sentAt: 'desc' as const },
      take: limit,
      ...(continuationToken
        ? { cursor: { id: continuationToken }, skip: 1 }
        : {}),
    };
    const messages = await this.databaseService.message.findMany(query);

    // Collect all unique file IDs from all messages
    const allFileIds = new Set<string>();
    messages.forEach((message) => {
      message.attachments.forEach((fileId) => allFileIds.add(fileId));
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
            },
          })
        : [];

    // Create a map for quick lookup
    const fileMap = new Map(files.map((file) => [file.id, file]));

    // Transform messages to include file metadata
    const messagesWithMetadata = messages.map((message) => ({
      ...message,
      attachments: message.attachments
        .map((fileId) => fileMap.get(fileId))
        .filter((file): file is NonNullable<typeof file> => file !== undefined), // Filter out any missing files
    }));

    const nextToken =
      messages.length === limit ? messages[messages.length - 1].id : undefined;
    return { messages: messagesWithMetadata, continuationToken: nextToken };
  }

  /**
   * Search messages in a specific channel
   */
  async searchChannelMessages(channelId: string, query: string, limit = 50) {
    if (!query || query.trim().length === 0) {
      return [];
    }

    // Convert query to lowercase since searchText is stored lowercase
    const lowerQuery = query.toLowerCase();

    this.logger.log(
      `Searching messages in channel ${channelId} for query: "${lowerQuery}"`,
    );

    // Use aggregateRaw for direct MongoDB regex query (Prisma contains doesn't work on MongoDB)
    // We use aggregateRaw instead of findRaw because it handles ObjectId conversion better
    const messages = await this.databaseService.message.aggregateRaw({
      pipeline: [
        {
          $match: {
            channelId: { $oid: channelId },
            $or: [{ deletedAt: null }, { deletedAt: { $exists: false } }],
            searchText: { $regex: lowerQuery, $options: 'i' },
          },
        },
        { $sort: { sentAt: -1 } },
        { $limit: limit },
      ],
    });

    const messagesArray = messages as unknown as RawMongoMessage[];
    this.logger.log(
      `Found ${messagesArray.length} messages matching query "${lowerQuery}"`,
    );

    // Convert raw MongoDB documents to Prisma format
    const formattedMessages = this.convertRawMongoMessages(messagesArray);

    return this.enrichMessagesWithFileMetadata(formattedMessages);
  }

  /**
   * Search messages in a specific direct message group
   */
  async searchDirectMessages(
    directMessageGroupId: string,
    query: string,
    limit = 50,
  ) {
    if (!query || query.trim().length === 0) {
      return [];
    }

    // Convert query to lowercase since searchText is stored lowercase
    const lowerQuery = query.toLowerCase();

    // Use aggregateRaw for MongoDB regex search
    const messages = await this.databaseService.message.aggregateRaw({
      pipeline: [
        {
          $match: {
            directMessageGroupId: { $oid: directMessageGroupId },
            $or: [{ deletedAt: null }, { deletedAt: { $exists: false } }],
            searchText: { $regex: lowerQuery, $options: 'i' },
          },
        },
        { $sort: { sentAt: -1 } },
        { $limit: limit },
      ],
    });

    // Convert raw MongoDB documents to Prisma format
    const messagesArray = messages as unknown as RawMongoMessage[];
    const formattedMessages = this.convertRawMongoMessages(messagesArray);

    return this.enrichMessagesWithFileMetadata(formattedMessages);
  }

  /**
   * Search messages across all accessible channels in a community
   */
  async searchCommunityMessages(
    communityId: string,
    userId: string,
    query: string,
    limit = 50,
  ) {
    if (!query || query.trim().length === 0) {
      return [];
    }

    // Convert query to lowercase since searchText is stored lowercase
    const lowerQuery = query.toLowerCase();

    // Get all channels the user has access to in this community
    const accessibleChannels = await this.databaseService.channel.findMany({
      where: {
        communityId,
        OR: [
          { isPrivate: false }, // Public channels
          {
            isPrivate: true,
            ChannelMembership: { some: { userId } }, // Private channels user is a member of
          },
        ],
      },
      select: { id: true, name: true },
    });

    const channelIds = accessibleChannels.map((c) => c.id);
    const channelMap = new Map(accessibleChannels.map((c) => [c.id, c.name]));

    if (channelIds.length === 0) {
      return [];
    }

    // Use aggregateRaw for MongoDB regex search across multiple channels
    const messages = await this.databaseService.message.aggregateRaw({
      pipeline: [
        {
          $match: {
            channelId: { $in: channelIds.map((id) => ({ $oid: id })) },
            $or: [{ deletedAt: null }, { deletedAt: { $exists: false } }],
            searchText: { $regex: lowerQuery, $options: 'i' },
          },
        },
        { $sort: { sentAt: -1 } },
        { $limit: limit },
      ],
    });

    // Convert raw MongoDB documents to Prisma format
    const messagesArray = messages as unknown as RawMongoMessage[];
    const formattedMessages = this.convertRawMongoMessages(messagesArray);

    const enrichedMessages =
      await this.enrichMessagesWithFileMetadata(formattedMessages);

    // Add channel name to each message
    return enrichedMessages.map((msg) => ({
      ...msg,
      channelName: channelMap.get(msg.channelId ?? '') ?? 'Unknown',
    }));
  }

  /**
   * Converts raw MongoDB documents from aggregateRaw to Prisma Message format.
   * Handles the extended JSON format used by MongoDB for ObjectIds and dates.
   */
  private convertRawMongoMessages(rawMessages: RawMongoMessage[]): Message[] {
    return rawMessages.map((msg) => ({
      id: msg._id.$oid,
      channelId: msg.channelId?.$oid ?? null,
      directMessageGroupId: msg.directMessageGroupId?.$oid ?? null,
      authorId: msg.authorId.$oid,
      sentAt: new Date(msg.sentAt.$date),
      editedAt: msg.editedAt ? new Date(msg.editedAt.$date) : null,
      deletedAt: msg.deletedAt ? new Date(msg.deletedAt.$date) : null,
      pinnedAt: msg.pinnedAt ? new Date(msg.pinnedAt.$date) : null,
      attachments: msg.attachments,
      spans: msg.spans as Message['spans'],
      searchText: msg.searchText ?? null,
      reactions: msg.reactions as Message['reactions'],
      replyToId: msg.replyToId?.$oid ?? null,
      pendingAttachments: msg.pendingAttachments ?? null,
      pinned: msg.pinned ?? false,
      pinnedBy: msg.pinnedBy?.$oid ?? null,
      deletedBy: msg.deletedBy?.$oid ?? null,
      deletedByReason: msg.deletedByReason ?? null,
    }));
  }

  /**
   * Helper to enrich multiple messages with file metadata
   */
  private async enrichMessagesWithFileMetadata(messages: Message[]) {
    if (messages.length === 0) {
      return [];
    }

    // Collect all unique file IDs from all messages
    const allFileIds = new Set<string>();
    messages.forEach((message) => {
      message.attachments.forEach((fileId) => allFileIds.add(fileId));
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
            },
          })
        : [];

    // Create a map for quick lookup
    const fileMap = new Map(files.map((file) => [file.id, file]));

    // Transform messages to include file metadata
    return messages.map((message) => ({
      ...message,
      attachments: message.attachments
        .map((fileId) => fileMap.get(fileId))
        .filter((file): file is NonNullable<typeof file> => file !== undefined),
    }));
  }
}
