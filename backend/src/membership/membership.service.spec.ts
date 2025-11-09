import { Test, TestingModule } from '@nestjs/testing';
import { MembershipService } from './membership.service';
import { DatabaseService } from '@/database/database.service';
import { CommunityService } from '@/community/community.service';
import { RolesService } from '@/roles/roles.service';
import { ConflictException, NotFoundException } from '@nestjs/common';
import {
  createMockDatabase,
  UserFactory,
  CommunityFactory,
  MembershipFactory,
  RoleFactory,
} from '@/test-utils';

describe('MembershipService', () => {
  let service: MembershipService;
  let mockDatabase: ReturnType<typeof createMockDatabase>;
  let communityService: CommunityService;
  let rolesService: RolesService;

  beforeEach(async () => {
    mockDatabase = createMockDatabase();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MembershipService,
        {
          provide: DatabaseService,
          useValue: mockDatabase,
        },
        {
          provide: CommunityService,
          useValue: {
            addMemberToGeneralChannel: jest.fn(),
          },
        },
        {
          provide: RolesService,
          useValue: {
            getCommunityMemberRole: jest.fn(),
            createMemberRoleForCommunity: jest.fn(),
            assignUserToCommunityRole: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<MembershipService>(MembershipService);
    communityService = module.get<CommunityService>(CommunityService);
    rolesService = module.get<RolesService>(RolesService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create membership and add user to general channel and assign role', async () => {
      const user = UserFactory.build();
      const community = CommunityFactory.build();
      const createDto = { userId: user.id, communityId: community.id };
      const membership = MembershipFactory.build({
        userId: user.id,
        communityId: community.id,
      });
      const memberRole = RoleFactory.build({ name: 'Member' });

      mockDatabase.community.findUniqueOrThrow.mockResolvedValue(community);
      mockDatabase.user.findUniqueOrThrow.mockResolvedValue(user);
      mockDatabase.membership.findUnique.mockResolvedValue(null);
      mockDatabase.membership.create.mockResolvedValue(membership);
      jest
        .spyOn(communityService, 'addMemberToGeneralChannel')
        .mockResolvedValue(undefined);
      jest
        .spyOn(rolesService, 'getCommunityMemberRole')
        .mockResolvedValue(memberRole);
      jest
        .spyOn(rolesService, 'assignUserToCommunityRole')
        .mockResolvedValue(undefined);

      const result = await service.create(createDto);

      expect(result).toBeDefined();
      expect(mockDatabase.membership.create).toHaveBeenCalledWith({
        data: {
          userId: user.id,
          communityId: community.id,
        },
      });
      expect(communityService.addMemberToGeneralChannel).toHaveBeenCalledWith(
        community.id,
        user.id,
      );
      expect(rolesService.getCommunityMemberRole).toHaveBeenCalledWith(
        community.id,
      );
      expect(rolesService.assignUserToCommunityRole).toHaveBeenCalledWith(
        user.id,
        community.id,
        memberRole.id,
      );
    });

    it('should throw ConflictException when membership already exists', async () => {
      const user = UserFactory.build();
      const community = CommunityFactory.build();
      const createDto = { userId: user.id, communityId: community.id };
      const existingMembership = MembershipFactory.build({
        userId: user.id,
        communityId: community.id,
      });

      mockDatabase.community.findUniqueOrThrow.mockResolvedValue(community);
      mockDatabase.user.findUniqueOrThrow.mockResolvedValue(user);
      mockDatabase.membership.findUnique.mockResolvedValue(existingMembership);

      await expect(service.create(createDto)).rejects.toThrow(
        ConflictException,
      );
      await expect(service.create(createDto)).rejects.toThrow(
        'User is already a member of this community',
      );
    });

    it('should throw NotFoundException when community not found', async () => {
      const user = UserFactory.build();
      const createDto = {
        userId: user.id,
        communityId: 'non-existent-community',
      };

      mockDatabase.community.findUniqueOrThrow.mockRejectedValue(
        new Error('Not found'),
      );

      await expect(service.create(createDto)).rejects.toThrow();
    });

    it('should throw NotFoundException when user not found', async () => {
      const community = CommunityFactory.build();
      const createDto = {
        userId: 'non-existent-user',
        communityId: community.id,
      };

      mockDatabase.community.findUniqueOrThrow.mockResolvedValue(community);
      mockDatabase.user.findUniqueOrThrow.mockRejectedValue(
        new Error('Not found'),
      );

      await expect(service.create(createDto)).rejects.toThrow();
    });

    it('should create membership even if adding to general channel fails', async () => {
      const user = UserFactory.build();
      const community = CommunityFactory.build();
      const createDto = { userId: user.id, communityId: community.id };
      const membership = MembershipFactory.build({
        userId: user.id,
        communityId: community.id,
      });
      const memberRole = RoleFactory.build({ name: 'Member' });

      mockDatabase.community.findUniqueOrThrow.mockResolvedValue(community);
      mockDatabase.user.findUniqueOrThrow.mockResolvedValue(user);
      mockDatabase.membership.findUnique.mockResolvedValue(null);
      mockDatabase.membership.create.mockResolvedValue(membership);
      jest
        .spyOn(communityService, 'addMemberToGeneralChannel')
        .mockRejectedValue(new Error('Channel not found'));
      jest
        .spyOn(rolesService, 'getCommunityMemberRole')
        .mockResolvedValue(memberRole);
      jest
        .spyOn(rolesService, 'assignUserToCommunityRole')
        .mockResolvedValue(undefined);

      const loggerWarnSpy = jest
        .spyOn(service['logger'], 'warn')
        .mockImplementation();

      const result = await service.create(createDto);

      expect(result).toBeDefined();
      expect(loggerWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to add user'),
        expect.any(Error),
      );

      loggerWarnSpy.mockRestore();
    });

    it('should create Member role if it does not exist', async () => {
      const user = UserFactory.build();
      const community = CommunityFactory.build();
      const createDto = { userId: user.id, communityId: community.id };
      const membership = MembershipFactory.build({
        userId: user.id,
        communityId: community.id,
      });
      const memberRole = RoleFactory.build({ name: 'Member' });

      mockDatabase.community.findUniqueOrThrow.mockResolvedValue(community);
      mockDatabase.user.findUniqueOrThrow.mockResolvedValue(user);
      mockDatabase.membership.findUnique.mockResolvedValue(null);
      mockDatabase.membership.create.mockResolvedValue(membership);
      jest
        .spyOn(communityService, 'addMemberToGeneralChannel')
        .mockResolvedValue(undefined);
      jest
        .spyOn(rolesService, 'getCommunityMemberRole')
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(memberRole);
      jest
        .spyOn(rolesService, 'createMemberRoleForCommunity')
        .mockResolvedValue('member-role-id');
      jest
        .spyOn(rolesService, 'assignUserToCommunityRole')
        .mockResolvedValue(undefined);

      const loggerLogSpy = jest
        .spyOn(service['logger'], 'log')
        .mockImplementation();

      const result = await service.create(createDto);

      expect(result).toBeDefined();
      expect(rolesService.createMemberRoleForCommunity).toHaveBeenCalledWith(
        community.id,
      );
      expect(loggerLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Member role not found'),
      );

      loggerLogSpy.mockRestore();
    });

    it('should handle error when Member role creation fails', async () => {
      const user = UserFactory.build();
      const community = CommunityFactory.build();
      const createDto = { userId: user.id, communityId: community.id };
      const membership = MembershipFactory.build({
        userId: user.id,
        communityId: community.id,
      });

      mockDatabase.community.findUniqueOrThrow.mockResolvedValue(community);
      mockDatabase.user.findUniqueOrThrow.mockResolvedValue(user);
      mockDatabase.membership.findUnique.mockResolvedValue(null);
      mockDatabase.membership.create.mockResolvedValue(membership);
      jest
        .spyOn(communityService, 'addMemberToGeneralChannel')
        .mockResolvedValue(undefined);
      jest
        .spyOn(rolesService, 'getCommunityMemberRole')
        .mockResolvedValue(null);
      jest
        .spyOn(rolesService, 'createMemberRoleForCommunity')
        .mockResolvedValue('member-role-id');

      const loggerErrorSpy = jest
        .spyOn(service['logger'], 'error')
        .mockImplementation();

      const result = await service.create(createDto);

      expect(result).toBeDefined();
      expect(loggerErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to create or find member role'),
      );

      loggerErrorSpy.mockRestore();
    });

    it('should create membership even if role assignment fails', async () => {
      const user = UserFactory.build();
      const community = CommunityFactory.build();
      const createDto = { userId: user.id, communityId: community.id };
      const membership = MembershipFactory.build({
        userId: user.id,
        communityId: community.id,
      });
      const memberRole = RoleFactory.build({ name: 'Member' });

      mockDatabase.community.findUniqueOrThrow.mockResolvedValue(community);
      mockDatabase.user.findUniqueOrThrow.mockResolvedValue(user);
      mockDatabase.membership.findUnique.mockResolvedValue(null);
      mockDatabase.membership.create.mockResolvedValue(membership);
      jest
        .spyOn(communityService, 'addMemberToGeneralChannel')
        .mockResolvedValue(undefined);
      jest
        .spyOn(rolesService, 'getCommunityMemberRole')
        .mockResolvedValue(memberRole);
      jest
        .spyOn(rolesService, 'assignUserToCommunityRole')
        .mockRejectedValue(new Error('Role assignment failed'));

      const loggerWarnSpy = jest
        .spyOn(service['logger'], 'warn')
        .mockImplementation();

      const result = await service.create(createDto);

      expect(result).toBeDefined();
      expect(loggerWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to assign default member role'),
        expect.any(Error),
      );

      loggerWarnSpy.mockRestore();
    });

    it('should handle P2002 (duplicate) error', async () => {
      const user = UserFactory.build();
      const community = CommunityFactory.build();
      const createDto = { userId: user.id, communityId: community.id };

      mockDatabase.community.findUniqueOrThrow.mockResolvedValue(community);
      mockDatabase.user.findUniqueOrThrow.mockResolvedValue(user);
      mockDatabase.membership.findUnique.mockResolvedValue(null);
      mockDatabase.membership.create.mockRejectedValue({ code: 'P2002' });

      await expect(service.create(createDto)).rejects.toThrow(
        ConflictException,
      );
      await expect(service.create(createDto)).rejects.toThrow(
        'User is already a member of this community',
      );
    });

    it('should handle P2025 (not found) error', async () => {
      const user = UserFactory.build();
      const community = CommunityFactory.build();
      const createDto = { userId: user.id, communityId: community.id };

      mockDatabase.community.findUniqueOrThrow.mockResolvedValue(community);
      mockDatabase.user.findUniqueOrThrow.mockResolvedValue(user);
      mockDatabase.membership.findUnique.mockResolvedValue(null);
      mockDatabase.membership.create.mockRejectedValue({ code: 'P2025' });

      await expect(service.create(createDto)).rejects.toThrow(
        NotFoundException,
      );
      await expect(service.create(createDto)).rejects.toThrow(
        'User or community not found',
      );
    });
  });

  describe('findAllForCommunity', () => {
    it('should return all memberships for a community with user info', async () => {
      const community = CommunityFactory.build();
      const user1 = UserFactory.build();
      const user2 = UserFactory.build();
      const memberships = [
        {
          ...MembershipFactory.build({
            communityId: community.id,
            userId: user1.id,
          }),
          user: user1,
        },
        {
          ...MembershipFactory.build({
            communityId: community.id,
            userId: user2.id,
          }),
          user: user2,
        },
      ];

      mockDatabase.membership.findMany.mockResolvedValue(memberships);

      const result = await service.findAllForCommunity(community.id);

      expect(result).toBeDefined();
      expect(result).toHaveLength(2);
      expect(mockDatabase.membership.findMany).toHaveBeenCalledWith({
        where: { communityId: community.id },
        include: {
          user: true,
        },
      });
    });

    it('should return empty array when no memberships exist', async () => {
      const community = CommunityFactory.build();
      mockDatabase.membership.findMany.mockResolvedValue([]);

      const result = await service.findAllForCommunity(community.id);

      expect(result).toEqual([]);
    });

    it('should rethrow errors', async () => {
      const community = CommunityFactory.build();
      mockDatabase.membership.findMany.mockRejectedValue(
        new Error('Database error'),
      );

      await expect(service.findAllForCommunity(community.id)).rejects.toThrow(
        'Database error',
      );
    });
  });

  describe('findAllForUser', () => {
    it('should return all memberships for a user with community info', async () => {
      const user = UserFactory.build();
      const community1 = CommunityFactory.build();
      const community2 = CommunityFactory.build();
      const memberships = [
        {
          ...MembershipFactory.build({
            userId: user.id,
            communityId: community1.id,
          }),
          community: community1,
        },
        {
          ...MembershipFactory.build({
            userId: user.id,
            communityId: community2.id,
          }),
          community: community2,
        },
      ];

      mockDatabase.membership.findMany.mockResolvedValue(memberships);

      const result = await service.findAllForUser(user.id);

      expect(result).toBeDefined();
      expect(result).toHaveLength(2);
      expect(mockDatabase.membership.findMany).toHaveBeenCalledWith({
        where: { userId: user.id },
        include: {
          community: {
            select: {
              id: true,
              name: true,
              description: true,
              avatar: true,
            },
          },
        },
      });
    });

    it('should return empty array when no memberships exist', async () => {
      const user = UserFactory.build();
      mockDatabase.membership.findMany.mockResolvedValue([]);

      const result = await service.findAllForUser(user.id);

      expect(result).toEqual([]);
    });

    it('should rethrow errors', async () => {
      const user = UserFactory.build();
      mockDatabase.membership.findMany.mockRejectedValue(
        new Error('Database error'),
      );

      await expect(service.findAllForUser(user.id)).rejects.toThrow(
        'Database error',
      );
    });
  });

  describe('findOne', () => {
    it('should return a specific membership', async () => {
      const user = UserFactory.build();
      const community = CommunityFactory.build();
      const membership = MembershipFactory.build({
        userId: user.id,
        communityId: community.id,
      });

      mockDatabase.membership.findUniqueOrThrow.mockResolvedValue(membership);

      const result = await service.findOne(user.id, community.id);

      expect(result).toBeDefined();
      expect(mockDatabase.membership.findUniqueOrThrow).toHaveBeenCalledWith({
        where: {
          userId_communityId: {
            userId: user.id,
            communityId: community.id,
          },
        },
      });
    });

    it('should throw NotFoundException when membership not found', async () => {
      const user = UserFactory.build();
      const community = CommunityFactory.build();

      mockDatabase.membership.findUniqueOrThrow.mockRejectedValue(
        new Error('Not found'),
      );

      await expect(service.findOne(user.id, community.id)).rejects.toThrow(
        NotFoundException,
      );
      await expect(service.findOne(user.id, community.id)).rejects.toThrow(
        'Membership not found',
      );
    });
  });

  describe('remove', () => {
    it('should remove membership and all related data in transaction', async () => {
      const user = UserFactory.build();
      const community = CommunityFactory.build();
      const membership = MembershipFactory.build({
        userId: user.id,
        communityId: community.id,
      });

      mockDatabase.membership.findUniqueOrThrow.mockResolvedValue(membership);

      const mockTx = {
        channelMembership: {
          deleteMany: jest.fn().mockResolvedValue({ count: 5 }),
        },
        userRoles: {
          deleteMany: jest.fn().mockResolvedValue({ count: 2 }),
        },
        membership: {
          delete: jest.fn().mockResolvedValue(membership),
        },
      };

      // eslint-disable-next-line @typescript-eslint/require-await
      mockDatabase.$transaction.mockImplementation(async (callback) => {
        return callback(mockTx);
      });

      await service.remove(user.id, community.id);

      expect(mockTx.channelMembership.deleteMany).toHaveBeenCalledWith({
        where: {
          userId: user.id,
          channel: {
            communityId: community.id,
          },
        },
      });
      expect(mockTx.userRoles.deleteMany).toHaveBeenCalledWith({
        where: {
          userId: user.id,
          communityId: community.id,
        },
      });
      expect(mockTx.membership.delete).toHaveBeenCalledWith({
        where: {
          userId_communityId: {
            userId: user.id,
            communityId: community.id,
          },
        },
      });
    });

    it('should throw NotFoundException when membership not found', async () => {
      const user = UserFactory.build();
      const community = CommunityFactory.build();

      mockDatabase.membership.findUniqueOrThrow.mockRejectedValue(
        new Error('Not found'),
      );

      await expect(service.remove(user.id, community.id)).rejects.toThrow();
    });

    it('should handle P2025 error from transaction', async () => {
      const user = UserFactory.build();
      const community = CommunityFactory.build();
      const membership = MembershipFactory.build({
        userId: user.id,
        communityId: community.id,
      });

      mockDatabase.membership.findUniqueOrThrow.mockResolvedValue(membership);
      mockDatabase.$transaction.mockRejectedValue({ code: 'P2025' });

      await expect(service.remove(user.id, community.id)).rejects.toThrow(
        NotFoundException,
      );
      await expect(service.remove(user.id, community.id)).rejects.toThrow(
        'Membership not found',
      );
    });

    it('should log successful removal', async () => {
      const user = UserFactory.build();
      const community = CommunityFactory.build();
      const membership = MembershipFactory.build({
        userId: user.id,
        communityId: community.id,
      });

      mockDatabase.membership.findUniqueOrThrow.mockResolvedValue(membership);

      const mockTx = {
        channelMembership: {
          deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
        },
        userRoles: {
          deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
        },
        membership: {
          delete: jest.fn().mockResolvedValue(membership),
        },
      };

      // eslint-disable-next-line @typescript-eslint/require-await
      mockDatabase.$transaction.mockImplementation(async (callback) => {
        return callback(mockTx);
      });

      const loggerLogSpy = jest
        .spyOn(service['logger'], 'log')
        .mockImplementation();

      await service.remove(user.id, community.id);

      expect(loggerLogSpy).toHaveBeenCalledWith(
        expect.stringContaining(`Removed user ${user.id}`),
      );

      loggerLogSpy.mockRestore();
    });
  });

  describe('isMember', () => {
    it('should return true when user is a member', async () => {
      const user = UserFactory.build();
      const community = CommunityFactory.build();
      const membership = MembershipFactory.build({
        userId: user.id,
        communityId: community.id,
      });

      mockDatabase.membership.findUnique.mockResolvedValue(membership);

      const result = await service.isMember(user.id, community.id);

      expect(result).toBe(true);
    });

    it('should return false when user is not a member', async () => {
      const user = UserFactory.build();
      const community = CommunityFactory.build();

      mockDatabase.membership.findUnique.mockResolvedValue(null);

      const result = await service.isMember(user.id, community.id);

      expect(result).toBe(false);
    });

    it('should return false on error', async () => {
      const user = UserFactory.build();
      const community = CommunityFactory.build();

      mockDatabase.membership.findUnique.mockRejectedValue(
        new Error('Database error'),
      );

      const loggerErrorSpy = jest
        .spyOn(service['logger'], 'error')
        .mockImplementation();

      const result = await service.isMember(user.id, community.id);

      expect(result).toBe(false);
      expect(loggerErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Error checking membership'),
        expect.any(Error),
      );

      loggerErrorSpy.mockRestore();
    });
  });

  describe('searchMembers', () => {
    it('should search members by username with default limit', async () => {
      const community = CommunityFactory.build();
      const user1 = UserFactory.build({ username: 'alice' });
      const user2 = UserFactory.build({ username: 'alex' });
      const memberships = [
        {
          ...MembershipFactory.build({
            communityId: community.id,
            userId: user1.id,
          }),
          user: user1,
        },
        {
          ...MembershipFactory.build({
            communityId: community.id,
            userId: user2.id,
          }),
          user: user2,
        },
      ];

      mockDatabase.membership.findMany.mockResolvedValue(memberships);

      const result = await service.searchMembers(community.id, 'al');

      expect(result).toBeDefined();
      expect(result).toHaveLength(2);
      expect(mockDatabase.membership.findMany).toHaveBeenCalledWith({
        where: {
          communityId: community.id,
          user: {
            OR: [
              {
                username: {
                  contains: 'al',
                  mode: 'insensitive',
                },
              },
              {
                displayName: {
                  contains: 'al',
                  mode: 'insensitive',
                },
              },
            ],
          },
        },
        include: {
          user: true,
        },
        take: 10,
        orderBy: {
          user: {
            username: 'asc',
          },
        },
      });
    });

    it('should search members by displayName', async () => {
      const community = CommunityFactory.build();
      const user1 = UserFactory.build({ displayName: 'John Doe' });
      const memberships = [
        {
          ...MembershipFactory.build({
            communityId: community.id,
            userId: user1.id,
          }),
          user: user1,
        },
      ];

      mockDatabase.membership.findMany.mockResolvedValue(memberships);

      const result = await service.searchMembers(community.id, 'john');

      expect(result).toBeDefined();
      expect(result).toHaveLength(1);
    });

    it('should use custom limit parameter', async () => {
      const community = CommunityFactory.build();
      mockDatabase.membership.findMany.mockResolvedValue([]);

      await service.searchMembers(community.id, 'test', 5);

      expect(mockDatabase.membership.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 5,
        }),
      );
    });

    it('should return empty array when no members match', async () => {
      const community = CommunityFactory.build();
      mockDatabase.membership.findMany.mockResolvedValue([]);

      const result = await service.searchMembers(community.id, 'nomatch');

      expect(result).toEqual([]);
    });

    it('should order results by username ascending', async () => {
      const community = CommunityFactory.build();
      mockDatabase.membership.findMany.mockResolvedValue([]);

      await service.searchMembers(community.id, 'test');

      expect(mockDatabase.membership.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: {
            user: {
              username: 'asc',
            },
          },
        }),
      );
    });

    it('should rethrow errors', async () => {
      const community = CommunityFactory.build();
      mockDatabase.membership.findMany.mockRejectedValue(
        new Error('Database error'),
      );

      await expect(service.searchMembers(community.id, 'test')).rejects.toThrow(
        'Database error',
      );
    });
  });
});
