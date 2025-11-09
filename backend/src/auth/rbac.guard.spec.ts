import { Test, TestingModule } from '@nestjs/testing';
import { RbacGuard } from './rbac.guard';
import { RolesService } from '@/roles/roles.service';
import { Reflector } from '@nestjs/core';
import { RbacActions, InstanceRole } from '@prisma/client';
import {
  UserFactory,
  createMockHttpExecutionContext,
  createMockWsExecutionContext,
} from '@/test-utils';
import { ResourceIdSource, RbacResourceType } from './rbac-resource.decorator';

describe('RbacGuard', () => {
  let guard: RbacGuard;
  let rolesService: RolesService;
  let reflector: Reflector;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RbacGuard,
        {
          provide: RolesService,
          useValue: {
            verifyActionsForUserAndResource: jest.fn(),
          },
        },
        {
          provide: Reflector,
          useValue: {
            getAllAndOverride: jest.fn(),
          },
        },
      ],
    }).compile();

    guard = module.get<RbacGuard>(RbacGuard);
    rolesService = module.get<RolesService>(RolesService);
    reflector = module.get<Reflector>(Reflector);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('No RBAC actions required', () => {
    it('should allow access when no RBAC actions are required', async () => {
      const user = UserFactory.build();
      const context = createMockHttpExecutionContext({ user });

      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue([]);

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
      expect(
        rolesService.verifyActionsForUserAndResource,
      ).not.toHaveBeenCalled();
    });
  });

  describe('Owner bypass', () => {
    it('should bypass RBAC check for instance owners', async () => {
      const owner = UserFactory.buildOwner();
      const context = createMockHttpExecutionContext({ user: owner });

      jest
        .spyOn(reflector, 'getAllAndOverride')
        .mockReturnValueOnce([RbacActions.DELETE_MESSAGE]) // Required actions
        .mockReturnValueOnce(undefined); // No resource options

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
      expect(
        rolesService.verifyActionsForUserAndResource,
      ).not.toHaveBeenCalled();
    });

    it('should not bypass for non-owner users', async () => {
      const user = UserFactory.build({ role: InstanceRole.USER });
      const context = createMockHttpExecutionContext({ user });

      jest
        .spyOn(reflector, 'getAllAndOverride')
        .mockReturnValueOnce([RbacActions.CREATE_MESSAGE])
        .mockReturnValueOnce(undefined);

      jest
        .spyOn(rolesService, 'verifyActionsForUserAndResource')
        .mockResolvedValue(true);

      await guard.canActivate(context);

      expect(rolesService.verifyActionsForUserAndResource).toHaveBeenCalled();
    });
  });

  describe('No user authenticated', () => {
    it('should deny access when no user is authenticated', async () => {
      // Create context with explicit null user in request

      const mockContext = {
        switchToHttp: jest.fn().mockReturnValue({
          getRequest: jest.fn().mockReturnValue({ user: undefined }),
        }),
        getType: jest.fn().mockReturnValue('http'),
        getHandler: jest.fn(),
        getClass: jest.fn(),
      } as any;

      jest
        .spyOn(reflector, 'getAllAndOverride')
        .mockReturnValueOnce([RbacActions.READ_MESSAGE])
        .mockReturnValueOnce(undefined);

      const result = await guard.canActivate(mockContext);

      expect(result).toBe(false);
      expect(
        rolesService.verifyActionsForUserAndResource,
      ).not.toHaveBeenCalled();
    });
  });

  describe('HTTP context - Resource ID extraction', () => {
    it('should extract resource ID from request body', async () => {
      const user = UserFactory.build();
      const channelId = 'channel-123';
      const context = createMockHttpExecutionContext({
        user,
        body: { channelId },
      });

      jest
        .spyOn(reflector, 'getAllAndOverride')
        .mockReturnValueOnce([RbacActions.CREATE_MESSAGE])
        .mockReturnValueOnce({
          type: RbacResourceType.CHANNEL,
          idKey: 'channelId',
          source: ResourceIdSource.BODY,
        });

      jest
        .spyOn(rolesService, 'verifyActionsForUserAndResource')
        .mockResolvedValue(true);

      await guard.canActivate(context);

      expect(rolesService.verifyActionsForUserAndResource).toHaveBeenCalledWith(
        user.id,
        channelId,
        RbacResourceType.CHANNEL,
        [RbacActions.CREATE_MESSAGE],
      );
    });

    it('should extract resource ID from request params', async () => {
      const user = UserFactory.build();
      const messageId = 'msg-456';
      const context = createMockHttpExecutionContext({
        user,
        params: { messageId },
      });

      jest
        .spyOn(reflector, 'getAllAndOverride')
        .mockReturnValueOnce([RbacActions.DELETE_MESSAGE])
        .mockReturnValueOnce({
          type: RbacResourceType.MESSAGE,
          idKey: 'messageId',
          source: ResourceIdSource.PARAM,
        });

      jest
        .spyOn(rolesService, 'verifyActionsForUserAndResource')
        .mockResolvedValue(true);

      await guard.canActivate(context);

      expect(rolesService.verifyActionsForUserAndResource).toHaveBeenCalledWith(
        user.id,
        messageId,
        RbacResourceType.MESSAGE,
        [RbacActions.DELETE_MESSAGE],
      );
    });

    it('should extract resource ID from query parameters', async () => {
      const user = UserFactory.build();
      const communityId = 'comm-789';
      const context = createMockHttpExecutionContext({
        user,
        query: { communityId },
      });

      jest
        .spyOn(reflector, 'getAllAndOverride')
        .mockReturnValueOnce([RbacActions.READ_COMMUNITY])
        .mockReturnValueOnce({
          type: RbacResourceType.COMMUNITY,
          idKey: 'communityId',
          source: ResourceIdSource.QUERY,
        });

      jest
        .spyOn(rolesService, 'verifyActionsForUserAndResource')
        .mockResolvedValue(true);

      await guard.canActivate(context);

      expect(rolesService.verifyActionsForUserAndResource).toHaveBeenCalledWith(
        user.id,
        communityId,
        RbacResourceType.COMMUNITY,
        [RbacActions.READ_COMMUNITY],
      );
    });
  });

  describe('WebSocket context', () => {
    it('should extract user from WebSocket handshake', async () => {
      const user = UserFactory.build();
      const client = {
        id: 'socket-123',
        handshake: { user },
      };
      const context = createMockWsExecutionContext({ user, client });

      jest
        .spyOn(reflector, 'getAllAndOverride')
        .mockReturnValueOnce([RbacActions.CREATE_MESSAGE])
        .mockReturnValueOnce(undefined);

      jest
        .spyOn(rolesService, 'verifyActionsForUserAndResource')
        .mockResolvedValue(true);

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
    });

    it('should extract resource ID from WebSocket payload', async () => {
      const user = UserFactory.build();
      const channelId = 'channel-ws-123';
      const client = {
        id: 'socket-456',
        handshake: { user },
      };
      const data = { channelId, content: 'Hello' };

      const context = createMockWsExecutionContext({
        user,
        client,
        data,
      });

      jest
        .spyOn(reflector, 'getAllAndOverride')
        .mockReturnValueOnce([RbacActions.CREATE_MESSAGE])
        .mockReturnValueOnce({
          type: RbacResourceType.CHANNEL,
          idKey: 'channelId',
          source: ResourceIdSource.PAYLOAD,
        });

      jest
        .spyOn(rolesService, 'verifyActionsForUserAndResource')
        .mockResolvedValue(true);

      await guard.canActivate(context);

      expect(rolesService.verifyActionsForUserAndResource).toHaveBeenCalledWith(
        user.id,
        channelId,
        RbacResourceType.CHANNEL,
        [RbacActions.CREATE_MESSAGE],
      );
    });

    it('should handle TEXT_PAYLOAD source for WebSocket', async () => {
      const user = UserFactory.build();
      const textPayload = 'direct-text-data';
      const client = {
        id: 'socket-789',
        handshake: { user },
      };

      const context = createMockWsExecutionContext({
        user,
        client,
        data: textPayload,
      });

      jest
        .spyOn(reflector, 'getAllAndOverride')
        .mockReturnValueOnce([RbacActions.READ_MESSAGE])
        .mockReturnValueOnce({
          type: RbacResourceType.MESSAGE,
          idKey: 'messageId',
          source: ResourceIdSource.TEXT_PAYLOAD,
        });

      jest
        .spyOn(rolesService, 'verifyActionsForUserAndResource')
        .mockResolvedValue(true);

      await guard.canActivate(context);

      expect(rolesService.verifyActionsForUserAndResource).toHaveBeenCalledWith(
        user.id,
        textPayload,
        RbacResourceType.MESSAGE,
        [RbacActions.READ_MESSAGE],
      );
    });

    it('should deny access when WebSocket client has no user in handshake', async () => {
      const client = {
        id: 'socket-no-user',
        handshake: {},
      };
      const context = createMockWsExecutionContext({ client });

      jest
        .spyOn(reflector, 'getAllAndOverride')
        .mockReturnValueOnce([RbacActions.CREATE_MESSAGE])
        .mockReturnValueOnce(undefined);

      const result = await guard.canActivate(context);

      expect(result).toBe(false);
    });
  });

  describe('Multiple RBAC actions', () => {
    it('should verify multiple required actions', async () => {
      const user = UserFactory.build();
      const context = createMockHttpExecutionContext({ user });

      const multipleActions = [
        RbacActions.CREATE_MESSAGE,
        RbacActions.READ_CHANNEL,
      ];

      jest
        .spyOn(reflector, 'getAllAndOverride')
        .mockReturnValueOnce(multipleActions)
        .mockReturnValueOnce(undefined);

      jest
        .spyOn(rolesService, 'verifyActionsForUserAndResource')
        .mockResolvedValue(true);

      await guard.canActivate(context);

      expect(rolesService.verifyActionsForUserAndResource).toHaveBeenCalledWith(
        user.id,
        undefined,
        undefined,
        multipleActions,
      );
    });
  });

  describe('Permission denial', () => {
    it('should deny access when user lacks required permissions', async () => {
      const user = UserFactory.build();
      const context = createMockHttpExecutionContext({ user });

      jest
        .spyOn(reflector, 'getAllAndOverride')
        .mockReturnValueOnce([RbacActions.DELETE_COMMUNITY])
        .mockReturnValueOnce(undefined);

      jest
        .spyOn(rolesService, 'verifyActionsForUserAndResource')
        .mockResolvedValue(false);

      const result = await guard.canActivate(context);

      expect(result).toBe(false);
    });
  });

  describe('No resource options', () => {
    it('should verify actions without resource context', async () => {
      const user = UserFactory.build();
      const context = createMockHttpExecutionContext({ user });

      jest
        .spyOn(reflector, 'getAllAndOverride')
        .mockReturnValueOnce([RbacActions.CREATE_COMMUNITY])
        .mockReturnValueOnce(undefined); // No resource options

      jest
        .spyOn(rolesService, 'verifyActionsForUserAndResource')
        .mockResolvedValue(true);

      await guard.canActivate(context);

      expect(rolesService.verifyActionsForUserAndResource).toHaveBeenCalledWith(
        user.id,
        undefined,
        undefined,
        [RbacActions.CREATE_COMMUNITY],
      );
    });
  });

  describe('Edge cases', () => {
    it('should handle missing resource ID gracefully', async () => {
      const user = UserFactory.build();
      const context = createMockHttpExecutionContext({
        user,
        body: {}, // No channelId in body
      });

      jest
        .spyOn(reflector, 'getAllAndOverride')
        .mockReturnValueOnce([RbacActions.CREATE_MESSAGE])
        .mockReturnValueOnce({
          type: RbacResourceType.CHANNEL,
          idKey: 'channelId',
          source: ResourceIdSource.BODY,
        });

      jest
        .spyOn(rolesService, 'verifyActionsForUserAndResource')
        .mockResolvedValue(true);

      await guard.canActivate(context);

      expect(rolesService.verifyActionsForUserAndResource).toHaveBeenCalledWith(
        user.id,
        undefined,
        RbacResourceType.CHANNEL,
        [RbacActions.CREATE_MESSAGE],
      );
    });

    it('should handle null user gracefully', async () => {
      const context = createMockHttpExecutionContext({ user: null });

      jest
        .spyOn(reflector, 'getAllAndOverride')
        .mockReturnValueOnce([RbacActions.READ_MESSAGE])
        .mockReturnValueOnce(undefined);

      const result = await guard.canActivate(context);

      expect(result).toBe(false);
    });
  });
});
