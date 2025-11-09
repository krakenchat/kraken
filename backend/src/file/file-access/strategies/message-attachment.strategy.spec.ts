import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { MessageAttachmentStrategy } from './message-attachment.strategy';
import { DatabaseService } from '@/database/database.service';
import { MembershipService } from '@/membership/membership.service';
import { ChannelMembershipService } from '@/channel-membership/channel-membership.service';

describe('MessageAttachmentStrategy', () => {
  let strategy: MessageAttachmentStrategy;

  const mockDatabaseService = {
    message: {
      findUnique: jest.fn(),
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
        MessageAttachmentStrategy,
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

    strategy = module.get<MessageAttachmentStrategy>(MessageAttachmentStrategy);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(strategy).toBeDefined();
  });

  describe('checkAccess', () => {
    it('should throw NotFoundException when message not found', async () => {
      mockDatabaseService.message.findUnique.mockResolvedValue(null);

      await expect(
        strategy.checkAccess('user-123', 'message-456', 'file-789'),
      ).rejects.toThrow(NotFoundException);

      await expect(
        strategy.checkAccess('user-123', 'message-456', 'file-789'),
      ).rejects.toThrow('Message not found');
    });

    it('should grant access for public channel message when user is community member', async () => {
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

      mockDatabaseService.message.findUnique.mockResolvedValue(message);
      mockDatabaseService.channel.findUnique.mockResolvedValue(channel);
      mockMembershipService.isMember.mockResolvedValue(true);

      const result = await strategy.checkAccess(
        'user-1',
        'message-1',
        'file-1',
      );

      expect(result).toBe(true);
      expect(mockMembershipService.isMember).toHaveBeenCalledWith(
        'user-1',
        'community-1',
      );
    });

    it('should throw ForbiddenException for public channel when user is not community member', async () => {
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

      mockDatabaseService.message.findUnique.mockResolvedValue(message);
      mockDatabaseService.channel.findUnique.mockResolvedValue(channel);
      mockMembershipService.isMember.mockResolvedValue(false);

      await expect(
        strategy.checkAccess('user-1', 'message-1', 'file-1'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should grant access for private channel message when user is channel member', async () => {
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

      mockDatabaseService.message.findUnique.mockResolvedValue(message);
      mockDatabaseService.channel.findUnique.mockResolvedValue(channel);
      mockChannelMembershipService.isMember.mockResolvedValue(true);

      const result = await strategy.checkAccess(
        'user-1',
        'message-1',
        'file-1',
      );

      expect(result).toBe(true);
      expect(mockChannelMembershipService.isMember).toHaveBeenCalledWith(
        'user-1',
        'channel-1',
      );
    });

    it('should throw ForbiddenException for private channel when user is not channel member', async () => {
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

      mockDatabaseService.message.findUnique.mockResolvedValue(message);
      mockDatabaseService.channel.findUnique.mockResolvedValue(channel);
      mockChannelMembershipService.isMember.mockResolvedValue(false);

      await expect(
        strategy.checkAccess('user-1', 'message-1', 'file-1'),
      ).rejects.toThrow(ForbiddenException);

      await expect(
        strategy.checkAccess('user-1', 'message-1', 'file-1'),
      ).rejects.toThrow(
        'You must be a member of this private channel to access this file',
      );
    });

    it('should grant access for DM group message when user is group member', async () => {
      const message = {
        id: 'message-1',
        channelId: null,
        directMessageGroupId: 'dm-group-1',
      };

      const dmMembership = {
        groupId: 'dm-group-1',
        userId: 'user-1',
      };

      mockDatabaseService.message.findUnique.mockResolvedValue(message);
      mockDatabaseService.directMessageGroupMember.findUnique.mockResolvedValue(
        dmMembership,
      );

      const result = await strategy.checkAccess(
        'user-1',
        'message-1',
        'file-1',
      );

      expect(result).toBe(true);
      expect(
        mockDatabaseService.directMessageGroupMember.findUnique,
      ).toHaveBeenCalledWith({
        where: {
          groupId_userId: {
            groupId: 'dm-group-1',
            userId: 'user-1',
          },
        },
      });
    });

    it('should throw ForbiddenException for DM group when user is not group member', async () => {
      const message = {
        id: 'message-1',
        channelId: null,
        directMessageGroupId: 'dm-group-1',
      };

      mockDatabaseService.message.findUnique.mockResolvedValue(message);
      mockDatabaseService.directMessageGroupMember.findUnique.mockResolvedValue(
        null,
      );

      await expect(
        strategy.checkAccess('user-1', 'message-1', 'file-1'),
      ).rejects.toThrow(ForbiddenException);

      await expect(
        strategy.checkAccess('user-1', 'message-1', 'file-1'),
      ).rejects.toThrow(
        'You must be a member of this conversation to access this file',
      );
    });

    it('should throw ForbiddenException when message has no channel or DM group', async () => {
      const message = {
        id: 'message-1',
        channelId: null,
        directMessageGroupId: null,
      };

      mockDatabaseService.message.findUnique.mockResolvedValue(message);

      await expect(
        strategy.checkAccess('user-1', 'message-1', 'file-1'),
      ).rejects.toThrow(ForbiddenException);

      await expect(
        strategy.checkAccess('user-1', 'message-1', 'file-1'),
      ).rejects.toThrow('Access denied');
    });

    it('should throw NotFoundException when channel not found', async () => {
      const message = {
        id: 'message-1',
        channelId: 'channel-1',
        directMessageGroupId: null,
      };

      mockDatabaseService.message.findUnique.mockResolvedValue(message);
      mockDatabaseService.channel.findUnique.mockResolvedValue(null);

      await expect(
        strategy.checkAccess('user-1', 'message-1', 'file-1'),
      ).rejects.toThrow(NotFoundException);

      await expect(
        strategy.checkAccess('user-1', 'message-1', 'file-1'),
      ).rejects.toThrow('Channel not found');
    });
  });
});
