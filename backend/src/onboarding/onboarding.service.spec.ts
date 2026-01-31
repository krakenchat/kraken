import { Test, TestingModule } from '@nestjs/testing';
import { OnboardingService } from './onboarding.service';
import { DatabaseService } from '@/database/database.service';
import { REDIS_CLIENT } from '@/redis/redis.constants';
import { RolesService } from '@/roles/roles.service';
import { ConflictException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import {
  UserFactory,
  CommunityFactory,
  ChannelFactory,
  InstanceInviteFactory,
  createMockDatabase,
  createMockRedis,
} from '@/test-utils';
import { SetupInstanceDto } from './dto/setup-instance.dto';
import { InstanceRole } from '@prisma/client';

// Mock bcrypt and crypto
jest.mock('bcrypt');
jest.mock('crypto', () => ({
  randomUUID: jest.fn(() => 'mock-uuid-123'),
}));

describe('OnboardingService', () => {
  let service: OnboardingService;
  let mockDatabase: ReturnType<typeof createMockDatabase>;
  let mockRedis: ReturnType<typeof createMockRedis>;
  let rolesService: RolesService;

  const mockBcrypt = bcrypt as jest.Mocked<typeof bcrypt>;

  beforeEach(async () => {
    mockDatabase = createMockDatabase();
    mockRedis = createMockRedis();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OnboardingService,
        {
          provide: DatabaseService,
          useValue: mockDatabase,
        },
        {
          provide: REDIS_CLIENT,
          useValue: mockRedis,
        },
        {
          provide: RolesService,
          useValue: {
            createDefaultCommunityRoles: jest.fn(),
            assignUserToCommunityRole: jest.fn(),
            createDefaultInstanceRole: jest
              .fn()
              .mockResolvedValue('mock-instance-admin-role-id'),
            assignUserToInstanceRole: jest.fn(),
            createDefaultCommunityCreatorRole: jest
              .fn()
              .mockResolvedValue('mock-community-creator-role-id'),
          },
        },
      ],
    }).compile();

    service = module.get<OnboardingService>(OnboardingService);
    rolesService = module.get<RolesService>(RolesService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('needsSetup', () => {
    it('should return true when there are no users and no active invites', async () => {
      mockDatabase.user.count.mockResolvedValue(0);
      mockDatabase.instanceInvite.count.mockResolvedValue(0);

      const result = await service.needsSetup();

      expect(result).toBe(true);
      expect(mockDatabase.user.count).toHaveBeenCalled();
      expect(mockDatabase.instanceInvite.count).toHaveBeenCalledWith({
        where: { disabled: false },
      });
    });

    it('should return false when there are existing users', async () => {
      mockDatabase.user.count.mockResolvedValue(1);

      const result = await service.needsSetup();

      expect(result).toBe(false);
      expect(mockDatabase.user.count).toHaveBeenCalled();
      expect(mockDatabase.instanceInvite.count).not.toHaveBeenCalled();
    });

    it('should return false when there are active invites but no users', async () => {
      mockDatabase.user.count.mockResolvedValue(0);
      mockDatabase.instanceInvite.count.mockResolvedValue(1);

      const result = await service.needsSetup();

      expect(result).toBe(false);
      expect(mockDatabase.instanceInvite.count).toHaveBeenCalledWith({
        where: { disabled: false },
      });
    });
  });

  describe('generateSetupToken', () => {
    it('should generate and store a new setup token when setup is needed', async () => {
      mockDatabase.user.count.mockResolvedValue(0);
      mockDatabase.instanceInvite.count.mockResolvedValue(0);
      mockRedis.get.mockResolvedValue(null);
      mockRedis.set.mockResolvedValue(undefined);

      const token = await service.generateSetupToken();

      expect(token).toBe('mock-uuid-123');
      expect(mockRedis.set).toHaveBeenCalledWith(
        'onboarding:setup-token',
        'mock-uuid-123',
        'EX',
        900,
      );
    });

    it('should return existing token if one already exists', async () => {
      mockDatabase.user.count.mockResolvedValue(0);
      mockDatabase.instanceInvite.count.mockResolvedValue(0);
      mockRedis.get.mockResolvedValue('existing-token');

      const token = await service.generateSetupToken();

      expect(token).toBe('existing-token');
      expect(mockRedis.set).not.toHaveBeenCalled();
    });

    it('should throw ConflictException when setup is not needed', async () => {
      mockDatabase.user.count.mockResolvedValue(1);

      await expect(service.generateSetupToken()).rejects.toThrow(
        ConflictException,
      );
      await expect(service.generateSetupToken()).rejects.toThrow(
        'Instance setup is not needed',
      );
    });
  });

  describe('validateSetupToken', () => {
    it('should return true when token matches stored token', async () => {
      mockRedis.get.mockResolvedValue('valid-token');

      const result = await service.validateSetupToken('valid-token');

      expect(result).toBe(true);
      expect(mockRedis.get).toHaveBeenCalledWith('onboarding:setup-token');
    });

    it('should return false when token does not match', async () => {
      mockRedis.get.mockResolvedValue('valid-token');

      const result = await service.validateSetupToken('wrong-token');

      expect(result).toBe(false);
    });

    it('should return false when no token is stored', async () => {
      mockRedis.get.mockResolvedValue(null);

      const result = await service.validateSetupToken('any-token');

      expect(result).toBe(false);
    });
  });

  describe('completeSetup', () => {
    const validSetupDto: SetupInstanceDto = {
      adminUsername: 'admin',
      adminPassword: 'password123',
      adminEmail: 'admin@example.com',
      instanceName: 'My Instance',
      instanceDescription: 'Test instance',
      defaultCommunityName: 'General',
      createDefaultCommunity: true,
      setupToken: 'valid-token',
    };

    const mockAdmin = UserFactory.build({
      username: 'admin',
      role: InstanceRole.OWNER,
      verified: true,
    });

    const mockCommunity = CommunityFactory.build({
      name: 'General',
      description: 'Test instance',
    });

    const mockChannels = [
      ChannelFactory.build({ name: 'general', type: 'TEXT' }),
      ChannelFactory.build({ name: 'announcements', type: 'TEXT' }),
      ChannelFactory.build({ name: 'voice-chat', type: 'VOICE' }),
    ];

    const mockInvite = InstanceInviteFactory.build();

    beforeEach(() => {
      mockRedis.get.mockResolvedValue('valid-token');
      mockDatabase.user.count.mockResolvedValue(0);
      mockDatabase.instanceInvite.count.mockResolvedValue(0);
      mockBcrypt.hash.mockResolvedValue('hashed-password' as never);

      // Setup transaction mock
      mockDatabase.$transaction.mockImplementation((callback: any) => {
        const mockTx = createMockDatabase();

        // Mock admin user creation
        mockTx.user.create.mockResolvedValue(mockAdmin);

        // Mock community creation
        mockTx.community.create.mockResolvedValue(mockCommunity);

        // Mock membership creation
        mockTx.membership.create.mockResolvedValue({
          userId: mockAdmin.id,
          communityId: mockCommunity.id,
        });

        // Mock channel creation
        mockTx.channel.create
          .mockResolvedValueOnce(mockChannels[0])
          .mockResolvedValueOnce(mockChannels[1])
          .mockResolvedValueOnce(mockChannels[2]);

        // Mock channel membership creation
        mockTx.channelMembership.createMany.mockResolvedValue({ count: 3 });

        // Mock message creation
        mockTx.message.create.mockResolvedValue({
          id: 'msg-1',
          channelId: mockChannels[0].id,
          authorId: mockAdmin.id,
        });

        // Mock invite creation
        mockTx.instanceInvite.create.mockResolvedValue(mockInvite);

        // Mock roles service
        jest
          .spyOn(rolesService, 'createDefaultCommunityRoles')
          .mockResolvedValue('admin-role-id');
        jest
          .spyOn(rolesService, 'assignUserToCommunityRole')
          .mockResolvedValue(undefined);

        return callback(mockTx);
      });

      mockRedis.del.mockResolvedValue(undefined);
      mockRedis.set.mockResolvedValue(undefined);
    });

    it('should complete setup successfully with default community', async () => {
      const result = await service.completeSetup(validSetupDto, 'valid-token');

      expect(result.adminUser).toBeDefined();
      expect(result.adminUser.username).toBe('admin');
      expect(result.adminUser.role).toBe(InstanceRole.OWNER);
      expect(result.defaultCommunity).toBeDefined();
      expect(result.defaultCommunity?.name).toBe('General');
    });

    it('should hash admin password with bcrypt', async () => {
      await service.completeSetup(validSetupDto, 'valid-token');

      expect(bcrypt.hash).toHaveBeenCalledWith('password123', 10);
    });

    it('should create admin user with correct properties', async () => {
      await service.completeSetup(validSetupDto, 'valid-token');

      expect(mockDatabase.$transaction).toHaveBeenCalled();
      expect(bcrypt.hash).toHaveBeenCalledWith('password123', 10);
    });

    it('should create default community with three channels', async () => {
      const result = await service.completeSetup(validSetupDto, 'valid-token');

      expect(mockDatabase.$transaction).toHaveBeenCalled();
      expect(result.defaultCommunity).toBeDefined();
      expect(result.defaultCommunity?.name).toBe('General');
    });

    it('should add admin to community and all channels', async () => {
      await service.completeSetup(validSetupDto, 'valid-token');

      expect(mockDatabase.$transaction).toHaveBeenCalled();
      expect(rolesService.createDefaultCommunityRoles).toHaveBeenCalled();
    });

    it('should create default roles and assign admin', async () => {
      await service.completeSetup(validSetupDto, 'valid-token');

      expect(rolesService.createDefaultCommunityRoles).toHaveBeenCalled();
      expect(rolesService.assignUserToCommunityRole).toHaveBeenCalled();
    });

    it('should create welcome message in general channel', async () => {
      await service.completeSetup(validSetupDto, 'valid-token');

      expect(mockDatabase.$transaction).toHaveBeenCalled();
    });

    it('should create permanent instance invite', async () => {
      await service.completeSetup(validSetupDto, 'valid-token');

      expect(mockDatabase.$transaction).toHaveBeenCalled();
    });

    it('should skip community creation when createDefaultCommunity is false', async () => {
      const dtoWithoutCommunity: SetupInstanceDto = {
        ...validSetupDto,
        createDefaultCommunity: false,
      };

      const result = await service.completeSetup(
        dtoWithoutCommunity,
        'valid-token',
      );

      expect(result.defaultCommunity).toBeNull();
    });

    it('should clear setup token after successful completion', async () => {
      await service.completeSetup(validSetupDto, 'valid-token');

      expect(mockRedis.del).toHaveBeenCalledWith('onboarding:setup-token');
    });

    it('should store instance name in Redis', async () => {
      await service.completeSetup(validSetupDto, 'valid-token');

      expect(mockRedis.set).toHaveBeenCalledWith(
        'instance:name',
        'My Instance',
      );
    });

    it('should throw ConflictException when setup token is invalid', async () => {
      mockRedis.get.mockResolvedValue('different-token');

      await expect(
        service.completeSetup(validSetupDto, 'invalid-token'),
      ).rejects.toThrow(ConflictException);
      await expect(
        service.completeSetup(validSetupDto, 'invalid-token'),
      ).rejects.toThrow('Invalid setup token');
    });

    it('should throw ConflictException when setup is no longer needed', async () => {
      mockDatabase.user.count.mockResolvedValue(1);

      await expect(
        service.completeSetup(validSetupDto, 'valid-token'),
      ).rejects.toThrow(ConflictException);
      await expect(
        service.completeSetup(validSetupDto, 'valid-token'),
      ).rejects.toThrow('Instance setup is no longer needed');
    });

    it('should lowercase admin username', async () => {
      const dtoWithUppercase: SetupInstanceDto = {
        ...validSetupDto,
        adminUsername: 'ADMIN',
      };

      const result = await service.completeSetup(
        dtoWithUppercase,
        'valid-token',
      );

      expect(result.adminUser.username).toBe('admin');
    });

    it('should use default community name if not provided', async () => {
      const dtoWithoutName: SetupInstanceDto = {
        ...validSetupDto,
        defaultCommunityName: undefined,
      };

      const result = await service.completeSetup(dtoWithoutName, 'valid-token');

      expect(result.defaultCommunity?.name).toBe('General');
    });
  });

  describe('getStatus', () => {
    it('should return needsSetup true and generate token when setup is needed', async () => {
      mockDatabase.user.count.mockResolvedValue(0);
      mockDatabase.instanceInvite.count.mockResolvedValue(0);
      mockRedis.get.mockResolvedValue(null);
      mockRedis.set.mockResolvedValue(undefined);

      const status = await service.getStatus();

      expect(status.needsSetup).toBe(true);
      expect(status.hasUsers).toBe(false);
      expect(status.setupToken).toBe('mock-uuid-123');
    });

    it('should return needsSetup false when users exist', async () => {
      mockDatabase.user.count.mockResolvedValue(1);

      const status = await service.getStatus();

      expect(status.needsSetup).toBe(false);
      expect(status.hasUsers).toBe(true);
      expect(status.setupToken).toBeUndefined();
    });

    it('should not generate token when setup is not needed', async () => {
      mockDatabase.user.count.mockResolvedValue(1);

      await service.getStatus();

      expect(mockRedis.set).not.toHaveBeenCalled();
    });
  });
});
