import { Test, TestingModule } from '@nestjs/testing';
import { OnboardingController } from './onboarding.controller';
import { OnboardingService } from './onboarding.service';
import { SetupInstanceDto } from './dto/setup-instance.dto';
import { BadRequestException } from '@nestjs/common';
import { UserFactory, CommunityFactory } from '@/test-utils';

describe('OnboardingController', () => {
  let controller: OnboardingController;
  let service: OnboardingService;

  const mockOnboardingService = {
    getStatus: jest.fn(),
    completeSetup: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [OnboardingController],
      providers: [
        {
          provide: OnboardingService,
          useValue: mockOnboardingService,
        },
      ],
    }).compile();

    controller = module.get<OnboardingController>(OnboardingController);
    service = module.get<OnboardingService>(OnboardingService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getStatus', () => {
    it('should return onboarding status from service', async () => {
      const mockStatus = {
        needsSetup: true,
        hasUsers: false,
        setupToken: 'token-123',
      };

      jest.spyOn(service, 'getStatus').mockResolvedValue(mockStatus);

      const result = await controller.getStatus();

      expect(service.getStatus).toHaveBeenCalled();
      expect(result).toEqual(mockStatus);
    });

    it('should return status when setup is not needed', async () => {
      const mockStatus = {
        needsSetup: false,
        hasUsers: true,
        setupToken: undefined,
      };

      jest.spyOn(service, 'getStatus').mockResolvedValue(mockStatus);

      const result = await controller.getStatus();

      expect(result.needsSetup).toBe(false);
      expect(result.hasUsers).toBe(true);
      expect(result.setupToken).toBeUndefined();
    });

    it('should call service without any parameters', async () => {
      jest.spyOn(service, 'getStatus').mockResolvedValue({
        needsSetup: true,
        hasUsers: false,
        setupToken: 'token-123',
      });

      await controller.getStatus();

      expect(service.getStatus).toHaveBeenCalledWith();
    });
  });

  describe('setupInstance', () => {
    const validSetupDto: SetupInstanceDto = {
      adminUsername: 'admin',
      adminPassword: 'password123',
      adminEmail: 'admin@example.com',
      instanceName: 'My Instance',
      instanceDescription: 'Test instance',
      defaultCommunityName: 'General',
      createDefaultCommunity: true,
      setupToken: 'valid-token-123',
    };

    it('should complete instance setup successfully', async () => {
      const mockAdmin = UserFactory.build({ id: 'user-123' });
      const mockCommunity = CommunityFactory.build({ id: 'community-123' });

      jest.spyOn(service, 'completeSetup').mockResolvedValue({
        adminUser: mockAdmin as any,
        defaultCommunity: mockCommunity as any,
      });

      const result = await controller.setupInstance(validSetupDto);

      expect(service.completeSetup).toHaveBeenCalledWith(
        validSetupDto,
        'valid-token-123',
      );
      expect(result).toEqual({
        success: true,
        message: 'Instance setup completed successfully',
        adminUserId: 'user-123',
        defaultCommunityId: 'community-123',
      });
    });

    it('should complete setup without default community', async () => {
      const mockAdmin = UserFactory.build({ id: 'admin-456' });

      jest.spyOn(service, 'completeSetup').mockResolvedValue({
        adminUser: mockAdmin as any,
        defaultCommunity: null,
      });

      const dtoWithoutCommunity: SetupInstanceDto = {
        ...validSetupDto,
        createDefaultCommunity: false,
      };

      const result = await controller.setupInstance(dtoWithoutCommunity);

      expect(result.success).toBe(true);
      expect(result.adminUserId).toBe('admin-456');
      expect(result.defaultCommunityId).toBeUndefined();
    });

    it('should throw BadRequestException when setupToken is missing', async () => {
      const dtoWithoutToken: SetupInstanceDto = {
        ...validSetupDto,
        setupToken: undefined as any,
      };

      await expect(controller.setupInstance(dtoWithoutToken)).rejects.toThrow(
        BadRequestException,
      );
      await expect(controller.setupInstance(dtoWithoutToken)).rejects.toThrow(
        'Setup token is required',
      );
      expect(service.completeSetup).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException when setupToken is empty string', async () => {
      const dtoWithEmptyToken: SetupInstanceDto = {
        ...validSetupDto,
        setupToken: '',
      };

      await expect(controller.setupInstance(dtoWithEmptyToken)).rejects.toThrow(
        BadRequestException,
      );
      expect(service.completeSetup).not.toHaveBeenCalled();
    });

    it('should pass setup token from DTO to service', async () => {
      const mockAdmin = UserFactory.build();
      jest.spyOn(service, 'completeSetup').mockResolvedValue({
        adminUser: mockAdmin as any,
        defaultCommunity: null,
      });

      await controller.setupInstance(validSetupDto);

      const callArgs = (service.completeSetup as jest.Mock).mock.calls[0];
      expect(callArgs[1]).toBe('valid-token-123');
    });

    it('should return formatted response with all fields', async () => {
      const mockAdmin = UserFactory.build({ id: 'admin-id' });
      const mockCommunity = CommunityFactory.build({ id: 'comm-id' });

      jest.spyOn(service, 'completeSetup').mockResolvedValue({
        adminUser: mockAdmin as any,
        defaultCommunity: mockCommunity as any,
      });

      const result = await controller.setupInstance(validSetupDto);

      expect(result).toHaveProperty('success', true);
      expect(result).toHaveProperty(
        'message',
        'Instance setup completed successfully',
      );
      expect(result).toHaveProperty('adminUserId', 'admin-id');
      expect(result).toHaveProperty('defaultCommunityId', 'comm-id');
    });

    it('should handle service errors gracefully', async () => {
      jest
        .spyOn(service, 'completeSetup')
        .mockRejectedValue(new Error('Setup failed'));

      await expect(controller.setupInstance(validSetupDto)).rejects.toThrow(
        'Setup failed',
      );
    });
  });
});
