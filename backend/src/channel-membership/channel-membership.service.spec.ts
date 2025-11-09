import { Test, TestingModule } from '@nestjs/testing';
import { ChannelMembershipService } from './channel-membership.service';
import { DatabaseService } from '@/database/database.service';
import {
  ConflictException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import {
  createMockDatabase,
  UserFactory,
  ChannelFactory,
  CommunityFactory,
  MembershipFactory,
  ChannelMembershipFactory,
} from '@/test-utils';

describe('ChannelMembershipService', () => {
  let service: ChannelMembershipService;
  let mockDatabase: any;

  beforeEach(async () => {
    mockDatabase = createMockDatabase();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChannelMembershipService,
        {
          provide: DatabaseService,
          useValue: mockDatabase,
        },
      ],
    }).compile();

    service = module.get<ChannelMembershipService>(ChannelMembershipService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create channel membership for private channel', async () => {
      const user = UserFactory.build();
      const community = CommunityFactory.build();
      const channel = ChannelFactory.build({
        isPrivate: true,
        communityId: community.id,
      });
      const createDto = { userId: user.id, channelId: channel.id };
      const communityMembership = MembershipFactory.build({
        userId: user.id,
        communityId: community.id,
      });
      const channelMembership = ChannelMembershipFactory.build({
        userId: user.id,
        channelId: channel.id,
      });

      mockDatabase.channel.findUniqueOrThrow.mockResolvedValue({
        ...channel,
        community,
      });
      mockDatabase.user.findUniqueOrThrow.mockResolvedValue(user);
      mockDatabase.membership.findUnique.mockResolvedValue(communityMembership);
      mockDatabase.channelMembership.findUnique.mockResolvedValue(null);
      mockDatabase.channelMembership.create.mockResolvedValue(
        channelMembership,
      );

      const result = await service.create(createDto);

      expect(result).toBeDefined();
      expect(mockDatabase.channelMembership.create).toHaveBeenCalledWith({
        data: {
          userId: user.id,
          channelId: channel.id,
          addedBy: undefined,
        },
      });
    });

    it('should create channel membership with addedBy', async () => {
      const user = UserFactory.build();
      const adder = UserFactory.build();
      const community = CommunityFactory.build();
      const channel = ChannelFactory.build({
        isPrivate: true,
        communityId: community.id,
      });
      const createDto = { userId: user.id, channelId: channel.id };
      const communityMembership = MembershipFactory.build({
        userId: user.id,
        communityId: community.id,
      });
      const channelMembership = ChannelMembershipFactory.build({
        userId: user.id,
        channelId: channel.id,
        addedBy: adder.id,
      });

      mockDatabase.channel.findUniqueOrThrow.mockResolvedValue({
        ...channel,
        community,
      });
      mockDatabase.user.findUniqueOrThrow.mockResolvedValue(user);
      mockDatabase.membership.findUnique.mockResolvedValue(communityMembership);
      mockDatabase.channelMembership.findUnique.mockResolvedValue(null);
      mockDatabase.channelMembership.create.mockResolvedValue(
        channelMembership,
      );

      const result = await service.create(createDto, adder.id);

      expect(result).toBeDefined();
      expect(mockDatabase.channelMembership.create).toHaveBeenCalledWith({
        data: {
          userId: user.id,
          channelId: channel.id,
          addedBy: adder.id,
        },
      });
    });

    it('should throw ForbiddenException for public channel', async () => {
      const user = UserFactory.build();
      const community = CommunityFactory.build();
      const channel = ChannelFactory.build({
        isPrivate: false,
        communityId: community.id,
      });
      const createDto = { userId: user.id, channelId: channel.id };

      mockDatabase.channel.findUniqueOrThrow.mockResolvedValue({
        ...channel,
        community,
      });

      await expect(service.create(createDto)).rejects.toThrow(
        ForbiddenException,
      );
      await expect(service.create(createDto)).rejects.toThrow(
        'Cannot manage membership for public channels',
      );
    });

    it('should throw NotFoundException when user not found', async () => {
      const community = CommunityFactory.build();
      const channel = ChannelFactory.build({
        isPrivate: true,
        communityId: community.id,
      });
      const createDto = {
        userId: 'non-existent-user',
        channelId: channel.id,
      };

      mockDatabase.channel.findUniqueOrThrow.mockResolvedValue({
        ...channel,
        community,
      });
      mockDatabase.user.findUniqueOrThrow.mockRejectedValue(
        new Error('Not found'),
      );

      await expect(service.create(createDto)).rejects.toThrow();
    });

    it('should throw ForbiddenException when user not community member', async () => {
      const user = UserFactory.build();
      const community = CommunityFactory.build();
      const channel = ChannelFactory.build({
        isPrivate: true,
        communityId: community.id,
      });
      const createDto = { userId: user.id, channelId: channel.id };

      mockDatabase.channel.findUniqueOrThrow.mockResolvedValue({
        ...channel,
        community,
      });
      mockDatabase.user.findUniqueOrThrow.mockResolvedValue(user);
      mockDatabase.membership.findUnique.mockResolvedValue(null);

      await expect(service.create(createDto)).rejects.toThrow(
        ForbiddenException,
      );
      await expect(service.create(createDto)).rejects.toThrow(
        'User must be a member of the community',
      );
    });

    it('should throw ConflictException when membership already exists', async () => {
      const user = UserFactory.build();
      const community = CommunityFactory.build();
      const channel = ChannelFactory.build({
        isPrivate: true,
        communityId: community.id,
      });
      const createDto = { userId: user.id, channelId: channel.id };
      const communityMembership = MembershipFactory.build({
        userId: user.id,
        communityId: community.id,
      });
      const existingChannelMembership = ChannelMembershipFactory.build({
        userId: user.id,
        channelId: channel.id,
      });

      mockDatabase.channel.findUniqueOrThrow.mockResolvedValue({
        ...channel,
        community,
      });
      mockDatabase.user.findUniqueOrThrow.mockResolvedValue(user);
      mockDatabase.membership.findUnique.mockResolvedValue(communityMembership);
      mockDatabase.channelMembership.findUnique.mockResolvedValue(
        existingChannelMembership,
      );

      await expect(service.create(createDto)).rejects.toThrow(
        ConflictException,
      );
      await expect(service.create(createDto)).rejects.toThrow(
        'User is already a member of this channel',
      );
    });

    it('should handle P2002 (duplicate) error', async () => {
      const user = UserFactory.build();
      const community = CommunityFactory.build();
      const channel = ChannelFactory.build({
        isPrivate: true,
        communityId: community.id,
      });
      const createDto = { userId: user.id, channelId: channel.id };
      const communityMembership = MembershipFactory.build({
        userId: user.id,
        communityId: community.id,
      });

      mockDatabase.channel.findUniqueOrThrow.mockResolvedValue({
        ...channel,
        community,
      });
      mockDatabase.user.findUniqueOrThrow.mockResolvedValue(user);
      mockDatabase.membership.findUnique.mockResolvedValue(communityMembership);
      mockDatabase.channelMembership.findUnique.mockResolvedValue(null);
      mockDatabase.channelMembership.create.mockRejectedValue({
        code: 'P2002',
      });

      await expect(service.create(createDto)).rejects.toThrow(
        ConflictException,
      );
      await expect(service.create(createDto)).rejects.toThrow(
        'User is already a member of this channel',
      );
    });

    it('should handle P2025 (not found) error', async () => {
      const user = UserFactory.build();
      const community = CommunityFactory.build();
      const channel = ChannelFactory.build({
        isPrivate: true,
        communityId: community.id,
      });
      const createDto = { userId: user.id, channelId: channel.id };
      const communityMembership = MembershipFactory.build({
        userId: user.id,
        communityId: community.id,
      });

      mockDatabase.channel.findUniqueOrThrow.mockResolvedValue({
        ...channel,
        community,
      });
      mockDatabase.user.findUniqueOrThrow.mockResolvedValue(user);
      mockDatabase.membership.findUnique.mockResolvedValue(communityMembership);
      mockDatabase.channelMembership.findUnique.mockResolvedValue(null);
      mockDatabase.channelMembership.create.mockRejectedValue({
        code: 'P2025',
      });

      await expect(service.create(createDto)).rejects.toThrow(
        NotFoundException,
      );
      await expect(service.create(createDto)).rejects.toThrow(
        'User or channel not found',
      );
    });

    it('should log successful creation', async () => {
      const user = UserFactory.build();
      const community = CommunityFactory.build();
      const channel = ChannelFactory.build({
        isPrivate: true,
        communityId: community.id,
      });
      const createDto = { userId: user.id, channelId: channel.id };
      const communityMembership = MembershipFactory.build({
        userId: user.id,
        communityId: community.id,
      });
      const channelMembership = ChannelMembershipFactory.build({
        userId: user.id,
        channelId: channel.id,
      });

      mockDatabase.channel.findUniqueOrThrow.mockResolvedValue({
        ...channel,
        community,
      });
      mockDatabase.user.findUniqueOrThrow.mockResolvedValue(user);
      mockDatabase.membership.findUnique.mockResolvedValue(communityMembership);
      mockDatabase.channelMembership.findUnique.mockResolvedValue(null);
      mockDatabase.channelMembership.create.mockResolvedValue(
        channelMembership,
      );

      const loggerLogSpy = jest
        .spyOn(service['logger'], 'log')
        .mockImplementation();

      await service.create(createDto);

      expect(loggerLogSpy).toHaveBeenCalledWith(
        expect.stringContaining(`Added user ${user.id}`),
      );

      loggerLogSpy.mockRestore();
    });
  });

  describe('findAllForChannel', () => {
    it('should return all memberships for private channel', async () => {
      const channel = ChannelFactory.build({ isPrivate: true });
      const user1 = UserFactory.build();
      const user2 = UserFactory.build();
      const memberships = [
        {
          ...ChannelMembershipFactory.build({
            channelId: channel.id,
            userId: user1.id,
          }),
          user: user1,
        },
        {
          ...ChannelMembershipFactory.build({
            channelId: channel.id,
            userId: user2.id,
          }),
          user: user2,
        },
      ];

      mockDatabase.channel.findUniqueOrThrow.mockResolvedValue(channel);
      mockDatabase.channelMembership.findMany.mockResolvedValue(memberships);

      const result = await service.findAllForChannel(channel.id);

      expect(result).toBeDefined();
      expect(result).toHaveLength(2);
      expect(mockDatabase.channelMembership.findMany).toHaveBeenCalledWith({
        where: { channelId: channel.id },
        include: {
          user: true,
        },
      });
    });

    it('should throw ForbiddenException for public channel', async () => {
      const channel = ChannelFactory.build({ isPrivate: false });

      mockDatabase.channel.findUniqueOrThrow.mockResolvedValue(channel);

      await expect(service.findAllForChannel(channel.id)).rejects.toThrow(
        ForbiddenException,
      );
      await expect(service.findAllForChannel(channel.id)).rejects.toThrow(
        'This endpoint is only for private channels',
      );
    });

    it('should return empty array when no memberships exist', async () => {
      const channel = ChannelFactory.build({ isPrivate: true });

      mockDatabase.channel.findUniqueOrThrow.mockResolvedValue(channel);
      mockDatabase.channelMembership.findMany.mockResolvedValue([]);

      const result = await service.findAllForChannel(channel.id);

      expect(result).toEqual([]);
    });

    it('should rethrow errors', async () => {
      const channel = ChannelFactory.build({ isPrivate: true });

      mockDatabase.channel.findUniqueOrThrow.mockRejectedValue(
        new Error('Database error'),
      );

      await expect(service.findAllForChannel(channel.id)).rejects.toThrow(
        'Database error',
      );
    });
  });

  describe('findAllForUser', () => {
    it('should return all private channel memberships for user', async () => {
      const user = UserFactory.build();
      const channel1 = ChannelFactory.build({ isPrivate: true });
      const channel2 = ChannelFactory.build({ isPrivate: true });
      const memberships = [
        {
          ...ChannelMembershipFactory.build({
            userId: user.id,
            channelId: channel1.id,
          }),
          channel: channel1,
        },
        {
          ...ChannelMembershipFactory.build({
            userId: user.id,
            channelId: channel2.id,
          }),
          channel: channel2,
        },
      ];

      mockDatabase.channelMembership.findMany.mockResolvedValue(memberships);

      const result = await service.findAllForUser(user.id);

      expect(result).toBeDefined();
      expect(result).toHaveLength(2);
      expect(mockDatabase.channelMembership.findMany).toHaveBeenCalledWith({
        where: {
          userId: user.id,
          channel: {
            isPrivate: true,
          },
        },
        include: {
          channel: {
            select: {
              id: true,
              name: true,
              communityId: true,
              isPrivate: true,
            },
          },
        },
      });
    });

    it('should return empty array when no memberships exist', async () => {
      const user = UserFactory.build();
      mockDatabase.channelMembership.findMany.mockResolvedValue([]);

      const result = await service.findAllForUser(user.id);

      expect(result).toEqual([]);
    });

    it('should rethrow errors', async () => {
      const user = UserFactory.build();
      mockDatabase.channelMembership.findMany.mockRejectedValue(
        new Error('Database error'),
      );

      await expect(service.findAllForUser(user.id)).rejects.toThrow(
        'Database error',
      );
    });
  });

  describe('findOne', () => {
    it('should return a specific membership for private channel', async () => {
      const user = UserFactory.build();
      const channel = ChannelFactory.build({ isPrivate: true });
      const membership = {
        ...ChannelMembershipFactory.build({
          userId: user.id,
          channelId: channel.id,
        }),
        channel,
      };

      mockDatabase.channelMembership.findUniqueOrThrow.mockResolvedValue(
        membership,
      );

      const result = await service.findOne(user.id, channel.id);

      expect(result).toBeDefined();
      expect(
        mockDatabase.channelMembership.findUniqueOrThrow,
      ).toHaveBeenCalledWith({
        where: {
          userId_channelId: {
            userId: user.id,
            channelId: channel.id,
          },
        },
        include: {
          channel: true,
        },
      });
    });

    it('should throw NotFoundException for public channel membership', async () => {
      const user = UserFactory.build();
      const channel = ChannelFactory.build({ isPrivate: false });
      const membership = {
        ...ChannelMembershipFactory.build({
          userId: user.id,
          channelId: channel.id,
        }),
        channel,
      };

      mockDatabase.channelMembership.findUniqueOrThrow.mockResolvedValue(
        membership,
      );

      // Note: The service throws ForbiddenException internally but catch block converts it to NotFoundException
      await expect(service.findOne(user.id, channel.id)).rejects.toThrow(
        NotFoundException,
      );
      await expect(service.findOne(user.id, channel.id)).rejects.toThrow(
        'Channel membership not found',
      );
    });

    it('should throw NotFoundException when membership not found', async () => {
      const user = UserFactory.build();
      const channel = ChannelFactory.build();

      mockDatabase.channelMembership.findUniqueOrThrow.mockRejectedValue(
        new Error('Not found'),
      );

      await expect(service.findOne(user.id, channel.id)).rejects.toThrow(
        NotFoundException,
      );
      await expect(service.findOne(user.id, channel.id)).rejects.toThrow(
        'Channel membership not found',
      );
    });
  });

  describe('remove', () => {
    it('should remove membership from private channel', async () => {
      const user = UserFactory.build();
      const channel = ChannelFactory.build({ isPrivate: true });
      const membership = ChannelMembershipFactory.build({
        userId: user.id,
        channelId: channel.id,
      });

      mockDatabase.channel.findUniqueOrThrow.mockResolvedValue(channel);
      mockDatabase.channelMembership.findUniqueOrThrow.mockResolvedValue(
        membership,
      );
      mockDatabase.channelMembership.delete.mockResolvedValue(membership);

      await service.remove(user.id, channel.id);

      expect(mockDatabase.channelMembership.delete).toHaveBeenCalledWith({
        where: {
          userId_channelId: {
            userId: user.id,
            channelId: channel.id,
          },
        },
      });
    });

    it('should throw ForbiddenException for public channel', async () => {
      const user = UserFactory.build();
      const channel = ChannelFactory.build({ isPrivate: false });

      mockDatabase.channel.findUniqueOrThrow.mockResolvedValue(channel);

      await expect(service.remove(user.id, channel.id)).rejects.toThrow(
        ForbiddenException,
      );
      await expect(service.remove(user.id, channel.id)).rejects.toThrow(
        'Cannot remove users from public channels',
      );
    });

    it('should throw NotFoundException when membership not found', async () => {
      const user = UserFactory.build();
      const channel = ChannelFactory.build({ isPrivate: true });

      mockDatabase.channel.findUniqueOrThrow.mockResolvedValue(channel);
      mockDatabase.channelMembership.findUniqueOrThrow.mockRejectedValue(
        new Error('Not found'),
      );

      await expect(service.remove(user.id, channel.id)).rejects.toThrow();
    });

    it('should handle P2025 error', async () => {
      const user = UserFactory.build();
      const channel = ChannelFactory.build({ isPrivate: true });
      const membership = ChannelMembershipFactory.build({
        userId: user.id,
        channelId: channel.id,
      });

      mockDatabase.channel.findUniqueOrThrow.mockResolvedValue(channel);
      mockDatabase.channelMembership.findUniqueOrThrow.mockResolvedValue(
        membership,
      );
      mockDatabase.channelMembership.delete.mockRejectedValue({
        code: 'P2025',
      });

      await expect(service.remove(user.id, channel.id)).rejects.toThrow(
        NotFoundException,
      );
      await expect(service.remove(user.id, channel.id)).rejects.toThrow(
        'Channel membership not found',
      );
    });

    it('should log successful removal', async () => {
      const user = UserFactory.build();
      const channel = ChannelFactory.build({ isPrivate: true });
      const membership = ChannelMembershipFactory.build({
        userId: user.id,
        channelId: channel.id,
      });

      mockDatabase.channel.findUniqueOrThrow.mockResolvedValue(channel);
      mockDatabase.channelMembership.findUniqueOrThrow.mockResolvedValue(
        membership,
      );
      mockDatabase.channelMembership.delete.mockResolvedValue(membership);

      const loggerLogSpy = jest
        .spyOn(service['logger'], 'log')
        .mockImplementation();

      await service.remove(user.id, channel.id);

      expect(loggerLogSpy).toHaveBeenCalledWith(
        expect.stringContaining(`Removed user ${user.id}`),
      );

      loggerLogSpy.mockRestore();
    });
  });

  describe('isMember', () => {
    it('should return true for private channel member', async () => {
      const user = UserFactory.build();
      const channel = ChannelFactory.build({ isPrivate: true });
      const membership = {
        ...ChannelMembershipFactory.build({
          userId: user.id,
          channelId: channel.id,
        }),
        channel,
      };

      mockDatabase.channelMembership.findUnique.mockResolvedValue(membership);

      const result = await service.isMember(user.id, channel.id);

      expect(result).toBe(true);
    });

    it('should return false when user not private channel member', async () => {
      const user = UserFactory.build();
      const channel = ChannelFactory.build({ isPrivate: true });

      mockDatabase.channelMembership.findUnique.mockResolvedValue(null);

      const result = await service.isMember(user.id, channel.id);

      expect(result).toBe(false);
    });

    it('should check community membership for public channel', async () => {
      const user = UserFactory.build();
      const community = CommunityFactory.build();
      const channel = ChannelFactory.build({
        isPrivate: false,
        communityId: community.id,
      });
      const membership = {
        ...ChannelMembershipFactory.build({
          userId: user.id,
          channelId: channel.id,
        }),
        channel,
      };
      const communityMembership = MembershipFactory.build({
        userId: user.id,
        communityId: community.id,
      });

      mockDatabase.channelMembership.findUnique.mockResolvedValue(membership);
      mockDatabase.channel.findUnique.mockResolvedValue(channel);
      mockDatabase.membership.findUnique.mockResolvedValue(communityMembership);

      const result = await service.isMember(user.id, channel.id);

      expect(result).toBe(true);
      expect(mockDatabase.membership.findUnique).toHaveBeenCalledWith({
        where: {
          userId_communityId: {
            userId: user.id,
            communityId: community.id,
          },
        },
      });
    });

    it('should return false for public channel when not community member', async () => {
      const user = UserFactory.build();
      const community = CommunityFactory.build();
      const channel = ChannelFactory.build({
        isPrivate: false,
        communityId: community.id,
      });
      const membership = {
        ...ChannelMembershipFactory.build({
          userId: user.id,
          channelId: channel.id,
        }),
        channel,
      };

      mockDatabase.channelMembership.findUnique.mockResolvedValue(membership);
      mockDatabase.channel.findUnique.mockResolvedValue(channel);
      mockDatabase.membership.findUnique.mockResolvedValue(null);

      const result = await service.isMember(user.id, channel.id);

      expect(result).toBe(false);
    });

    it('should return false on error', async () => {
      const user = UserFactory.build();
      const channel = ChannelFactory.build();

      mockDatabase.channelMembership.findUnique.mockRejectedValue(
        new Error('Database error'),
      );

      const loggerErrorSpy = jest
        .spyOn(service['logger'], 'error')
        .mockImplementation();

      const result = await service.isMember(user.id, channel.id);

      expect(result).toBe(false);
      expect(loggerErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Error checking channel membership'),
        expect.any(Error),
      );

      loggerErrorSpy.mockRestore();
    });
  });
});
