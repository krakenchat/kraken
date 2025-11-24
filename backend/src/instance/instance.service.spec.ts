import { Test, TestingModule } from '@nestjs/testing';
import { InstanceService } from './instance.service';
import { DatabaseService } from '@/database/database.service';
import { createMockDatabase } from '@/test-utils';
import { RegistrationMode } from '@prisma/client';

describe('InstanceService', () => {
  let service: InstanceService;
  let mockDatabase: ReturnType<typeof createMockDatabase>;

  beforeEach(async () => {
    mockDatabase = createMockDatabase();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InstanceService,
        {
          provide: DatabaseService,
          useValue: mockDatabase,
        },
      ],
    }).compile();

    service = module.get<InstanceService>(InstanceService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getSettings', () => {
    it('should return existing settings', async () => {
      const mockSettings = {
        id: 'settings-1',
        name: 'Test Instance',
        description: 'A test instance',
        registrationMode: RegistrationMode.INVITE_ONLY,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockDatabase.instanceSettings.findFirst.mockResolvedValue(mockSettings);

      const result = await service.getSettings();

      expect(result).toEqual(mockSettings);
      expect(mockDatabase.instanceSettings.findFirst).toHaveBeenCalled();
    });

    it('should create default settings if none exist', async () => {
      const mockNewSettings = {
        id: 'settings-1',
        name: 'Kraken',
        description: null,
        registrationMode: RegistrationMode.INVITE_ONLY,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockDatabase.instanceSettings.findFirst.mockResolvedValue(null);
      mockDatabase.instanceSettings.create.mockResolvedValue(mockNewSettings);

      const result = await service.getSettings();

      expect(result).toEqual(mockNewSettings);
      expect(mockDatabase.instanceSettings.create).toHaveBeenCalledWith({
        data: {
          name: 'Kraken',
          description: null,
          registrationMode: RegistrationMode.INVITE_ONLY,
        },
      });
    });
  });

  describe('updateSettings', () => {
    it('should update settings with provided values', async () => {
      const existingSettings = {
        id: 'settings-1',
        name: 'Old Name',
        description: null,
        registrationMode: RegistrationMode.INVITE_ONLY,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const updatedSettings = {
        ...existingSettings,
        name: 'New Name',
        description: 'New description',
      };

      mockDatabase.instanceSettings.findFirst.mockResolvedValue(
        existingSettings,
      );
      mockDatabase.instanceSettings.update.mockResolvedValue(updatedSettings);

      const result = await service.updateSettings({
        name: 'New Name',
        description: 'New description',
      });

      expect(result).toEqual(updatedSettings);
      expect(mockDatabase.instanceSettings.update).toHaveBeenCalledWith({
        where: { id: existingSettings.id },
        data: {
          name: 'New Name',
          description: 'New description',
        },
      });
    });

    it('should only update provided fields', async () => {
      const existingSettings = {
        id: 'settings-1',
        name: 'Existing Name',
        description: 'Existing description',
        registrationMode: RegistrationMode.INVITE_ONLY,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockDatabase.instanceSettings.findFirst.mockResolvedValue(
        existingSettings,
      );
      mockDatabase.instanceSettings.update.mockResolvedValue({
        ...existingSettings,
        registrationMode: RegistrationMode.OPEN,
      });

      await service.updateSettings({
        registrationMode: RegistrationMode.OPEN,
      });

      expect(mockDatabase.instanceSettings.update).toHaveBeenCalledWith({
        where: { id: existingSettings.id },
        data: {
          registrationMode: RegistrationMode.OPEN,
        },
      });
    });
  });

  describe('getStats', () => {
    it('should return instance statistics', async () => {
      mockDatabase.user.count
        .mockResolvedValueOnce(100) // totalUsers
        .mockResolvedValueOnce(5); // bannedUsers
      mockDatabase.community.count.mockResolvedValue(10);
      mockDatabase.channel.count.mockResolvedValue(50);
      mockDatabase.message.count.mockResolvedValue(1000);
      mockDatabase.instanceInvite.count.mockResolvedValue(3);

      const result = await service.getStats();

      expect(result).toEqual({
        totalUsers: 100,
        totalCommunities: 10,
        totalChannels: 50,
        totalMessages: 1000,
        activeInvites: 3,
        bannedUsers: 5,
      });
    });
  });
});
