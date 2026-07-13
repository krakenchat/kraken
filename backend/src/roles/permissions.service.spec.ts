import { TestBed } from '@suites/unit';
import type { Mocked } from '@suites/doubles.jest';
import { PermissionsService } from './permissions.service';
import { DatabaseService } from '@/database/database.service';
import { PermissionsCacheService } from './permissions-cache.service';
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

describe('PermissionsService', () => {
  let service: PermissionsService;
  let mockDatabase: ReturnType<typeof createMockDatabase>;
  let permissionsCacheService: Mocked<PermissionsCacheService>;

  beforeEach(async () => {
    mockDatabase = createMockDatabase();

    const { unit, unitRef } = await TestBed.solitary(PermissionsService)
      .mock(DatabaseService)
      .final(mockDatabase)
      .compile();

    service = unit;
    permissionsCacheService = unitRef.get(PermissionsCacheService);

    // Default: cache unavailable, so every existing test below exercises the
    // DB path exactly as before. Cache-specific behavior (hit short-circuit,
    // miss populate) is covered in its own describe block further down.
    permissionsCacheService.getCachedActions.mockResolvedValue({
      status: 'unavailable',
    });
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
      it('should verify permissions for public channel by finding community', async () => {
        const user = UserFactory.build();
        const channel = ChannelFactory.build({ isPrivate: false });
        const role = RoleFactory.buildModerator();

        mockDatabase.channel.findUnique.mockResolvedValue({
          id: channel.id,
          communityId: channel.communityId,
          isPrivate: false,
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
          select: { communityId: true, isPrivate: true },
        });
      });

      it('should allow access to private channel when user has channel membership', async () => {
        const user = UserFactory.build();
        const channel = ChannelFactory.build({ isPrivate: true });
        const role = RoleFactory.buildMember();

        mockDatabase.channel.findUnique.mockResolvedValue({
          id: channel.id,
          communityId: channel.communityId,
          isPrivate: true,
        });

        mockDatabase.channelMembership.findUnique.mockResolvedValue({
          userId: user.id,
          channelId: channel.id,
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
          [RbacActions.READ_MESSAGE],
        );

        expect(result).toBe(true);
        expect(mockDatabase.channelMembership.findUnique).toHaveBeenCalledWith({
          where: {
            userId_channelId: { userId: user.id, channelId: channel.id },
          },
        });
      });

      it('should deny access to private channel when user lacks channel membership', async () => {
        const user = UserFactory.build();
        const channel = ChannelFactory.build({ isPrivate: true });

        mockDatabase.channel.findUnique.mockResolvedValue({
          id: channel.id,
          communityId: channel.communityId,
          isPrivate: true,
        });

        mockDatabase.channelMembership.findUnique.mockResolvedValue(null);

        const result = await service.verifyActionsForUserAndResource(
          user.id,
          channel.id,
          RbacResourceType.CHANNEL,
          [RbacActions.READ_MESSAGE],
        );

        expect(result).toBe(false);
        expect(mockDatabase.userRoles.findMany).not.toHaveBeenCalled();
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
      it('should verify permissions for message in public channel', async () => {
        const user = UserFactory.build();
        const message = MessageFactory.build();
        const channel = ChannelFactory.build({
          id: message.channelId!,
          isPrivate: false,
        });
        const role = RoleFactory.buildMember();

        mockDatabase.message.findUnique.mockResolvedValue({
          id: message.id,
          channelId: channel.id,
          directMessageGroupId: null,
          channel: {
            communityId: channel.communityId,
            isPrivate: false,
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

      it('should allow access to message in private channel when user has channel membership', async () => {
        const user = UserFactory.build();
        const message = MessageFactory.build();
        const channel = ChannelFactory.build({
          id: message.channelId!,
          isPrivate: true,
        });
        const role = RoleFactory.buildMember();

        mockDatabase.message.findUnique.mockResolvedValue({
          id: message.id,
          channelId: channel.id,
          directMessageGroupId: null,
          channel: {
            communityId: channel.communityId,
            isPrivate: true,
          },
        });

        mockDatabase.channelMembership.findUnique.mockResolvedValue({
          userId: user.id,
          channelId: channel.id,
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
        expect(mockDatabase.channelMembership.findUnique).toHaveBeenCalledWith({
          where: {
            userId_channelId: { userId: user.id, channelId: channel.id },
          },
        });
      });

      it('should deny access to message in private channel when user lacks channel membership', async () => {
        const user = UserFactory.build();
        const message = MessageFactory.build();
        const channel = ChannelFactory.build({
          id: message.channelId!,
          isPrivate: true,
        });

        mockDatabase.message.findUnique.mockResolvedValue({
          id: message.id,
          channelId: channel.id,
          directMessageGroupId: null,
          channel: {
            communityId: channel.communityId,
            isPrivate: true,
          },
        });

        mockDatabase.channelMembership.findUnique.mockResolvedValue(null);

        const result = await service.verifyActionsForUserAndResource(
          user.id,
          message.id,
          RbacResourceType.MESSAGE,
          [RbacActions.READ_MESSAGE],
        );

        expect(result).toBe(false);
        expect(mockDatabase.userRoles.findMany).not.toHaveBeenCalled();
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

    describe('ALIAS_GROUP resource type', () => {
      it('should resolve community from alias group and verify roles there', async () => {
        const user = UserFactory.build();
        const community = CommunityFactory.build();
        const role = RoleFactory.buildAdmin();

        mockDatabase.aliasGroup.findUnique.mockResolvedValue({
          communityId: community.id,
        });
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
          'alias-group-123',
          RbacResourceType.ALIAS_GROUP,
          [RbacActions.UPDATE_COMMUNITY],
        );

        expect(result).toBe(true);
        expect(mockDatabase.aliasGroup.findUnique).toHaveBeenCalledWith({
          where: { id: 'alias-group-123' },
          select: { communityId: true },
        });
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

      it('should deny access when alias group does not exist', async () => {
        mockDatabase.aliasGroup.findUnique.mockResolvedValue(null);

        const result = await service.verifyActionsForUserAndResource(
          'user-id',
          'missing-alias-group',
          RbacResourceType.ALIAS_GROUP,
          [RbacActions.UPDATE_COMMUNITY],
        );

        expect(result).toBe(false);
        expect(mockDatabase.userRoles.findMany).not.toHaveBeenCalled();
      });
    });

    describe('Unknown resource type', () => {
      it('should deny access for unknown resource type', async () => {
        const result = await service.verifyActionsForUserAndResource(
          'user-id',
          'resource-id',

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

    describe('Permission cache integration', () => {
      it('short-circuits the DB findMany on a cache hit (instance scope)', async () => {
        const user = UserFactory.build();
        permissionsCacheService.getCachedActions.mockResolvedValue({
          status: 'hit',
          actions: [RbacActions.CREATE_COMMUNITY],
        });

        const result = await service.verifyActionsForUserAndResource(
          user.id,
          undefined,
          undefined,
          [RbacActions.CREATE_COMMUNITY],
        );

        expect(result).toBe(true);
        expect(mockDatabase.userRoles.findMany).not.toHaveBeenCalled();
        expect(permissionsCacheService.getCachedActions).toHaveBeenCalledWith(
          user.id,
          { kind: 'instance' },
        );
        expect(permissionsCacheService.setCachedActions).not.toHaveBeenCalled();
      });

      it('short-circuits the DB findMany on a cache hit (community scope)', async () => {
        const user = UserFactory.build();
        const community = CommunityFactory.build();
        permissionsCacheService.getCachedActions.mockResolvedValue({
          status: 'hit',
          actions: [RbacActions.DELETE_CHANNEL],
        });

        const result = await service.verifyActionsForUserAndResource(
          user.id,
          community.id,
          RbacResourceType.COMMUNITY,
          [RbacActions.DELETE_CHANNEL],
        );

        expect(result).toBe(true);
        expect(mockDatabase.userRoles.findMany).not.toHaveBeenCalled();
        expect(permissionsCacheService.getCachedActions).toHaveBeenCalledWith(
          user.id,
          { kind: 'community', communityId: community.id },
        );
      });

      it('queries the DB and populates the cache with miss-time epochs on a miss', async () => {
        const user = UserFactory.build();
        const community = CommunityFactory.build();
        const role = RoleFactory.buildAdmin();
        const epochs = { userEpoch: 3, scopeEpoch: 7 };

        permissionsCacheService.getCachedActions.mockResolvedValue({
          status: 'miss',
          epochs,
        });
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
        expect(mockDatabase.userRoles.findMany).toHaveBeenCalled();
        expect(permissionsCacheService.setCachedActions).toHaveBeenCalledWith(
          user.id,
          { kind: 'community', communityId: community.id },
          epochs,
          role.actions,
        );
      });

      it('queries the DB but does not attempt to populate the cache when unavailable', async () => {
        const user = UserFactory.build();
        const role = RoleFactory.buildAdmin();

        permissionsCacheService.getCachedActions.mockResolvedValue({
          status: 'unavailable',
        });
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
        expect(mockDatabase.userRoles.findMany).toHaveBeenCalled();
        expect(permissionsCacheService.setCachedActions).not.toHaveBeenCalled();
      });

      it('uncached membership/resource-resolution checks always hit the DB regardless of cache state', async () => {
        const user = UserFactory.build();
        const channel = ChannelFactory.build({ isPrivate: true });
        const role = RoleFactory.buildMember();
        permissionsCacheService.getCachedActions.mockResolvedValue({
          status: 'hit',
          actions: role.actions,
        });

        mockDatabase.channel.findUnique.mockResolvedValue({
          id: channel.id,
          communityId: channel.communityId,
          isPrivate: true,
        });
        mockDatabase.channelMembership.findUnique.mockResolvedValue({
          userId: user.id,
          channelId: channel.id,
        });

        const result = await service.verifyActionsForUserAndResource(
          user.id,
          channel.id,
          RbacResourceType.CHANNEL,
          [RbacActions.READ_MESSAGE],
        );

        expect(result).toBe(true);
        // Channel resolution and private-channel membership are never cached.
        expect(mockDatabase.channel.findUnique).toHaveBeenCalled();
        expect(mockDatabase.channelMembership.findUnique).toHaveBeenCalled();
        // The role lookup itself did come from cache.
        expect(mockDatabase.userRoles.findMany).not.toHaveBeenCalled();
      });
    });
  });
});
