import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { CreateMessageDto } from './dto/create-message.dto';
import { UpdateMessageDto } from './dto/update-message.dto';
import { DatabaseService } from '@/database/database.service';

@Injectable()
export class MessagesService {
  private readonly logger = new Logger(MessagesService.name);

  constructor(private readonly databaseService: DatabaseService) {}

  async create(createMessageDto: CreateMessageDto) {
    return this.databaseService.message.create({
      data: createMessageDto,
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

  async update(id: string, updateMessageDto: UpdateMessageDto) {
    try {
      return await this.databaseService.message.update({
        where: { id },
        data: updateMessageDto,
      });
    } catch (error) {
      this.logger.error('Error updating message', error);
      throw error;
    }
  }

  async remove(id: string) {
    try {
      return await this.databaseService.message.delete({
        where: { id },
      });
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
}
