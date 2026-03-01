import { TestBed } from '@suites/unit';
import { ReactionsService } from './reactions.service';
import { DatabaseService } from '@/database/database.service';
import { NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';

describe('ReactionsService', () => {
  let service: ReactionsService;

  const messageId = randomUUID();
  const userId1 = randomUUID();
  const userId2 = randomUUID();

  const mockDatabaseService = {
    message: {
      findUnique: jest.fn(),
    },
    messageReaction: {
      upsert: jest.fn(),
      deleteMany: jest.fn(),
    },
  };

  beforeEach(async () => {
    const { unit } = await TestBed.solitary(ReactionsService)
      .mock(DatabaseService)
      .final(mockDatabaseService)
      .compile();

    service = unit;

    jest.clearAllMocks();
  });

  describe('addReaction', () => {
    it('should add a new reaction to a message', async () => {
      const message = {
        id: messageId,
        channelId: 'channel-1',
        directMessageGroupId: null,
      };

      const messageWithReactions = {
        ...message,
        reactions: [
          {
            emoji: '👍',
            userId: userId1,
            messageId,
            id: randomUUID(),
            createdAt: new Date(),
          },
        ],
      };

      // First call: existence check, second call: return with reactions
      mockDatabaseService.message.findUnique
        .mockResolvedValueOnce(message)
        .mockResolvedValueOnce(messageWithReactions);

      mockDatabaseService.messageReaction.upsert.mockResolvedValueOnce({
        id: randomUUID(),
        messageId,
        emoji: '👍',
        userId: userId1,
      });

      const result = await service.addReaction(messageId, '👍', userId1);

      expect(result.reactions).toHaveLength(1);
      expect(result.reactions[0].emoji).toBe('👍');

      // Verify existence check
      expect(mockDatabaseService.message.findUnique).toHaveBeenCalledTimes(2);
      expect(mockDatabaseService.message.findUnique).toHaveBeenNthCalledWith(
        1,
        {
          where: { id: messageId },
        },
      );

      // Verify upsert was called with compound unique key
      expect(mockDatabaseService.messageReaction.upsert).toHaveBeenCalledWith({
        where: {
          messageId_emoji_userId: { messageId, emoji: '👍', userId: userId1 },
        },
        create: { messageId, emoji: '👍', userId: userId1 },
        update: {},
      });
    });

    it('should be idempotent when user already reacted', async () => {
      const message = {
        id: messageId,
        channelId: 'channel-1',
        directMessageGroupId: null,
      };

      const messageWithReactions = {
        ...message,
        reactions: [
          {
            emoji: '👍',
            userId: userId1,
            messageId,
            id: randomUUID(),
            createdAt: new Date(),
          },
        ],
      };

      mockDatabaseService.message.findUnique
        .mockResolvedValueOnce(message)
        .mockResolvedValueOnce(messageWithReactions);

      // Upsert is a no-op when record already exists (update: {})
      mockDatabaseService.messageReaction.upsert.mockResolvedValueOnce({
        id: randomUUID(),
        messageId,
        emoji: '👍',
        userId: userId1,
      });

      const result = await service.addReaction(messageId, '👍', userId1);

      expect(result.reactions).toHaveLength(1);
      expect(mockDatabaseService.messageReaction.upsert).toHaveBeenCalledTimes(
        1,
      );
    });

    it('should add a second user to an existing emoji reaction', async () => {
      const message = {
        id: messageId,
        channelId: 'channel-1',
        directMessageGroupId: null,
      };

      const messageWithReactions = {
        ...message,
        reactions: [
          {
            emoji: '👍',
            userId: userId1,
            messageId,
            id: randomUUID(),
            createdAt: new Date(),
          },
          {
            emoji: '👍',
            userId: userId2,
            messageId,
            id: randomUUID(),
            createdAt: new Date(),
          },
        ],
      };

      mockDatabaseService.message.findUnique
        .mockResolvedValueOnce(message)
        .mockResolvedValueOnce(messageWithReactions);

      mockDatabaseService.messageReaction.upsert.mockResolvedValueOnce({
        id: randomUUID(),
        messageId,
        emoji: '👍',
        userId: userId2,
      });

      const result = await service.addReaction(messageId, '👍', userId2);

      // Result should have 2 reaction rows
      expect(result.reactions).toHaveLength(2);
    });

    it('should throw NotFoundException when message not found', async () => {
      mockDatabaseService.message.findUnique.mockResolvedValue(null);

      await expect(
        service.addReaction(randomUUID(), '👍', userId1),
      ).rejects.toThrow(NotFoundException);

      expect(mockDatabaseService.messageReaction.upsert).not.toHaveBeenCalled();
    });
  });

  describe('removeReaction', () => {
    it('should remove user reaction from message', async () => {
      const message = {
        id: messageId,
        channelId: 'channel-1',
        directMessageGroupId: null,
      };

      const messageWithReactions = {
        ...message,
        reactions: [
          {
            emoji: '👍',
            userId: userId2,
            messageId,
            id: randomUUID(),
            createdAt: new Date(),
          },
        ],
      };

      mockDatabaseService.message.findUnique
        .mockResolvedValueOnce(message)
        .mockResolvedValueOnce(messageWithReactions);

      mockDatabaseService.messageReaction.deleteMany.mockResolvedValueOnce({
        count: 1,
      });

      const result = await service.removeReaction(messageId, '👍', userId1);

      expect(result.reactions).toHaveLength(1);
      expect(result.reactions[0].userId).toBe(userId2);

      expect(
        mockDatabaseService.messageReaction.deleteMany,
      ).toHaveBeenCalledWith({
        where: { messageId, emoji: '👍', userId: userId1 },
      });
    });

    it('should return empty reactions when last user removes reaction', async () => {
      const message = {
        id: messageId,
        channelId: 'channel-1',
        directMessageGroupId: null,
      };

      const messageWithReactions = {
        ...message,
        reactions: [],
      };

      mockDatabaseService.message.findUnique
        .mockResolvedValueOnce(message)
        .mockResolvedValueOnce(messageWithReactions);

      mockDatabaseService.messageReaction.deleteMany.mockResolvedValueOnce({
        count: 1,
      });

      const result = await service.removeReaction(messageId, '👍', userId1);

      expect(result.reactions).toHaveLength(0);
    });

    it('should handle removing non-existent reaction gracefully', async () => {
      const message = {
        id: messageId,
        channelId: 'channel-1',
        directMessageGroupId: null,
      };

      mockDatabaseService.message.findUnique
        .mockResolvedValueOnce(message)
        .mockResolvedValueOnce({ ...message, reactions: [] });

      // deleteMany returns count: 0 when nothing matched
      mockDatabaseService.messageReaction.deleteMany.mockResolvedValueOnce({
        count: 0,
      });

      const result = await service.removeReaction(messageId, '👍', userId1);

      expect(result.reactions).toHaveLength(0);
    });

    it('should throw NotFoundException when message not found', async () => {
      mockDatabaseService.message.findUnique.mockResolvedValue(null);

      await expect(
        service.removeReaction(randomUUID(), '👍', userId1),
      ).rejects.toThrow(NotFoundException);

      expect(
        mockDatabaseService.messageReaction.deleteMany,
      ).not.toHaveBeenCalled();
    });
  });
});
