import { Test, TestingModule } from '@nestjs/testing';
import { ReactionsService } from './reactions.service';
import { DatabaseService } from '@/database/database.service';
import { NotFoundException } from '@nestjs/common';
import { ObjectId } from 'bson';

describe('ReactionsService', () => {
  let service: ReactionsService;

  // Use valid ObjectId hex strings so `new ObjectId(messageId)` succeeds
  const messageId = new ObjectId().toHexString();
  const userId1 = 'user-1';
  const userId2 = 'user-2';

  const mockDatabaseService = {
    message: {
      findUnique: jest.fn(),
    },
    $runCommandRaw: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReactionsService,
        { provide: DatabaseService, useValue: mockDatabaseService },
      ],
    }).compile();

    service = module.get<ReactionsService>(ReactionsService);

    jest.clearAllMocks();
  });

  describe('addReaction', () => {
    it('should add a new reaction to a message when emoji does not exist yet', async () => {
      const message = {
        id: messageId,
        channelId: 'channel-1',
        directMessageGroupId: null,
        reactions: [],
      };

      const updatedMessage = {
        ...message,
        reactions: [{ emoji: '👍', userIds: [userId1] }],
      };

      // First findUnique call: existence check
      // Second findUnique call: return updated message
      mockDatabaseService.message.findUnique
        .mockResolvedValueOnce(message)
        .mockResolvedValueOnce(updatedMessage);

      // Step 1: updateExisting returns nModified: 0 (emoji doesn't exist yet)
      mockDatabaseService.$runCommandRaw
        .mockResolvedValueOnce({ nModified: 0 })
        // Step 2: alreadyReacted check returns empty (user hasn't reacted)
        .mockResolvedValueOnce({ cursor: { firstBatch: [] } })
        // Step 3: push new reaction entry
        .mockResolvedValueOnce({ nModified: 1 });

      const result = await service.addReaction(messageId, '👍', userId1);

      expect(result.reactions).toHaveLength(1);
      expect(result.reactions[0].emoji).toBe('👍');
      expect(result.reactions[0].userIds).toContain(userId1);

      // Verify findUnique was called twice (existence check + return updated)
      expect(mockDatabaseService.message.findUnique).toHaveBeenCalledTimes(2);
      expect(mockDatabaseService.message.findUnique).toHaveBeenCalledWith({
        where: { id: messageId },
      });

      // Verify $runCommandRaw was called 3 times:
      // 1. Try to add to existing reaction
      // 2. Check if user already reacted
      // 3. Push new reaction entry
      expect(mockDatabaseService.$runCommandRaw).toHaveBeenCalledTimes(3);

      // Verify step 1: try to update existing
      expect(mockDatabaseService.$runCommandRaw).toHaveBeenNthCalledWith(1, {
        update: 'Message',
        updates: [
          {
            q: {
              _id: { $oid: messageId },
              'reactions.emoji': '👍',
              'reactions.userIds': { $ne: userId1 },
            },
            u: {
              $push: { 'reactions.$.userIds': userId1 },
            },
          },
        ],
      });

      // Verify step 3: push new reaction
      expect(mockDatabaseService.$runCommandRaw).toHaveBeenNthCalledWith(3, {
        update: 'Message',
        updates: [
          {
            q: {
              _id: { $oid: messageId },
              'reactions.emoji': { $ne: '👍' },
            },
            u: {
              $push: {
                reactions: { emoji: '👍', userIds: [userId1] },
              },
            },
          },
        ],
      });
    });

    it('should add user to existing reaction', async () => {
      const message = {
        id: messageId,
        channelId: 'channel-1',
        directMessageGroupId: null,
        reactions: [{ emoji: '👍', userIds: [userId1] }],
      };

      const updatedMessage = {
        ...message,
        reactions: [{ emoji: '👍', userIds: [userId1, userId2] }],
      };

      mockDatabaseService.message.findUnique
        .mockResolvedValueOnce(message)
        .mockResolvedValueOnce(updatedMessage);

      // Step 1: updateExisting succeeds (emoji exists, user not yet in array)
      mockDatabaseService.$runCommandRaw.mockResolvedValueOnce({
        nModified: 1,
      });

      const result = await service.addReaction(messageId, '👍', userId2);

      expect(result.reactions[0].userIds).toContain(userId2);

      // Only 1 $runCommandRaw call because step 1 succeeded
      expect(mockDatabaseService.$runCommandRaw).toHaveBeenCalledTimes(1);
      expect(mockDatabaseService.$runCommandRaw).toHaveBeenCalledWith({
        update: 'Message',
        updates: [
          {
            q: {
              _id: { $oid: messageId },
              'reactions.emoji': '👍',
              'reactions.userIds': { $ne: userId2 },
            },
            u: {
              $push: { 'reactions.$.userIds': userId2 },
            },
          },
        ],
      });
    });

    it('should not add duplicate user to reaction', async () => {
      const message = {
        id: messageId,
        channelId: 'channel-1',
        directMessageGroupId: null,
        reactions: [{ emoji: '👍', userIds: [userId1] }],
      };

      mockDatabaseService.message.findUnique
        .mockResolvedValueOnce(message)
        .mockResolvedValueOnce(message);

      // Step 1: nModified 0 because user is already in the array ($ne fails)
      mockDatabaseService.$runCommandRaw
        .mockResolvedValueOnce({ nModified: 0 })
        // Step 2: alreadyReacted returns the message (user already reacted)
        .mockResolvedValueOnce({
          cursor: { firstBatch: [{ _id: messageId }] },
        });

      const result = await service.addReaction(messageId, '👍', userId1);

      // Should return original message (no change)
      expect(result.reactions).toHaveLength(1);
      expect(result.reactions[0].userIds).toEqual([userId1]);

      // Only 2 $runCommandRaw calls (step 1 + step 2 check, no step 3)
      expect(mockDatabaseService.$runCommandRaw).toHaveBeenCalledTimes(2);
    });

    it('should throw NotFoundException when message not found', async () => {
      mockDatabaseService.message.findUnique.mockResolvedValue(null);

      await expect(
        service.addReaction('aabbccddeeff00112233aabb', '👍', userId1),
      ).rejects.toThrow(NotFoundException);

      // $runCommandRaw should never be called
      expect(mockDatabaseService.$runCommandRaw).not.toHaveBeenCalled();
    });
  });

  describe('removeReaction', () => {
    it('should remove user from reaction', async () => {
      const message = {
        id: messageId,
        channelId: 'channel-1',
        directMessageGroupId: null,
        reactions: [{ emoji: '👍', userIds: [userId1, userId2] }],
      };

      const updatedMessage = {
        ...message,
        reactions: [{ emoji: '👍', userIds: [userId2] }],
      };

      mockDatabaseService.message.findUnique
        .mockResolvedValueOnce(message)
        .mockResolvedValueOnce(updatedMessage);

      // Step 1: pull userId from reaction
      // Step 2: cleanup empty reactions
      mockDatabaseService.$runCommandRaw
        .mockResolvedValueOnce({ nModified: 1 })
        .mockResolvedValueOnce({ nModified: 0 });

      const result = await service.removeReaction(messageId, '👍', userId1);

      expect(result.reactions[0].userIds).not.toContain(userId1);
      expect(result.reactions[0].userIds).toContain(userId2);

      // Verify $runCommandRaw was called twice (pull + cleanup)
      expect(mockDatabaseService.$runCommandRaw).toHaveBeenCalledTimes(2);

      // Verify step 1: pull user from reaction
      expect(mockDatabaseService.$runCommandRaw).toHaveBeenNthCalledWith(1, {
        update: 'Message',
        updates: [
          {
            q: {
              _id: { $oid: messageId },
              'reactions.emoji': '👍',
            },
            u: {
              $pull: { 'reactions.$.userIds': userId1 },
            },
          },
        ],
      });

      // Verify step 2: cleanup empty reactions
      expect(mockDatabaseService.$runCommandRaw).toHaveBeenNthCalledWith(2, {
        update: 'Message',
        updates: [
          {
            q: { _id: { $oid: messageId } },
            u: {
              $pull: { reactions: { userIds: { $size: 0 } } },
            },
          },
        ],
      });
    });

    it('should remove reaction entirely when last user removes it', async () => {
      const message = {
        id: messageId,
        channelId: 'channel-1',
        directMessageGroupId: null,
        reactions: [{ emoji: '👍', userIds: [userId1] }],
      };

      const updatedMessage = {
        ...message,
        reactions: [],
      };

      mockDatabaseService.message.findUnique
        .mockResolvedValueOnce(message)
        .mockResolvedValueOnce(updatedMessage);

      // Step 1: pull userId (last user)
      // Step 2: cleanup removes the empty reaction entry
      mockDatabaseService.$runCommandRaw
        .mockResolvedValueOnce({ nModified: 1 })
        .mockResolvedValueOnce({ nModified: 1 });

      const result = await service.removeReaction(messageId, '👍', userId1);

      expect(result.reactions).toHaveLength(0);

      // Verify both $runCommandRaw calls were made
      expect(mockDatabaseService.$runCommandRaw).toHaveBeenCalledTimes(2);
    });

    it('should handle removing non-existent reaction gracefully', async () => {
      const message = {
        id: messageId,
        channelId: 'channel-1',
        directMessageGroupId: null,
        reactions: [],
      };

      mockDatabaseService.message.findUnique
        .mockResolvedValueOnce(message)
        .mockResolvedValueOnce(message);

      // Both commands succeed but modify nothing
      mockDatabaseService.$runCommandRaw
        .mockResolvedValueOnce({ nModified: 0 })
        .mockResolvedValueOnce({ nModified: 0 });

      const result = await service.removeReaction(messageId, '👍', userId1);

      expect(result.reactions).toHaveLength(0);

      // Still called twice (pull + cleanup), even if nothing was modified
      expect(mockDatabaseService.$runCommandRaw).toHaveBeenCalledTimes(2);
    });

    it('should throw NotFoundException when message not found', async () => {
      mockDatabaseService.message.findUnique.mockResolvedValue(null);

      await expect(
        service.removeReaction('aabbccddeeff00112233aabb', '👍', userId1),
      ).rejects.toThrow(NotFoundException);

      // $runCommandRaw should never be called
      expect(mockDatabaseService.$runCommandRaw).not.toHaveBeenCalled();
    });
  });
});
