import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '@/database/database.service';
import { Message } from '@prisma/client';
import { ObjectId } from 'bson';

/**
 * Service for managing message reactions
 *
 * Extracted from MessagesService for better separation of concerns.
 * Uses atomic MongoDB operations ($push/$pull) to prevent race conditions
 * when multiple users react to the same message concurrently.
 */
@Injectable()
export class ReactionsService {
  private readonly logger = new Logger(ReactionsService.name);

  constructor(private readonly databaseService: DatabaseService) {}

  /**
   * Add a reaction to a message using atomic MongoDB operations.
   *
   * Uses a two-step atomic approach:
   * 1. Try to add userId to an existing reaction's userIds array
   * 2. If no existing reaction for this emoji, push a new reaction entry
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
      // First, verify the message exists
      await this.findMessageOrThrow(messageId);

      const oid = new ObjectId(messageId);

      // Step 1: Try to add userId to existing reaction for this emoji
      // This atomically adds the user only if the emoji exists and user isn't already in the array
      const updateExisting = (await this.databaseService.$runCommandRaw({
        update: 'Message',
        updates: [
          {
            q: {
              _id: { $oid: oid.toHexString() },
              'reactions.emoji': emoji,
              'reactions.userIds': { $ne: userId },
            },
            u: {
              $push: { 'reactions.$.userIds': userId },
            },
          },
        ],
      })) as { nModified?: number; n?: number };

      // If no document was modified, either the emoji doesn't exist yet or user already reacted
      if (!updateExisting.nModified) {
        // Step 2: Check if user already reacted with this emoji (idempotent)
        const alreadyReacted = (await this.databaseService.$runCommandRaw({
          find: 'Message',
          filter: {
            _id: { $oid: oid.toHexString() },
            reactions: {
              $elemMatch: { emoji, userIds: userId },
            },
          },
          limit: 1,
        })) as { cursor?: { firstBatch?: unknown[] } };

        const hasExisting =
          (alreadyReacted.cursor?.firstBatch?.length ?? 0) > 0;

        if (!hasExisting) {
          // Step 3: Emoji reaction doesn't exist yet - push a new reaction entry
          await this.databaseService.$runCommandRaw({
            update: 'Message',
            updates: [
              {
                q: {
                  _id: { $oid: oid.toHexString() },
                  'reactions.emoji': { $ne: emoji },
                },
                u: {
                  $push: {
                    reactions: { emoji, userIds: [userId] },
                  },
                },
              },
            ],
          });
        }
      }

      // Return the updated message
      return await this.findMessageOrThrow(messageId);
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      this.logger.error(`Error adding reaction to message ${messageId}`, error);
      throw error;
    }
  }

  /**
   * Remove a reaction from a message using atomic MongoDB operations.
   *
   * Atomically pulls the userId from the reaction's userIds array,
   * then cleans up empty reaction entries.
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
      await this.findMessageOrThrow(messageId);

      const oid = new ObjectId(messageId);

      // Step 1: Atomically remove the userId from the reaction's userIds array
      await this.databaseService.$runCommandRaw({
        update: 'Message',
        updates: [
          {
            q: {
              _id: { $oid: oid.toHexString() },
              'reactions.emoji': emoji,
            },
            u: {
              $pull: { 'reactions.$.userIds': userId },
            },
          },
        ],
      });

      // Step 2: Clean up any reaction entries with empty userIds arrays
      await this.databaseService.$runCommandRaw({
        update: 'Message',
        updates: [
          {
            q: { _id: { $oid: oid.toHexString() } },
            u: {
              $pull: { reactions: { userIds: { $size: 0 } } },
            },
          },
        ],
      });

      // Return the updated message
      return await this.findMessageOrThrow(messageId);
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
}
