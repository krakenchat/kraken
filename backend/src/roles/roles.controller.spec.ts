import { Test, TestingModule } from '@nestjs/testing';
import { RolesController } from './roles.controller';
import { RolesService } from './roles.service';
import { JwtAuthGuard } from '@/auth/jwt-auth.guard';
import { RbacGuard } from '@/auth/rbac.guard';

describe('RolesController', () => {
  let controller: RolesController;
  let service: RolesService;

  const mockRolesService = {
    getUserRolesForCommunity: jest.fn(),
    getUserRolesForChannel: jest.fn(),
    getUserInstanceRoles: jest.fn(),
    getCommunityRoles: jest.fn(),
    createCommunityRole: jest.fn(),
    updateRole: jest.fn(),
    deleteRole: jest.fn(),
    assignUserToCommunityRole: jest.fn(),
    removeUserFromCommunityRole: jest.fn(),
    getUsersForRole: jest.fn(),
  };

  const mockGuard = { canActivate: jest.fn(() => true) };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [RolesController],
      providers: [
        {
          provide: RolesService,
          useValue: mockRolesService,
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue(mockGuard)
      .overrideGuard(RbacGuard)
      .useValue(mockGuard)
      .compile();

    controller = module.get<RolesController>(RolesController);
    service = module.get<RolesService>(RolesService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should have a service', () => {
    expect(service).toBeDefined();
  });

  describe('getMyRolesForCommunity', () => {
    it('should get current user roles for community', async () => {
      const communityId = 'community-123';
      const req = { user: { id: 'user-123' } } as any;
      const expectedRoles = { roles: [], permissions: [] };

      mockRolesService.getUserRolesForCommunity.mockResolvedValue(
        expectedRoles,
      );

      const result = await controller.getMyRolesForCommunity(communityId, req);

      expect(result).toEqual(expectedRoles);
      expect(mockRolesService.getUserRolesForCommunity).toHaveBeenCalledWith(
        'user-123',
        communityId,
      );
    });
  });

  describe('getMyRolesForChannel', () => {
    it('should get current user roles for channel', async () => {
      const channelId = 'channel-123';
      const req = { user: { id: 'user-456' } } as any;
      const expectedRoles = { roles: [], permissions: [] };

      mockRolesService.getUserRolesForChannel.mockResolvedValue(expectedRoles);

      const result = await controller.getMyRolesForChannel(channelId, req);

      expect(result).toEqual(expectedRoles);
      expect(mockRolesService.getUserRolesForChannel).toHaveBeenCalledWith(
        'user-456',
        channelId,
      );
    });
  });

  describe('getMyInstanceRoles', () => {
    it('should get current user instance roles', async () => {
      const req = { user: { id: 'user-789' } } as any;
      const expectedRoles = { roles: [], permissions: [] };

      mockRolesService.getUserInstanceRoles.mockResolvedValue(expectedRoles);

      const result = await controller.getMyInstanceRoles(req);

      expect(result).toEqual(expectedRoles);
      expect(mockRolesService.getUserInstanceRoles).toHaveBeenCalledWith(
        'user-789',
      );
    });
  });

  describe('getUserRolesForCommunity', () => {
    it('should get specific user roles for community', async () => {
      const userId = 'user-123';
      const communityId = 'community-456';
      const expectedRoles = { roles: [], permissions: [] };

      mockRolesService.getUserRolesForCommunity.mockResolvedValue(
        expectedRoles,
      );

      const result = await controller.getUserRolesForCommunity(
        userId,
        communityId,
      );

      expect(result).toEqual(expectedRoles);
      expect(mockRolesService.getUserRolesForCommunity).toHaveBeenCalledWith(
        userId,
        communityId,
      );
    });
  });

  describe('getUserRolesForChannel', () => {
    it('should get specific user roles for channel', async () => {
      const userId = 'user-789';
      const channelId = 'channel-789';
      const expectedRoles = { roles: [], permissions: [] };

      mockRolesService.getUserRolesForChannel.mockResolvedValue(expectedRoles);

      const result = await controller.getUserRolesForChannel(userId, channelId);

      expect(result).toEqual(expectedRoles);
      expect(mockRolesService.getUserRolesForChannel).toHaveBeenCalledWith(
        userId,
        channelId,
      );
    });
  });

  describe('getUserInstanceRoles', () => {
    it('should get specific user instance roles', async () => {
      const userId = 'user-999';
      const expectedRoles = { roles: [], permissions: [] };

      mockRolesService.getUserInstanceRoles.mockResolvedValue(expectedRoles);

      const result = await controller.getUserInstanceRoles(userId);

      expect(result).toEqual(expectedRoles);
      expect(mockRolesService.getUserInstanceRoles).toHaveBeenCalledWith(
        userId,
      );
    });
  });

  describe('getCommunityRoles', () => {
    it('should get all roles for a community', async () => {
      const communityId = 'community-123';
      const expectedRoles = { roles: [] };

      mockRolesService.getCommunityRoles.mockResolvedValue(expectedRoles);

      const result = await controller.getCommunityRoles(communityId);

      expect(result).toEqual(expectedRoles);
      expect(mockRolesService.getCommunityRoles).toHaveBeenCalledWith(
        communityId,
      );
    });
  });

  describe('createCommunityRole', () => {
    it('should create a new community role', async () => {
      const communityId = 'community-456';
      const createRoleDto = {
        name: 'Moderator',
        permissions: ['READ_MESSAGE', 'CREATE_MESSAGE'],
      };
      const createdRole = { id: 'role-123', ...createRoleDto };

      mockRolesService.createCommunityRole.mockResolvedValue(createdRole);

      const result = await controller.createCommunityRole(
        communityId,
        createRoleDto as any,
      );

      expect(result).toEqual(createdRole);
      expect(mockRolesService.createCommunityRole).toHaveBeenCalledWith(
        communityId,
        createRoleDto,
      );
    });
  });

  describe('updateRole', () => {
    it('should update an existing role', async () => {
      const communityId = 'community-456';
      const roleId = 'role-789';
      const updateRoleDto = { name: 'Updated Moderator' };
      const updatedRole = { id: roleId, ...updateRoleDto };

      mockRolesService.updateRole.mockResolvedValue(updatedRole);

      const result = await controller.updateRole(
        communityId,
        roleId,
        updateRoleDto as any,
      );

      expect(result).toEqual(updatedRole);
      expect(mockRolesService.updateRole).toHaveBeenCalledWith(
        roleId,
        communityId,
        updateRoleDto,
      );
    });
  });

  describe('deleteRole', () => {
    it('should delete a role', async () => {
      const communityId = 'community-456';
      const roleId = 'role-999';

      mockRolesService.deleteRole.mockResolvedValue(undefined);

      const result = await controller.deleteRole(communityId, roleId);

      expect(result).toBeUndefined();
      expect(mockRolesService.deleteRole).toHaveBeenCalledWith(
        roleId,
        communityId,
      );
    });
  });

  describe('assignRoleToUser', () => {
    it('should assign a role to a user', async () => {
      const communityId = 'community-111';
      const assignRoleDto = {
        userId: 'user-222',
        roleId: 'role-333',
      };

      mockRolesService.assignUserToCommunityRole.mockResolvedValue(undefined);

      const result = await controller.assignRoleToUser(
        communityId,
        assignRoleDto as any,
      );

      expect(result).toBeUndefined();
      expect(mockRolesService.assignUserToCommunityRole).toHaveBeenCalledWith(
        'user-222',
        communityId,
        'role-333',
      );
    });
  });

  describe('removeRoleFromUser', () => {
    it('should remove a role from a user', async () => {
      const communityId = 'community-444';
      const userId = 'user-555';
      const roleId = 'role-666';

      mockRolesService.removeUserFromCommunityRole.mockResolvedValue(undefined);

      const result = await controller.removeRoleFromUser(
        communityId,
        userId,
        roleId,
      );

      expect(result).toBeUndefined();
      expect(mockRolesService.removeUserFromCommunityRole).toHaveBeenCalledWith(
        userId,
        communityId,
        roleId,
      );
    });
  });

  describe('getUsersForRole', () => {
    it('should get all users for a role in a community', async () => {
      const communityId = 'community-888';
      const roleId = 'role-777';
      const expectedUsers = [{ id: 'user-1' }, { id: 'user-2' }];

      mockRolesService.getUsersForRole.mockResolvedValue(expectedUsers);

      const result = await controller.getUsersForRole(communityId, roleId);

      expect(result).toEqual(expectedUsers);
      expect(mockRolesService.getUsersForRole).toHaveBeenCalledWith(
        roleId,
        communityId,
      );
    });
  });
});
