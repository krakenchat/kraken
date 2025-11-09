import { Test, TestingModule } from '@nestjs/testing';
import { RolesService } from './roles.service';
import { DatabaseService } from '@/database/database.service';
import { RbacResourceType } from '@/auth/rbac-resource.decorator';
import { RbacActions } from '@prisma/client';
import {
  createMockDatabase,
  UserFactory,
  RoleFactory,
  ChannelFactory,
  MessageFactory,
  CommunityFactory,
} from '@/test-utils';
import {
  BadRequestException,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';

describe('RolesService', () => {
  let service: RolesService;
  let mockDatabase: ReturnType<typeof createMockDatabase>;

  beforeEach(async () => {
    mockDatabase = createMockDatabase();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RolesService,
        {
          provide: DatabaseService,
          useValue: mockDatabase,
        },
      ],
    }).compile();

    service = module.get<RolesService>(RolesService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('verifyActionsForUserAndResource', () => {
    describe('Instance-level permissions', () => {
      it('should verify instance-level permissions when no resourceId provided', async () => {
        const user = UserFactory.build();
        const role = RoleFactory.buildAdmin();

        mockDatabase.userRoles.findMany.mockResolvedValue([
          {
            userId: user.id,
            roleId: role.id,
            isInstanceRole: true,
            role,
          },
        ]);

        const result = await service.verifyActionsForUserAndResource(
          user.id,
          undefined,
          undefined,
          [RbacActions.CREATE_COMMUNITY],
        );

        expect(result).toBe(true);
        expect(mockDatabase.userRoles.findMany).toHaveBeenCalledWith({
          where: {
            userId: user.id,
            isInstanceRole: true,
          },
          include: {
            role: true,
          },
        });
      });

      it('should verify instance-level permissions when resourceType is INSTANCE', async () => {
        const user = UserFactory.build();
        const role = RoleFactory.buildAdmin();

        mockDatabase.userRoles.findMany.mockResolvedValue([
          {
            userId: user.id,
            roleId: role.id,
            isInstanceRole: true,
            role,
          },
        ]);

        const result = await service.verifyActionsForUserAndResource(
          user.id,
          'some-id',
          RbacResourceType.INSTANCE,
          [RbacActions.DELETE_USER],
        );

        expect(result).toBe(true);
      });

      it('should deny when user lacks required instance actions', async () => {
        const user = UserFactory.build();
        const role = RoleFactory.buildMember();

        mockDatabase.userRoles.findMany.mockResolvedValue([
          {
            userId: user.id,
            roleId: role.id,
            isInstanceRole: true,
            role,
          },
        ]);

        const result = await service.verifyActionsForUserAndResource(
          user.id,
          undefined,
          undefined,
          [RbacActions.DELETE_USER],
        );

        expect(result).toBe(false);
      });
    });

    describe('Community resource type', () => {
      it('should verify permissions for community resource', async () => {
        const user = UserFactory.build();
        const community = CommunityFactory.build();
        const role = RoleFactory.buildAdmin();

        mockDatabase.userRoles.findMany.mockResolvedValue([
          {
            userId: user.id,
            communityId: community.id,
            roleId: role.id,
            isInstanceRole: false,
            role,
          },
        ]);

        const result = await service.verifyActionsForUserAndResource(
          user.id,
          community.id,
          RbacResourceType.COMMUNITY,
          [RbacActions.DELETE_CHANNEL],
        );

        expect(result).toBe(true);
        expect(mockDatabase.userRoles.findMany).toHaveBeenCalledWith({
          where: {
            userId: user.id,
            communityId: community.id,
            isInstanceRole: false,
          },
          include: {
            role: true,
          },
        });
      });
    });

    describe('Channel resource type', () => {
      it('should verify permissions for channel by finding community', async () => {
        const user = UserFactory.build();
        const channel = ChannelFactory.build();
        const role = RoleFactory.buildModerator();

        mockDatabase.channel.findUnique.mockResolvedValue({
          id: channel.id,
          communityId: channel.communityId,
        });

        mockDatabase.userRoles.findMany.mockResolvedValue([
          {
            userId: user.id,
            communityId: channel.communityId,
            roleId: role.id,
            isInstanceRole: false,
            role,
          },
        ]);

        const result = await service.verifyActionsForUserAndResource(
          user.id,
          channel.id,
          RbacResourceType.CHANNEL,
          [RbacActions.DELETE_MESSAGE],
        );

        expect(result).toBe(true);
        expect(mockDatabase.channel.findUnique).toHaveBeenCalledWith({
          where: { id: channel.id },
          select: { communityId: true },
        });
      });

      it('should deny when channel not found', async () => {
        const user = UserFactory.build();
        const channelId = 'nonexistent-channel';

        mockDatabase.channel.findUnique.mockResolvedValue(null);

        const result = await service.verifyActionsForUserAndResource(
          user.id,
          channelId,
          RbacResourceType.CHANNEL,
          [RbacActions.READ_CHANNEL],
        );

        expect(result).toBe(false);
      });
    });

    describe('Message resource type', () => {
      it('should verify permissions for message by finding channel and community', async () => {
        const user = UserFactory.build();
        const message = MessageFactory.build();
        const channel = ChannelFactory.build({ id: message.channelId! });
        const role = RoleFactory.buildMember();

        mockDatabase.message.findUnique.mockResolvedValue({
          id: message.id,
          channelId: channel.id,
          directMessageGroupId: null,
          channel: {
            communityId: channel.communityId,
          },
        });

        mockDatabase.userRoles.findMany.mockResolvedValue([
          {
            userId: user.id,
            communityId: channel.communityId,
            roleId: role.id,
            isInstanceRole: false,
            role,
          },
        ]);

        const result = await service.verifyActionsForUserAndResource(
          user.id,
          message.id,
          RbacResourceType.MESSAGE,
          [RbacActions.READ_MESSAGE],
        );

        expect(result).toBe(true);
      });

      it('should grant access to DM message when user is member', async () => {
        const user = UserFactory.build();
        const dmMessage = MessageFactory.buildDirectMessage();

        mockDatabase.message.findUnique.mockResolvedValue({
          id: dmMessage.id,
          channelId: null,
          directMessageGroupId: dmMessage.directMessageGroupId,
          channel: null,
        });

        mockDatabase.directMessageGroupMember.findFirst.mockResolvedValue({
          userId: user.id,
          groupId: dmMessage.directMessageGroupId,
        });

        const result = await service.verifyActionsForUserAndResource(
          user.id,
          dmMessage.id,
          RbacResourceType.MESSAGE,
          [RbacActions.READ_MESSAGE],
        );

        expect(result).toBe(true);
        expect(
          mockDatabase.directMessageGroupMember.findFirst,
        ).toHaveBeenCalledWith({
          where: {
            userId: user.id,
            groupId: dmMessage.directMessageGroupId,
          },
        });
      });

      it('should deny access to DM message when user is not member', async () => {
        const user = UserFactory.build();
        const dmMessage = MessageFactory.buildDirectMessage();

        mockDatabase.message.findUnique.mockResolvedValue({
          id: dmMessage.id,
          channelId: null,
          directMessageGroupId: dmMessage.directMessageGroupId,
          channel: null,
        });

        mockDatabase.directMessageGroupMember.findFirst.mockResolvedValue(null);

        const result = await service.verifyActionsForUserAndResource(
          user.id,
          dmMessage.id,
          RbacResourceType.MESSAGE,
          [RbacActions.READ_MESSAGE],
        );

        expect(result).toBe(false);
      });

      it('should deny when message not found', async () => {
        mockDatabase.message.findUnique.mockResolvedValue(null);

        const result = await service.verifyActionsForUserAndResource(
          'user-id',
          'nonexistent-message',
          RbacResourceType.MESSAGE,
          [RbacActions.READ_MESSAGE],
        );

        expect(result).toBe(false);
      });

      it('should deny when message has no associated channel', async () => {
        mockDatabase.message.findUnique.mockResolvedValue({
          id: 'msg-id',
          channelId: 'ch-id',
          directMessageGroupId: null,
          channel: null,
        });

        const result = await service.verifyActionsForUserAndResource(
          'user-id',
          'msg-id',
          RbacResourceType.MESSAGE,
          [RbacActions.READ_MESSAGE],
        );

        expect(result).toBe(false);
      });
    });

    describe('DM_GROUP resource type', () => {
      it('should grant access when user is member of DM group', async () => {
        const user = UserFactory.build();
        const groupId = 'dm-group-123';

        mockDatabase.directMessageGroupMember.findFirst.mockResolvedValue({
          userId: user.id,
          groupId,
        });

        const result = await service.verifyActionsForUserAndResource(
          user.id,
          groupId,
          RbacResourceType.DM_GROUP,
          [RbacActions.CREATE_MESSAGE],
        );

        expect(result).toBe(true);
      });

      it('should deny access when user is not member of DM group', async () => {
        const user = UserFactory.build();
        const groupId = 'dm-group-123';

        mockDatabase.directMessageGroupMember.findFirst.mockResolvedValue(null);

        const result = await service.verifyActionsForUserAndResource(
          user.id,
          groupId,
          RbacResourceType.DM_GROUP,
          [RbacActions.CREATE_MESSAGE],
        );

        expect(result).toBe(false);
      });
    });

    describe('Unknown resource type', () => {
      it('should deny access for unknown resource type', async () => {
        const result = await service.verifyActionsForUserAndResource(
          'user-id',
          'resource-id',
          // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
          'UNKNOWN' as any,
          [RbacActions.READ_MESSAGE],
        );

        expect(result).toBe(false);
      });
    });

    describe('Multiple actions verification', () => {
      it('should verify all actions are present', async () => {
        const user = UserFactory.build();
        const community = CommunityFactory.build();
        const role = RoleFactory.buildAdmin();

        mockDatabase.userRoles.findMany.mockResolvedValue([
          {
            userId: user.id,
            communityId: community.id,
            roleId: role.id,
            isInstanceRole: false,
            role,
          },
        ]);

        const result = await service.verifyActionsForUserAndResource(
          user.id,
          community.id,
          RbacResourceType.COMMUNITY,
          [
            RbacActions.CREATE_MESSAGE,
            RbacActions.DELETE_MESSAGE,
            RbacActions.READ_CHANNEL,
          ],
        );

        expect(result).toBe(true);
      });

      it('should deny when one action is missing', async () => {
        const user = UserFactory.build();
        const community = CommunityFactory.build();
        const role = RoleFactory.buildMember();

        mockDatabase.userRoles.findMany.mockResolvedValue([
          {
            userId: user.id,
            communityId: community.id,
            roleId: role.id,
            isInstanceRole: false,
            role,
          },
        ]);

        const result = await service.verifyActionsForUserAndResource(
          user.id,
          community.id,
          RbacResourceType.COMMUNITY,
          [RbacActions.CREATE_MESSAGE, RbacActions.DELETE_COMMUNITY],
        );

        expect(result).toBe(false);
      });
    });
  });

  describe('getUserRolesForCommunity', () => {
    it('should return user roles for community', async () => {
      const user = UserFactory.build();
      const community = CommunityFactory.build();
      const role = RoleFactory.buildMember();

      mockDatabase.userRoles.findMany.mockResolvedValue([
        {
          userId: user.id,
          communityId: community.id,
          roleId: role.id,
          isInstanceRole: false,
          role,
        },
      ]);

      const result = await service.getUserRolesForCommunity(
        user.id,
        community.id,
      );

      expect(result).toEqual({
        userId: user.id,
        resourceId: community.id,
        resourceType: 'COMMUNITY',
        roles: [
          {
            id: role.id,
            name: role.name,
            actions: role.actions,
            createdAt: role.createdAt,
          },
        ],
      });
    });
  });

  describe('getUserRolesForChannel', () => {
    it('should return user roles for channel via community', async () => {
      const user = UserFactory.build();
      const channel = ChannelFactory.build();
      const role = RoleFactory.buildModerator();

      mockDatabase.channel.findUnique.mockResolvedValue({
        id: channel.id,
        communityId: channel.communityId,
      });

      mockDatabase.userRoles.findMany.mockResolvedValue([
        {
          userId: user.id,
          communityId: channel.communityId,
          roleId: role.id,
          isInstanceRole: false,
          role,
        },
      ]);

      const result = await service.getUserRolesForChannel(user.id, channel.id);

      expect(result.roles).toHaveLength(1);
      expect(result.resourceType).toBe('CHANNEL');
    });

    it('should return empty roles when channel not found', async () => {
      mockDatabase.channel.findUnique.mockResolvedValue(null);

      const result = await service.getUserRolesForChannel(
        'user-id',
        'channel-id',
      );

      expect(result.roles).toEqual([]);
    });
  });

  describe('getUserInstanceRoles', () => {
    it('should return instance roles for user', async () => {
      const user = UserFactory.build();
      const role = RoleFactory.buildAdmin();

      mockDatabase.userRoles.findMany.mockResolvedValue([
        {
          userId: user.id,
          roleId: role.id,
          isInstanceRole: true,
          role,
        },
      ]);

      const result = await service.getUserInstanceRoles(user.id);

      expect(result.resourceType).toBe('INSTANCE');
      expect(result.resourceId).toBeNull();
      expect(result.roles).toHaveLength(1);
    });
  });

  describe('createDefaultCommunityRoles', () => {
    it('should create default roles and return admin role ID', async () => {
      const communityId = 'community-123';
      const adminRole = RoleFactory.build({
        name: 'Community Admin - ' + communityId,
      });

      mockDatabase.role.create
        .mockResolvedValueOnce(adminRole)
        .mockResolvedValueOnce(RoleFactory.build())
        .mockResolvedValueOnce(RoleFactory.build());

      const adminRoleId =
        await service.createDefaultCommunityRoles(communityId);

      expect(adminRoleId).toBe(adminRole.id);
      expect(mockDatabase.role.create).toHaveBeenCalledTimes(3);
    });

    it('should use transaction when provided', async () => {
      const mockTx = createMockDatabase();
      const communityId = 'community-123';

      mockTx.role.create.mockResolvedValue(RoleFactory.build());

      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
      await service.createDefaultCommunityRoles(communityId, mockTx as any);

      expect(mockTx.role.create).toHaveBeenCalled();
      expect(mockDatabase.role.create).not.toHaveBeenCalled();
    });
  });

  describe('assignUserToCommunityRole', () => {
    it('should assign user to community role', async () => {
      const userId = 'user-123';
      const communityId = 'community-123';
      const roleId = 'role-123';

      mockDatabase.userRoles.create.mockResolvedValue({});

      await service.assignUserToCommunityRole(userId, communityId, roleId);

      expect(mockDatabase.userRoles.create).toHaveBeenCalledWith({
        data: {
          userId,
          communityId,
          roleId,
          isInstanceRole: false,
        },
      });
    });
  });

  describe('getCommunityAdminRole', () => {
    it('should return admin role for community', async () => {
      const communityId = 'community-123';
      const adminRole = RoleFactory.buildAdmin({
        name: `Community Admin - ${communityId}`,
      });

      mockDatabase.role.findFirst.mockResolvedValue(adminRole);

      const result = await service.getCommunityAdminRole(communityId);

      expect(result).toBeTruthy();
      expect(result?.name).toBe(adminRole.name);
    });

    it('should return null when admin role not found', async () => {
      mockDatabase.role.findFirst.mockResolvedValue(null);

      const result = await service.getCommunityAdminRole('community-123');

      expect(result).toBeNull();
    });
  });

  describe('createCommunityRole', () => {
    it('should create custom community role', async () => {
      const communityId = 'community-123';
      const createRoleDto = {
        name: 'Custom Role',
        actions: [RbacActions.CREATE_MESSAGE, RbacActions.READ_MESSAGE],
      };
      const createdRole = RoleFactory.build({
        name: `Custom Role - ${communityId}`,
        actions: createRoleDto.actions,
      });

      mockDatabase.role.findUnique.mockResolvedValue(null);
      mockDatabase.role.create.mockResolvedValue(createdRole);

      const result = await service.createCommunityRole(
        communityId,
        createRoleDto,
      );

      expect(result.name).toBe('Custom Role');
      expect(result.actions).toEqual(createRoleDto.actions);
    });

    it('should throw ConflictException when role name already exists', async () => {
      const communityId = 'community-123';
      const createRoleDto = {
        name: 'Existing Role',
        actions: [RbacActions.CREATE_MESSAGE],
      };

      mockDatabase.role.findUnique.mockResolvedValue(RoleFactory.build());

      await expect(
        service.createCommunityRole(communityId, createRoleDto),
      ).rejects.toThrow(ConflictException);
    });

    it('should throw BadRequestException for invalid actions', async () => {
      const communityId = 'community-123';
      const createRoleDto = {
        name: 'Invalid Role',

        actions: ['INVALID_ACTION' as any],
      };

      mockDatabase.role.findUnique.mockResolvedValue(null);

      await expect(
        service.createCommunityRole(communityId, createRoleDto),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('updateRole', () => {
    it('should update role actions', async () => {
      const roleId = 'role-123';
      const existingRole = RoleFactory.build({
        name: 'Custom Role - community-123',
      });
      const updateDto = {
        actions: [RbacActions.READ_MESSAGE, RbacActions.CREATE_MESSAGE],
      };
      const updatedRole = { ...existingRole, actions: updateDto.actions };

      mockDatabase.role.findUnique.mockResolvedValue(existingRole);
      mockDatabase.role.update.mockResolvedValue(updatedRole);

      const result = await service.updateRole(roleId, updateDto);

      expect(result.actions).toEqual(updateDto.actions);
    });

    it('should throw NotFoundException when role not found', async () => {
      mockDatabase.role.findUnique.mockResolvedValue(null);

      await expect(service.updateRole('nonexistent', {})).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should prevent renaming default roles', async () => {
      const existingRole = RoleFactory.build({
        name: 'Community Admin - community-123',
      });

      mockDatabase.role.findUnique.mockResolvedValue(existingRole);

      await expect(
        service.updateRole(existingRole.id, { name: 'New Name' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should allow changing permissions of default roles', async () => {
      const existingRole = RoleFactory.build({
        name: 'Member - community-123',
      });
      const updateDto = { actions: [RbacActions.READ_MESSAGE] };

      mockDatabase.role.findUnique.mockResolvedValue(existingRole);
      mockDatabase.role.update.mockResolvedValue({
        ...existingRole,
        actions: updateDto.actions,
      });

      const result = await service.updateRole(existingRole.id, updateDto);

      expect(result.actions).toEqual(updateDto.actions);
    });
  });

  describe('deleteRole', () => {
    it('should delete custom role', async () => {
      const roleId = 'role-123';
      const customRole = RoleFactory.build({
        name: 'Custom Role - community-123',
      });

      mockDatabase.role.findUnique.mockResolvedValue({
        ...customRole,
        UserRoles: [],
      });
      mockDatabase.role.delete.mockResolvedValue(customRole);

      await service.deleteRole(roleId);

      expect(mockDatabase.role.delete).toHaveBeenCalledWith({
        where: { id: roleId },
      });
    });

    it('should throw NotFoundException when role not found', async () => {
      mockDatabase.role.findUnique.mockResolvedValue(null);

      await expect(service.deleteRole('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw BadRequestException for default roles', async () => {
      const defaultRole = RoleFactory.build({
        name: 'Community Admin - community-123',
      });

      mockDatabase.role.findUnique.mockResolvedValue({
        ...defaultRole,
        UserRoles: [],
      });

      await expect(service.deleteRole(defaultRole.id)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException when role is assigned to users', async () => {
      const role = RoleFactory.build({ name: 'Custom Role - community-123' });

      mockDatabase.role.findUnique.mockResolvedValue({
        ...role,
        UserRoles: [{ id: 'user-role-1' }, { id: 'user-role-2' }],
      });

      await expect(service.deleteRole(role.id)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('removeUserFromCommunityRole', () => {
    it('should remove user from community role', async () => {
      const userId = 'user-123';
      const communityId = 'community-123';
      const roleId = 'role-123';
      const userRole = { id: 'user-role-1', userId, communityId, roleId };

      mockDatabase.userRoles.findFirst.mockResolvedValue(userRole);
      mockDatabase.userRoles.delete.mockResolvedValue(userRole);

      await service.removeUserFromCommunityRole(userId, communityId, roleId);

      expect(mockDatabase.userRoles.delete).toHaveBeenCalledWith({
        where: { id: userRole.id },
      });
    });

    it('should throw NotFoundException when assignment not found', async () => {
      mockDatabase.userRoles.findFirst.mockResolvedValue(null);

      await expect(
        service.removeUserFromCommunityRole(
          'user-id',
          'community-id',
          'role-id',
        ),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('getUsersForRole', () => {
    it('should return users assigned to role', async () => {
      const roleId = 'role-123';
      const communityId = 'community-123';
      const users = [
        UserFactory.build({ username: 'user1' }),
        UserFactory.build({ username: 'user2' }),
      ];

      mockDatabase.userRoles.findMany.mockResolvedValue([
        { userId: users[0].id, user: users[0] },
        { userId: users[1].id, user: users[1] },
      ]);

      const result = await service.getUsersForRole(roleId, communityId);

      expect(result).toHaveLength(2);
      expect(result[0].username).toBe('user1');
      expect(result[1].username).toBe('user2');
    });
  });
});
