import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '@/database/database.service';
import { Message, MessageReaction } from '@prisma/client';

type MessageWithReactions = Message & { reactions: MessageReaction[] };

/**
 * Service for managing message reactions
 *
 * Uses upsert/delete on the MessageReaction junction table.
 * The unique constraint (messageId, emoji, userId) ensures idempotency.
 */
@Injectable()
export class ReactionsService {
  private readonly logger = new Logger(ReactionsService.name);

  constructor(private readonly databaseService: DatabaseService) {}

  /**
   * Add a reaction to a message.
   *
   * Uses upsert with the compound unique key to be idempotent —
   * if the user already reacted with this emoji, it's a no-op.
   *
   * @param messageId - ID of the message to react to
   * @param emoji - Emoji character/string
   * @param userId - ID of the user adding the reaction
   * @returns Updated message with reactions
   */
  async addReaction(
    messageId: string,
    emoji: string,
    userId: string,
  ): Promise<MessageWithReactions> {
    try {
      await this.findMessageOrThrow(messageId);

      await this.databaseService.messageReaction.upsert({
        where: {
          messageId_emoji_userId: { messageId, emoji, userId },
        },
        create: { messageId, emoji, userId },
        update: {},
      });

      return await this.findMessageWithReactionsOrThrow(messageId);
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      this.logger.error(`Error adding reaction to message ${messageId}`, error);
      throw error;
    }
  }

  /**
   * Remove a reaction from a message.
   *
   * Deletes the reaction row if it exists; no-op if it doesn't.
   *
   * @param messageId - ID of the message
   * @param emoji - Emoji character/string to remove
   * @param userId - ID of the user removing their reaction
   * @returns Updated message with reactions
   */
  async removeReaction(
    messageId: string,
    emoji: string,
    userId: string,
  ): Promise<MessageWithReactions> {
    try {
      await this.findMessageOrThrow(messageId);

      await this.databaseService.messageReaction.deleteMany({
        where: { messageId, emoji, userId },
      });

      return await this.findMessageWithReactionsOrThrow(messageId);
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      this.logger.error(
        `Error removing reaction from message ${messageId}`,
        error,
      );
      throw error;
    }
  }

  /**
   * Find a message by ID or throw NotFoundException
   */
  private async findMessageOrThrow(messageId: string): Promise<Message> {
    const message = await this.databaseService.message.findUnique({
      where: { id: messageId },
    });

    if (!message) {
      throw new NotFoundException(`Message ${messageId} not found`);
    }

    return message;
  }

  /**
   * Find a message with reactions or throw NotFoundException
   */
  private async findMessageWithReactionsOrThrow(
    messageId: string,
  ): Promise<MessageWithReactions> {
    const message = await this.databaseService.message.findUnique({
      where: { id: messageId },
      include: { reactions: true },
    });

    if (!message) {
      throw new NotFoundException(`Message ${messageId} not found`);
    }

    return message;
  }
}
