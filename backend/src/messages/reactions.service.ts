import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '@/database/database.service';
import { Message } from '@prisma/client';

/**
 * Reaction type as stored in message.reactions JSON array
 */
interface Reaction {
  emoji: string;
  userIds: string[];
}

/**
 * Service for managing message reactions
 *
 * Extracted from MessagesService for better separation of concerns.
 * Handles adding/removing reactions independently of message CRUD.
 */
@Injectable()
export class ReactionsService {
  private readonly logger = new Logger(ReactionsService.name);

  constructor(private readonly databaseService: DatabaseService) {}

  /**
   * Add a reaction to a message
   *
   * If the emoji already exists, adds the user to the existing reaction.
   * If it's a new emoji, creates a new reaction entry.
   *
   * @param messageId - ID of the message to react to
   * @param emoji - Emoji character/string
   * @param userId - ID of the user adding the reaction
   * @returns Updated message with new reaction state
   */
  async addReaction(
    messageId: string,
    emoji: string,
    userId: string,
  ): Promise<Message> {
    try {
      const message = await this.findMessageOrThrow(messageId);
      const reactions = (message.reactions as Reaction[]) || [];

      // Find existing reaction for this emoji
      const reactionIndex = reactions.findIndex((r) => r.emoji === emoji);

      if (reactionIndex >= 0) {
        // Add user to existing reaction if not already present
        const reaction = reactions[reactionIndex];
        if (!reaction.userIds.includes(userId)) {
          reaction.userIds.push(userId);
        }
      } else {
        // Create new reaction
        reactions.push({
          emoji,
          userIds: [userId],
        });
      }

      return await this.databaseService.message.update({
        where: { id: messageId },
        data: { reactions },
      });
    } catch (error) {
      this.logger.error(`Error adding reaction to message ${messageId}`, error);
      throw error;
    }
  }

  /**
   * Remove a reaction from a message
   *
   * Removes the user from the reaction's userIds array.
   * If no users remain, removes the reaction entirely.
   *
   * @param messageId - ID of the message
   * @param emoji - Emoji character/string to remove
   * @param userId - ID of the user removing their reaction
   * @returns Updated message with new reaction state
   */
  async removeReaction(
    messageId: string,
    emoji: string,
    userId: string,
  ): Promise<Message> {
    try {
      const message = await this.findMessageOrThrow(messageId);
      const reactions = (message.reactions as Reaction[]) || [];

      const reactionIndex = reactions.findIndex((r) => r.emoji === emoji);
      if (reactionIndex >= 0) {
        const reaction = reactions[reactionIndex];
        reaction.userIds = reaction.userIds.filter((id) => id !== userId);

        // Remove reaction entirely if no users left
        if (reaction.userIds.length === 0) {
          reactions.splice(reactionIndex, 1);
        }
      }

      return await this.databaseService.message.update({
        where: { id: messageId },
        data: { reactions },
      });
    } catch (error) {
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
}
