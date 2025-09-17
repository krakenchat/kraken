import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { CreateMessageDto } from './dto/create-message.dto';
import { UpdateMessageDto } from './dto/update-message.dto';
import { DatabaseService } from '@/database/database.service';

@Injectable()
export class MessagesService {
  private readonly logger = new Logger(MessagesService.name);

  constructor(private readonly databaseService: DatabaseService) {}

  async create(createMessageDto: CreateMessageDto) {
    const { fileIds, attachments, ...messageData } = createMessageDto as any;

    const message = await this.databaseService.message.create({
      data: {
        ...messageData,
      },
    });

    // Create attachments if fileIds provided
    if (fileIds && fileIds.length > 0) {
      const attachmentData = fileIds.map((fileId, index) => ({
        fileId,
        messageId: message.id,
        order: index,
      }));

      await this.databaseService.attachment.createMany({
        data: attachmentData,
      });
    }

    return message;
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
      const { fileIds, attachments, ...messageData } = updateMessageDto as any;

      const message = await this.databaseService.message.update({
        where: { id },
        data: messageData,
      });

      // Update attachments if fileIds provided
      if (fileIds !== undefined) {
        // Delete existing attachments
        await this.databaseService.attachment.deleteMany({
          where: { messageId: id },
        });

        // Create new attachments
        if (fileIds.length > 0) {
          const attachmentData = fileIds.map((fileId, index) => ({
            fileId,
            messageId: id,
            order: index,
          }));

          await this.databaseService.attachment.createMany({
            data: attachmentData,
          });
        }
      }

      return message;
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
    const nextToken =
      messages.length === limit ? messages[messages.length - 1].id : undefined;
    return { messages, continuationToken: nextToken };
  }
}
