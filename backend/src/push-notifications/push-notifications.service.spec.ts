import { TestBed } from '@suites/unit';
import type { Mocked } from '@suites/doubles.jest';
import { ConfigService } from '@nestjs/config';
import { PushNotificationsService } from './push-notifications.service';
import { DatabaseService } from '@/database/database.service';
import { createMockDatabase } from '@/test-utils';
import * as webpush from 'web-push';

// Mock web-push module
jest.mock('web-push', () => ({
  setVapidDetails: jest.fn(),
  sendNotification: jest.fn(),
  generateVAPIDKeys: jest.fn(),
}));

describe('PushNotificationsService', () => {
  let service: PushNotificationsService;
  let mockDatabase: ReturnType<typeof createMockDatabase>;
  let configService: Mocked<ConfigService>;

  const mockVapidPublicKey = 'BNxFj3IxG...testPublicKey';
  const mockVapidPrivateKey = 'testPrivateKey123';

  beforeEach(async () => {
    mockDatabase = createMockDatabase();

    const { unit, unitRef } = await TestBed.solitary(PushNotificationsService)
      .mock(DatabaseService)
      .final(mockDatabase)
      .compile();

    service = unit;
    configService = unitRef.get(ConfigService);

    // Default: no env vars set (so DB/auto-gen paths are tested by default)
    configService.get.mockReturnValue(undefined);

    // Default: no settings in DB
    mockDatabase.instanceSettings.findFirst.mockResolvedValue(null);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('onModuleInit', () => {
    it('should use env vars when both VAPID keys are present (tier 1)', async () => {
      configService.get.mockImplementation((key: string) => {
        switch (key) {
          case 'VAPID_PUBLIC_KEY':
            return mockVapidPublicKey;
          case 'VAPID_PRIVATE_KEY':
            return mockVapidPrivateKey;
          case 'VAPID_SUBJECT':
            return 'mailto:test@example.com';
          default:
            return undefined;
        }
      });

      await service.onModuleInit();

      expect(webpush.setVapidDetails).toHaveBeenCalledWith(
        'mailto:test@example.com',
        mockVapidPublicKey,
        mockVapidPrivateKey,
      );
      expect(service.isEnabled()).toBe(true);
      expect(mockDatabase.instanceSettings.findFirst).not.toHaveBeenCalled();
    });

    it('should use default subject when env var not set (tier 1)', async () => {
      configService.get.mockImplementation((key: string) => {
        if (key === 'VAPID_PUBLIC_KEY') return mockVapidPublicKey;
        if (key === 'VAPID_PRIVATE_KEY') return mockVapidPrivateKey;
        return undefined;
      });

      await service.onModuleInit();

      expect(webpush.setVapidDetails).toHaveBeenCalledWith(
        'mailto:admin@localhost',
        mockVapidPublicKey,
        mockVapidPrivateKey,
      );
    });

    it('should load keys from database when env vars are absent (tier 2)', async () => {
      const dbPublicKey = 'db-public-key';
      const dbPrivateKey = 'db-private-key';

      mockDatabase.instanceSettings.findFirst.mockResolvedValue({
        id: 'settings-1',
        vapidPublicKey: dbPublicKey,
        vapidPrivateKey: dbPrivateKey,
        vapidSubject: 'mailto:db@example.com',
      });

      await service.onModuleInit();

      expect(webpush.setVapidDetails).toHaveBeenCalledWith(
        'mailto:db@example.com',
        dbPublicKey,
        dbPrivateKey,
      );
      expect(service.isEnabled()).toBe(true);
      expect(webpush.generateVAPIDKeys).not.toHaveBeenCalled();
    });

    it('should prefer env VAPID_SUBJECT over DB subject (tier 2)', async () => {
      configService.get.mockImplementation((key: string) => {
        if (key === 'VAPID_SUBJECT') return 'mailto:env@example.com';
        return undefined;
      });

      mockDatabase.instanceSettings.findFirst.mockResolvedValue({
        id: 'settings-1',
        vapidPublicKey: 'db-public',
        vapidPrivateKey: 'db-private',
        vapidSubject: 'mailto:db@example.com',
      });

      await service.onModuleInit();

      expect(webpush.setVapidDetails).toHaveBeenCalledWith(
        'mailto:env@example.com',
        'db-public',
        'db-private',
      );
    });

    it('should auto-generate keys when neither env vars nor DB keys exist (tier 3)', async () => {
      const generatedKeys = {
        publicKey: 'generated-public-key',
        privateKey: 'generated-private-key',
      };
      (webpush.generateVAPIDKeys as jest.Mock).mockReturnValue(generatedKeys);
      mockDatabase.instanceSettings.create.mockResolvedValue({
        id: 'settings-1',
      });

      await service.onModuleInit();

      expect(webpush.generateVAPIDKeys).toHaveBeenCalled();
      expect(webpush.setVapidDetails).toHaveBeenCalledWith(
        'mailto:admin@localhost',
        generatedKeys.publicKey,
        generatedKeys.privateKey,
      );
      expect(service.isEnabled()).toBe(true);
    });

    it('should persist auto-generated keys to new settings record', async () => {
      const generatedKeys = {
        publicKey: 'generated-public-key',
        privateKey: 'generated-private-key',
      };
      (webpush.generateVAPIDKeys as jest.Mock).mockReturnValue(generatedKeys);
      mockDatabase.instanceSettings.create.mockResolvedValue({
        id: 'settings-1',
      });

      await service.onModuleInit();

      expect(mockDatabase.instanceSettings.create).toHaveBeenCalledWith({
        data: {
          vapidPublicKey: generatedKeys.publicKey,
          vapidPrivateKey: generatedKeys.privateKey,
          vapidSubject: 'mailto:admin@localhost',
        },
      });
    });

    it('should update existing settings when auto-generating keys', async () => {
      mockDatabase.instanceSettings.findFirst.mockResolvedValue({
        id: 'settings-1',
        vapidPublicKey: null,
        vapidPrivateKey: null,
        vapidSubject: null,
      });

      const generatedKeys = {
        publicKey: 'generated-public-key',
        privateKey: 'generated-private-key',
      };
      (webpush.generateVAPIDKeys as jest.Mock).mockReturnValue(generatedKeys);
      mockDatabase.instanceSettings.update.mockResolvedValue({
        id: 'settings-1',
      });

      await service.onModuleInit();

      expect(mockDatabase.instanceSettings.update).toHaveBeenCalledWith({
        where: { id: 'settings-1' },
        data: {
          vapidPublicKey: generatedKeys.publicKey,
          vapidPrivateKey: generatedKeys.privateKey,
          vapidSubject: 'mailto:admin@localhost',
        },
      });
    });

    it('should handle database errors gracefully', async () => {
      mockDatabase.instanceSettings.findFirst.mockRejectedValue(
        new Error('DB connection failed'),
      );

      await service.onModuleInit();

      expect(service.isEnabled()).toBe(false);
    });
  });

  describe('getVapidPublicKey', () => {
    it('should return cached public key when configured via env vars', async () => {
      configService.get.mockImplementation((key: string) => {
        if (key === 'VAPID_PUBLIC_KEY') return mockVapidPublicKey;
        if (key === 'VAPID_PRIVATE_KEY') return mockVapidPrivateKey;
        return undefined;
      });

      await service.onModuleInit();

      expect(service.getVapidPublicKey()).toBe(mockVapidPublicKey);
    });

    it('should return cached public key when loaded from DB', async () => {
      mockDatabase.instanceSettings.findFirst.mockResolvedValue({
        id: 'settings-1',
        vapidPublicKey: 'db-public-key',
        vapidPrivateKey: 'db-private-key',
        vapidSubject: null,
      });

      await service.onModuleInit();

      expect(service.getVapidPublicKey()).toBe('db-public-key');
    });

    it('should return null when not configured', async () => {
      mockDatabase.instanceSettings.findFirst.mockRejectedValue(
        new Error('DB error'),
      );

      await service.onModuleInit();

      expect(service.getVapidPublicKey()).toBeNull();
    });
  });

  describe('subscribe', () => {
    const userId = 'user-123';
    const subscribeDto = {
      endpoint: 'https://push.example.com/abc123',
      keys: {
        p256dh: 'testP256dhKey',
        auth: 'testAuthKey',
      },
      userAgent: 'Mozilla/5.0 Test',
    };

    it('should upsert subscription in database', async () => {
      const mockSubscription = {
        id: 'sub-1',
        userId,
        endpoint: subscribeDto.endpoint,
        keys: subscribeDto.keys,
        userAgent: subscribeDto.userAgent,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockDatabase.pushSubscription.upsert.mockResolvedValue(mockSubscription);

      const result = await service.subscribe(userId, subscribeDto);

      expect(result).toEqual(mockSubscription);
      expect(mockDatabase.pushSubscription.upsert).toHaveBeenCalledWith({
        where: { endpoint: subscribeDto.endpoint },
        update: {
          userId,
          keys: subscribeDto.keys,
          userAgent: subscribeDto.userAgent,
          updatedAt: expect.any(Date),
        },
        create: {
          userId,
          endpoint: subscribeDto.endpoint,
          keys: subscribeDto.keys,
          userAgent: subscribeDto.userAgent,
        },
      });
    });
  });

  describe('unsubscribe', () => {
    it('should delete subscription from database', async () => {
      const userId = 'user-123';
      const endpoint = 'https://push.example.com/abc123';

      mockDatabase.pushSubscription.deleteMany.mockResolvedValue({ count: 1 });

      await service.unsubscribe(userId, endpoint);

      expect(mockDatabase.pushSubscription.deleteMany).toHaveBeenCalledWith({
        where: { userId, endpoint },
      });
    });
  });

  describe('getUserSubscriptions', () => {
    it('should return all subscriptions for user', async () => {
      const userId = 'user-123';
      const mockSubscriptions = [
        { id: 'sub-1', userId, endpoint: 'https://push1.example.com' },
        { id: 'sub-2', userId, endpoint: 'https://push2.example.com' },
      ];

      mockDatabase.pushSubscription.findMany.mockResolvedValue(
        mockSubscriptions,
      );

      const result = await service.getUserSubscriptions(userId);

      expect(result).toEqual(mockSubscriptions);
      expect(mockDatabase.pushSubscription.findMany).toHaveBeenCalledWith({
        where: { userId },
      });
    });
  });

  describe('sendToUser', () => {
    const userId = 'user-123';
    const payload = {
      title: 'Test Notification',
      body: 'Test body',
      tag: 'test-tag',
    };

    beforeEach(async () => {
      configService.get.mockImplementation((key: string) => {
        if (key === 'VAPID_PUBLIC_KEY') return mockVapidPublicKey;
        if (key === 'VAPID_PRIVATE_KEY') return mockVapidPrivateKey;
        return undefined;
      });
      await service.onModuleInit();
    });

    it('should return early when not configured', async () => {
      const unconfiguredService = new PushNotificationsService(
        configService as unknown as ConfigService,
        mockDatabase as unknown as DatabaseService,
      );
      // Don't call onModuleInit — service stays unconfigured

      const result = await unconfiguredService.sendToUser(userId, payload);

      expect(result).toEqual({ sent: 0, failed: 0 });
      expect(mockDatabase.pushSubscription.findMany).not.toHaveBeenCalled();
    });

    it('should return zeros when user has no subscriptions', async () => {
      mockDatabase.pushSubscription.findMany.mockResolvedValue([]);

      const result = await service.sendToUser(userId, payload);

      expect(result).toEqual({ sent: 0, failed: 0 });
    });

    it('should send to all user subscriptions', async () => {
      const mockSubscriptions = [
        {
          id: 'sub-1',
          userId,
          endpoint: 'https://push1.example.com',
          keys: { p256dh: 'key1', auth: 'auth1' },
        },
        {
          id: 'sub-2',
          userId,
          endpoint: 'https://push2.example.com',
          keys: { p256dh: 'key2', auth: 'auth2' },
        },
      ];

      mockDatabase.pushSubscription.findMany.mockResolvedValue(
        mockSubscriptions,
      );
      (webpush.sendNotification as jest.Mock).mockResolvedValue({});

      const result = await service.sendToUser(userId, payload);

      expect(result).toEqual({ sent: 2, failed: 0 });
      expect(webpush.sendNotification).toHaveBeenCalledTimes(2);
    });

    it('should remove expired subscriptions (410 status)', async () => {
      const mockSubscription = {
        id: 'sub-1',
        userId,
        endpoint: 'https://push.example.com',
        keys: { p256dh: 'key1', auth: 'auth1' },
      };

      mockDatabase.pushSubscription.findMany.mockResolvedValue([
        mockSubscription,
      ]);
      (webpush.sendNotification as jest.Mock).mockRejectedValue({
        statusCode: 410,
      });
      mockDatabase.pushSubscription.delete.mockResolvedValue(mockSubscription);

      const result = await service.sendToUser(userId, payload);

      expect(result).toEqual({ sent: 0, failed: 1 });
      expect(mockDatabase.pushSubscription.delete).toHaveBeenCalledWith({
        where: { id: 'sub-1' },
      });
    });

    it('should remove not found subscriptions (404 status)', async () => {
      const mockSubscription = {
        id: 'sub-1',
        userId,
        endpoint: 'https://push.example.com',
        keys: { p256dh: 'key1', auth: 'auth1' },
      };

      mockDatabase.pushSubscription.findMany.mockResolvedValue([
        mockSubscription,
      ]);
      (webpush.sendNotification as jest.Mock).mockRejectedValue({
        statusCode: 404,
      });
      mockDatabase.pushSubscription.delete.mockResolvedValue(mockSubscription);

      const result = await service.sendToUser(userId, payload);

      expect(result).toEqual({ sent: 0, failed: 1 });
      expect(mockDatabase.pushSubscription.delete).toHaveBeenCalledWith({
        where: { id: 'sub-1' },
      });
    });
  });

  describe('cleanupExpiredSubscriptions', () => {
    it('should delete subscriptions older than 30 days', async () => {
      mockDatabase.pushSubscription.deleteMany.mockResolvedValue({ count: 5 });

      const result = await service.cleanupExpiredSubscriptions();

      expect(result).toBe(5);
      expect(mockDatabase.pushSubscription.deleteMany).toHaveBeenCalledWith({
        where: {
          updatedAt: {
            lt: expect.any(Date),
          },
        },
      });

      // Verify the date is approximately 30 days ago
      const callArgs =
        mockDatabase.pushSubscription.deleteMany.mock.calls[0][0];
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const calledDate = callArgs.where.updatedAt.lt as Date;

      // Should be within a few seconds of 30 days ago
      expect(
        Math.abs(calledDate.getTime() - thirtyDaysAgo.getTime()),
      ).toBeLessThan(5000);
    });
  });
});
