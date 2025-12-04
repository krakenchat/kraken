import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { PushNotificationsService } from './push-notifications.service';
import { DatabaseService } from '@/database/database.service';
import { createMockDatabase } from '@/test-utils';
import * as webpush from 'web-push';

// Mock web-push module
jest.mock('web-push', () => ({
  setVapidDetails: jest.fn(),
  sendNotification: jest.fn(),
}));

describe('PushNotificationsService', () => {
  let service: PushNotificationsService;
  let mockDatabase: ReturnType<typeof createMockDatabase>;
  let mockConfigService: { get: jest.Mock };

  const mockVapidPublicKey = 'BNxFj3IxG...testPublicKey';
  const mockVapidPrivateKey = 'testPrivateKey123';

  beforeEach(async () => {
    mockDatabase = createMockDatabase();
    mockConfigService = {
      get: jest.fn((key: string) => {
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
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PushNotificationsService,
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
        {
          provide: DatabaseService,
          useValue: mockDatabase,
        },
      ],
    }).compile();

    service = module.get<PushNotificationsService>(PushNotificationsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('onModuleInit', () => {
    it('should configure VAPID when keys are present', () => {
      service.onModuleInit();

      expect(webpush.setVapidDetails).toHaveBeenCalledWith(
        'mailto:test@example.com',
        mockVapidPublicKey,
        mockVapidPrivateKey,
      );
      expect(service.isEnabled()).toBe(true);
    });

    it('should not configure VAPID when keys are missing', () => {
      mockConfigService.get.mockReturnValue(undefined);

      service.onModuleInit();

      expect(webpush.setVapidDetails).not.toHaveBeenCalled();
      expect(service.isEnabled()).toBe(false);
    });

    it('should use default subject when not configured', () => {
      mockConfigService.get.mockImplementation((key: string) => {
        if (key === 'VAPID_PUBLIC_KEY') return mockVapidPublicKey;
        if (key === 'VAPID_PRIVATE_KEY') return mockVapidPrivateKey;
        return undefined;
      });

      service.onModuleInit();

      expect(webpush.setVapidDetails).toHaveBeenCalledWith(
        'mailto:admin@localhost',
        mockVapidPublicKey,
        mockVapidPrivateKey,
      );
    });
  });

  describe('getVapidPublicKey', () => {
    it('should return public key when configured', () => {
      service.onModuleInit();

      const result = service.getVapidPublicKey();

      expect(result).toBe(mockVapidPublicKey);
    });

    it('should return null when not configured', () => {
      mockConfigService.get.mockReturnValue(undefined);
      service.onModuleInit();

      const result = service.getVapidPublicKey();

      expect(result).toBeNull();
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

      mockDatabase.pushSubscription.findMany.mockResolvedValue(mockSubscriptions);

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

    beforeEach(() => {
      service.onModuleInit();
    });

    it('should return early when not configured', async () => {
      mockConfigService.get.mockReturnValue(undefined);
      const unconfiguredService = new PushNotificationsService(
        mockConfigService as unknown as ConfigService,
        mockDatabase as unknown as DatabaseService,
      );
      unconfiguredService.onModuleInit();

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

      mockDatabase.pushSubscription.findMany.mockResolvedValue(mockSubscriptions);
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

      mockDatabase.pushSubscription.findMany.mockResolvedValue([mockSubscription]);
      (webpush.sendNotification as jest.Mock).mockRejectedValue({ statusCode: 410 });
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

      mockDatabase.pushSubscription.findMany.mockResolvedValue([mockSubscription]);
      (webpush.sendNotification as jest.Mock).mockRejectedValue({ statusCode: 404 });
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
      const callArgs = mockDatabase.pushSubscription.deleteMany.mock.calls[0][0];
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const calledDate = callArgs.where.updatedAt.lt as Date;

      // Should be within a few seconds of 30 days ago
      expect(Math.abs(calledDate.getTime() - thirtyDaysAgo.getTime())).toBeLessThan(5000);
    });
  });
});
