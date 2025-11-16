import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException } from '@nestjs/common';
import { ReplayClipAccessStrategy } from './replay-clip.strategy';
import { DatabaseService } from '@/database/database.service';
import { MembershipService } from '@/membership/membership.service';
import { ChannelMembershipService } from '@/channel-membership/channel-membership.service';

describe('ReplayClipAccessStrategy', () => {
  let strategy: ReplayClipAccessStrategy;

  const mockDatabaseService = {
    replayClip: {
      findFirst: jest.fn(),
    },
    message: {
      findMany: jest.fn(),
    },
    channel: {
      findUnique: jest.fn(),
    },
    directMessageGroupMember: {
      findUnique: jest.fn(),
    },
  };

  const mockMembershipService = {
    isMember: jest.fn(),
  };

  const mockChannelMembershipService = {
    isMember: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReplayClipAccessStrategy,
        {
          provide: DatabaseService,
          useValue: mockDatabaseService,
        },
        {
          provide: MembershipService,
          useValue: mockMembershipService,
        },
        {
          provide: ChannelMembershipService,
          useValue: mockChannelMembershipService,
        },
      ],
    }).compile();

    strategy = module.get<ReplayClipAccessStrategy>(ReplayClipAccessStrategy);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(strategy).toBeDefined();
  });

  describe('checkAccess', () => {
    describe('owner access', () => {
      it('should grant access when user is the clip owner', async () => {
        const userId = 'user-123';
        const clipOwnerId = 'user-123';
        const fileId = 'file-456';

        const result = await strategy.checkAccess(userId, clipOwnerId, fileId);

        expect(result).toBe(true);
        // Should not need to check database when user is owner
        expect(mockDatabaseService.replayClip.findFirst).not.toHaveBeenCalled();
        expect(mockDatabaseService.message.findMany).not.toHaveBeenCalled();
      });
    });

    describe('public clip access', () => {
      it('should grant access when clip is public', async () => {
        const userId = 'user-123';
        const clipOwnerId = 'user-456'; // Different owner
        const fileId = 'file-789';

        mockDatabaseService.replayClip.findFirst.mockResolvedValue({
          isPublic: true,
        });

        const result = await strategy.checkAccess(userId, clipOwnerId, fileId);

        expect(result).toBe(true);
        expect(mockDatabaseService.replayClip.findFirst).toHaveBeenCalledWith({
          where: { fileId },
          select: { isPublic: true },
        });
        // Should not check message access when clip is public
        expect(mockDatabaseService.message.findMany).not.toHaveBeenCalled();
      });

      it('should continue checking when clip is not public', async () => {
        const userId = 'user-123';
        const clipOwnerId = 'user-456';
        const fileId = 'file-789';

        mockDatabaseService.replayClip.findFirst.mockResolvedValue({
          isPublic: false,
        });
        mockDatabaseService.message.findMany.mockResolvedValue([]);

        await expect(
          strategy.checkAccess(userId, clipOwnerId, fileId),
        ).rejects.toThrow(ForbiddenException);

        expect(mockDatabaseService.message.findMany).toHaveBeenCalled();
      });

      it('should handle clip not found in database', async () => {
        const userId = 'user-123';
        const clipOwnerId = 'user-456';
        const fileId = 'file-789';

        mockDatabaseService.replayClip.findFirst.mockResolvedValue(null);
        mockDatabaseService.message.findMany.mockResolvedValue([]);

        await expect(
          strategy.checkAccess(userId, clipOwnerId, fileId),
        ).rejects.toThrow(ForbiddenException);
      });
    });

    describe('message-based access', () => {
      beforeEach(() => {
        mockDatabaseService.replayClip.findFirst.mockResolvedValue({
          isPublic: false,
        });
      });

      it('should deny access when file is not attached to any message', async () => {
        mockDatabaseService.message.findMany.mockResolvedValue([]);

        await expect(
          strategy.checkAccess('user-123', 'user-456', 'file-789'),
        ).rejects.toThrow(ForbiddenException);
        await expect(
          strategy.checkAccess('user-123', 'user-456', 'file-789'),
        ).rejects.toThrow('Access denied');
      });

      describe('channel message access', () => {
        it('should grant access for public channel when user is community member', async () => {
          const message = {
            id: 'message-1',
            channelId: 'channel-1',
            directMessageGroupId: null,
          };

          const channel = {
            id: 'channel-1',
            communityId: 'community-1',
            isPrivate: false,
          };

          mockDatabaseService.message.findMany.mockResolvedValue([message]);
          mockDatabaseService.channel.findUnique.mockResolvedValue(channel);
          mockMembershipService.isMember.mockResolvedValue(true);

          const result = await strategy.checkAccess(
            'user-123',
            'user-456',
            'file-789',
          );

          expect(result).toBe(true);
          expect(mockMembershipService.isMember).toHaveBeenCalledWith(
            'user-123',
            'community-1',
          );
        });

        it('should deny access for public channel when user is not community member', async () => {
          const message = {
            id: 'message-1',
            channelId: 'channel-1',
            directMessageGroupId: null,
          };

          const channel = {
            id: 'channel-1',
            communityId: 'community-1',
            isPrivate: false,
          };

          mockDatabaseService.message.findMany.mockResolvedValue([message]);
          mockDatabaseService.channel.findUnique.mockResolvedValue(channel);
          mockMembershipService.isMember.mockResolvedValue(false);

          await expect(
            strategy.checkAccess('user-123', 'user-456', 'file-789'),
          ).rejects.toThrow(ForbiddenException);
        });

        it('should grant access for private channel when user is channel member', async () => {
          const message = {
            id: 'message-1',
            channelId: 'channel-1',
            directMessageGroupId: null,
          };

          const channel = {
            id: 'channel-1',
            communityId: 'community-1',
            isPrivate: true,
          };

          mockDatabaseService.message.findMany.mockResolvedValue([message]);
          mockDatabaseService.channel.findUnique.mockResolvedValue(channel);
          mockChannelMembershipService.isMember.mockResolvedValue(true);

          const result = await strategy.checkAccess(
            'user-123',
            'user-456',
            'file-789',
          );

          expect(result).toBe(true);
          expect(mockChannelMembershipService.isMember).toHaveBeenCalledWith(
            'user-123',
            'channel-1',
          );
        });

        it('should deny access for private channel when user is not channel member', async () => {
          const message = {
            id: 'message-1',
            channelId: 'channel-1',
            directMessageGroupId: null,
          };

          const channel = {
            id: 'channel-1',
            communityId: 'community-1',
            isPrivate: true,
          };

          mockDatabaseService.message.findMany.mockResolvedValue([message]);
          mockDatabaseService.channel.findUnique.mockResolvedValue(channel);
          mockChannelMembershipService.isMember.mockResolvedValue(false);

          await expect(
            strategy.checkAccess('user-123', 'user-456', 'file-789'),
          ).rejects.toThrow(ForbiddenException);
        });

        it('should handle channel not found', async () => {
          const message = {
            id: 'message-1',
            channelId: 'channel-1',
            directMessageGroupId: null,
          };

          mockDatabaseService.message.findMany.mockResolvedValue([message]);
          mockDatabaseService.channel.findUnique.mockResolvedValue(null);

          await expect(
            strategy.checkAccess('user-123', 'user-456', 'file-789'),
          ).rejects.toThrow(ForbiddenException);
        });
      });

      describe('DM group message access', () => {
        it('should grant access when user is DM group member', async () => {
          const message = {
            id: 'message-1',
            channelId: null,
            directMessageGroupId: 'dm-group-1',
          };

          mockDatabaseService.message.findMany.mockResolvedValue([message]);
          mockDatabaseService.directMessageGroupMember.findUnique.mockResolvedValue(
            {
              groupId: 'dm-group-1',
              userId: 'user-123',
            },
          );

          const result = await strategy.checkAccess(
            'user-123',
            'user-456',
            'file-789',
          );

          expect(result).toBe(true);
          expect(
            mockDatabaseService.directMessageGroupMember.findUnique,
          ).toHaveBeenCalledWith({
            where: {
              groupId_userId: {
                groupId: 'dm-group-1',
                userId: 'user-123',
              },
            },
          });
        });

        it('should deny access when user is not DM group member', async () => {
          const message = {
            id: 'message-1',
            channelId: null,
            directMessageGroupId: 'dm-group-1',
          };

          mockDatabaseService.message.findMany.mockResolvedValue([message]);
          mockDatabaseService.directMessageGroupMember.findUnique.mockResolvedValue(
            null,
          );

          await expect(
            strategy.checkAccess('user-123', 'user-456', 'file-789'),
          ).rejects.toThrow(ForbiddenException);
        });
      });

      describe('multiple messages', () => {
        it('should grant access if user has access to any message containing the file', async () => {
          const messages = [
            {
              id: 'message-1',
              channelId: 'channel-1',
              directMessageGroupId: null,
            },
            {
              id: 'message-2',
              channelId: 'channel-2',
              directMessageGroupId: null,
            },
          ];

          const channel1 = {
            id: 'channel-1',
            communityId: 'community-1',
            isPrivate: false,
          };

          const channel2 = {
            id: 'channel-2',
            communityId: 'community-2',
            isPrivate: false,
          };

          mockDatabaseService.message.findMany.mockResolvedValue(messages);
          mockDatabaseService.channel.findUnique
            .mockResolvedValueOnce(channel1)
            .mockResolvedValueOnce(channel2);
          mockMembershipService.isMember
            .mockResolvedValueOnce(false) // Not member of first community
            .mockResolvedValueOnce(true); // Member of second community

          const result = await strategy.checkAccess(
            'user-123',
            'user-456',
            'file-789',
          );

          expect(result).toBe(true);
        });

        it('should deny access if user has no access to any message', async () => {
          const messages = [
            {
              id: 'message-1',
              channelId: 'channel-1',
              directMessageGroupId: null,
            },
            {
              id: 'message-2',
              channelId: null,
              directMessageGroupId: 'dm-group-1',
            },
          ];

          const channel1 = {
            id: 'channel-1',
            communityId: 'community-1',
            isPrivate: false,
          };

          mockDatabaseService.message.findMany.mockResolvedValue(messages);
          mockDatabaseService.channel.findUnique.mockResolvedValue(channel1);
          mockMembershipService.isMember.mockResolvedValue(false);
          mockDatabaseService.directMessageGroupMember.findUnique.mockResolvedValue(
            null,
          );

          await expect(
            strategy.checkAccess('user-123', 'user-456', 'file-789'),
          ).rejects.toThrow(ForbiddenException);
        });

        it('should continue checking when membership check throws error', async () => {
          const messages = [
            {
              id: 'message-1',
              channelId: 'channel-1',
              directMessageGroupId: null,
            },
            {
              id: 'message-2',
              channelId: null,
              directMessageGroupId: 'dm-group-1',
            },
          ];

          const channel1 = {
            id: 'channel-1',
            communityId: 'community-1',
            isPrivate: false,
          };

          mockDatabaseService.message.findMany.mockResolvedValue(messages);
          mockDatabaseService.channel.findUnique.mockResolvedValue(channel1);
          // First check throws error
          mockMembershipService.isMember.mockRejectedValueOnce(
            new Error('Database error'),
          );
          // Second check succeeds
          mockDatabaseService.directMessageGroupMember.findUnique.mockResolvedValue(
            { groupId: 'dm-group-1', userId: 'user-123' },
          );

          const result = await strategy.checkAccess(
            'user-123',
            'user-456',
            'file-789',
          );

          expect(result).toBe(true);
        });
      });
    });
  });
});
