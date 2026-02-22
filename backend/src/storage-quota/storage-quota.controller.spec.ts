import { TestBed } from '@suites/unit';
import type { Mocked } from '@suites/doubles.jest';
import { StorageQuotaController } from './storage-quota.controller';
import { StorageQuotaService } from './storage-quota.service';

describe('StorageQuotaController', () => {
  let controller: StorageQuotaController;
  let storageQuotaService: Mocked<StorageQuotaService>;

  const userId = 'user-123';
  const mockReq = { user: { id: userId } } as any;

  beforeEach(async () => {
    const { unit, unitRef } = await TestBed.solitary(
      StorageQuotaController,
    ).compile();

    controller = unit;
    storageQuotaService = unitRef.get(StorageQuotaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getMyStorageStats', () => {
    it('should return current user storage stats', async () => {
      const mockStats = {
        userId,
        username: 'testuser',
        usedBytes: 5000,
        quotaBytes: 1000000,
        percentUsed: 0.5,
        fileCount: 3,
      };

      storageQuotaService.getUserStorageStats.mockResolvedValue(mockStats);

      const result = await controller.getMyStorageStats(mockReq);

      expect(result).toEqual(mockStats);
      expect(storageQuotaService.getUserStorageStats).toHaveBeenCalledWith(
        userId,
      );
    });
  });

  describe('getInstanceStorageStats', () => {
    it('should return instance stats', async () => {
      const mockStats = {
        totalStorageUsedBytes: 1000000,
        totalFileCount: 50,
        totalUserCount: 10,
      } as any;

      storageQuotaService.getInstanceStorageStats.mockResolvedValue(mockStats);

      const result = await controller.getInstanceStorageStats();

      expect(result).toEqual(mockStats);
    });
  });

  describe('getUsersStorageList', () => {
    it('should pass pagination params to service', async () => {
      const mockResponse = { users: [], total: 0 };
      storageQuotaService.getUsersStorageList.mockResolvedValue(mockResponse);

      const result = await controller.getUsersStorageList(0, 20, 0);

      expect(result).toEqual(mockResponse);
      expect(storageQuotaService.getUsersStorageList).toHaveBeenCalledWith({
        skip: 0,
        take: 20,
        minPercentUsed: undefined,
      });
    });

    it('should pass minPercentUsed when non-zero', async () => {
      const mockResponse = { users: [], total: 0 };
      storageQuotaService.getUsersStorageList.mockResolvedValue(mockResponse);

      await controller.getUsersStorageList(0, 20, 50);

      expect(storageQuotaService.getUsersStorageList).toHaveBeenCalledWith({
        skip: 0,
        take: 20,
        minPercentUsed: 50,
      });
    });
  });

  describe('getUserStorageStats', () => {
    it('should return specific user stats', async () => {
      const targetUserId = 'target-user-456';
      const mockStats = {
        userId: targetUserId,
        username: 'target',
        usedBytes: 5000,
        quotaBytes: 1000000,
        percentUsed: 0.5,
        fileCount: 3,
      };

      storageQuotaService.getUserStorageStats.mockResolvedValue(mockStats);

      const result = await controller.getUserStorageStats(targetUserId);

      expect(result).toEqual(mockStats);
      expect(storageQuotaService.getUserStorageStats).toHaveBeenCalledWith(
        targetUserId,
      );
    });
  });

  describe('updateUserQuota', () => {
    it('should update user quota and return stats', async () => {
      const targetUserId = 'target-user-456';
      const dto = { quotaBytes: 2000000 };
      const mockStats = {
        userId: targetUserId,
        username: 'target',
        usedBytes: 5000,
        quotaBytes: 2000000,
        percentUsed: 0.25,
        fileCount: 3,
      };

      storageQuotaService.updateUserQuota.mockResolvedValue(mockStats);

      const result = await controller.updateUserQuota(targetUserId, dto);

      expect(result).toEqual(mockStats);
      expect(storageQuotaService.updateUserQuota).toHaveBeenCalledWith(
        targetUserId,
        2000000,
      );
    });
  });

  describe('recalculateUserStorage', () => {
    it('should recalculate and return stats', async () => {
      const targetUserId = 'target-user-456';
      const mockStats = {
        userId: targetUserId,
        username: 'target',
        usedBytes: 42000,
        quotaBytes: 1000000,
        percentUsed: 4.2,
        fileCount: 5,
      };

      storageQuotaService.recalculateUserStorage.mockResolvedValue(mockStats);

      const result = await controller.recalculateUserStorage(targetUserId);

      expect(result).toEqual(mockStats);
      expect(storageQuotaService.recalculateUserStorage).toHaveBeenCalledWith(
        targetUserId,
      );
    });
  });

  describe('updateStorageSettings', () => {
    it('should update settings and return success', async () => {
      const dto = {
        defaultStorageQuotaBytes: 1000000000,
        maxFileSizeBytes: 50000000,
      };

      storageQuotaService.updateStorageSettings.mockResolvedValue(undefined);

      const result = await controller.updateStorageSettings(dto);

      expect(result).toEqual({ success: true });
      expect(storageQuotaService.updateStorageSettings).toHaveBeenCalledWith(
        1000000000,
        50000000,
      );
    });
  });
});
