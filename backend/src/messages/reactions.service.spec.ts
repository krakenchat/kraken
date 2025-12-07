import { Test, TestingModule } from '@nestjs/testing';
import { ReactionsService } from './reactions.service';
import { DatabaseService } from '@/database/database.service';
import { NotFoundException } from '@nestjs/common';

describe('ReactionsService', () => {
  let service: ReactionsService;

  const mockDatabaseService = {
    message: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
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
    it('should add a new reaction to a message', async () => {
      const message = {
        id: 'message-1',
        channelId: 'channel-1',
        directMessageGroupId: null,
        reactions: [],
      };

      const updatedMessage = {
        ...message,
        reactions: [{ emoji: '👍', userIds: ['user-1'] }],
      };

      mockDatabaseService.message.findUnique.mockResolvedValue(message);
      mockDatabaseService.message.update.mockResolvedValue(updatedMessage);

      const result = await service.addReaction('message-1', '👍', 'user-1');

      expect(result.reactions).toHaveLength(1);
      expect(result.reactions[0].emoji).toBe('👍');
      expect(result.reactions[0].userIds).toContain('user-1');
      expect(mockDatabaseService.message.update).toHaveBeenCalledWith({
        where: { id: 'message-1' },
        data: { reactions: [{ emoji: '👍', userIds: ['user-1'] }] },
      });
    });

    it('should add user to existing reaction', async () => {
      const message = {
        id: 'message-1',
        channelId: 'channel-1',
        directMessageGroupId: null,
        reactions: [{ emoji: '👍', userIds: ['user-1'] }],
      };

      const updatedMessage = {
        ...message,
        reactions: [{ emoji: '👍', userIds: ['user-1', 'user-2'] }],
      };

      mockDatabaseService.message.findUnique.mockResolvedValue(message);
      mockDatabaseService.message.update.mockResolvedValue(updatedMessage);

      const result = await service.addReaction('message-1', '👍', 'user-2');

      expect(result.reactions[0].userIds).toContain('user-2');
    });

    it('should not add duplicate user to reaction', async () => {
      const message = {
        id: 'message-1',
        channelId: 'channel-1',
        directMessageGroupId: null,
        reactions: [{ emoji: '👍', userIds: ['user-1'] }],
      };

      mockDatabaseService.message.findUnique.mockResolvedValue(message);
      mockDatabaseService.message.update.mockResolvedValue(message);

      await service.addReaction('message-1', '👍', 'user-1');

      expect(mockDatabaseService.message.update).toHaveBeenCalledWith({
        where: { id: 'message-1' },
        data: { reactions: [{ emoji: '👍', userIds: ['user-1'] }] },
      });
    });

    it('should throw NotFoundException when message not found', async () => {
      mockDatabaseService.message.findUnique.mockResolvedValue(null);

      await expect(
        service.addReaction('nonexistent', '👍', 'user-1'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('removeReaction', () => {
    it('should remove user from reaction', async () => {
      const message = {
        id: 'message-1',
        channelId: 'channel-1',
        directMessageGroupId: null,
        reactions: [{ emoji: '👍', userIds: ['user-1', 'user-2'] }],
      };

      const updatedMessage = {
        ...message,
        reactions: [{ emoji: '👍', userIds: ['user-2'] }],
      };

      mockDatabaseService.message.findUnique.mockResolvedValue(message);
      mockDatabaseService.message.update.mockResolvedValue(updatedMessage);

      const result = await service.removeReaction('message-1', '👍', 'user-1');

      expect(result.reactions[0].userIds).not.toContain('user-1');
      expect(result.reactions[0].userIds).toContain('user-2');
    });

    it('should remove reaction entirely when last user removes it', async () => {
      const message = {
        id: 'message-1',
        channelId: 'channel-1',
        directMessageGroupId: null,
        reactions: [{ emoji: '👍', userIds: ['user-1'] }],
      };

      const updatedMessage = {
        ...message,
        reactions: [],
      };

      mockDatabaseService.message.findUnique.mockResolvedValue(message);
      mockDatabaseService.message.update.mockResolvedValue(updatedMessage);

      const result = await service.removeReaction('message-1', '👍', 'user-1');

      expect(result.reactions).toHaveLength(0);
      expect(mockDatabaseService.message.update).toHaveBeenCalledWith({
        where: { id: 'message-1' },
        data: { reactions: [] },
      });
    });

    it('should handle removing non-existent reaction gracefully', async () => {
      const message = {
        id: 'message-1',
        channelId: 'channel-1',
        directMessageGroupId: null,
        reactions: [],
      };

      mockDatabaseService.message.findUnique.mockResolvedValue(message);
      mockDatabaseService.message.update.mockResolvedValue(message);

      await service.removeReaction('message-1', '👍', 'user-1');

      expect(mockDatabaseService.message.update).toHaveBeenCalledWith({
        where: { id: 'message-1' },
        data: { reactions: [] },
      });
    });

    it('should throw NotFoundException when message not found', async () => {
      mockDatabaseService.message.findUnique.mockResolvedValue(null);

      await expect(
        service.removeReaction('nonexistent', '👍', 'user-1'),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
