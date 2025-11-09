import { Test, TestingModule } from '@nestjs/testing';
import { PresenceController } from './presence.controller';
import { PresenceService } from './presence.service';
import { JwtAuthGuard } from '@/auth/jwt-auth.guard';
import { RbacGuard } from '@/auth/rbac.guard';
import { UserFactory } from '@/test-utils';

describe('PresenceController', () => {
  let controller: PresenceController;
  let presenceService: PresenceService;

  const mockPresenceService = {
    isOnline: jest.fn(),
    getOnlineUsers: jest.fn(),
  };

  const mockGuard = { canActivate: jest.fn(() => true) };

  const mockUsers = [
    UserFactory.build(),
    UserFactory.build(),
    UserFactory.build(),
  ];

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PresenceController],
      providers: [
        {
          provide: PresenceService,
          useValue: mockPresenceService,
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue(mockGuard)
      .overrideGuard(RbacGuard)
      .useValue(mockGuard)
      .compile();

    controller = module.get<PresenceController>(PresenceController);
    presenceService = module.get<PresenceService>(PresenceService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getUserPresence', () => {
    it('should return user presence when user is online', async () => {
      const userId = mockUsers[0].id;
      jest.spyOn(presenceService, 'isOnline').mockResolvedValue(true);

      const result = await controller.getUserPresence(userId);

      expect(result).toEqual({
        userId,
        isOnline: true,
      });
      expect(presenceService.isOnline).toHaveBeenCalledWith(userId);
    });

    it('should return user presence when user is offline', async () => {
      const userId = mockUsers[0].id;
      jest.spyOn(presenceService, 'isOnline').mockResolvedValue(false);

      const result = await controller.getUserPresence(userId);

      expect(result).toEqual({
        userId,
        isOnline: false,
      });
    });

    it('should include userId in response', async () => {
      const userId = 'test-user-123';
      jest.spyOn(presenceService, 'isOnline').mockResolvedValue(true);

      const result = await controller.getUserPresence(userId);

      expect(result.userId).toBe(userId);
    });
  });

  describe('getBulkPresence', () => {
    it('should return presence for all online users', async () => {
      const onlineUserIds = [mockUsers[0].id, mockUsers[1].id];
      jest
        .spyOn(presenceService, 'getOnlineUsers')
        .mockResolvedValue(onlineUserIds);

      const result = await controller.getBulkPresence();

      expect(result.presence).toEqual({
        [onlineUserIds[0]]: true,
        [onlineUserIds[1]]: true,
      });
      expect(presenceService.getOnlineUsers).toHaveBeenCalled();
    });

    it('should return empty object when no users are online', async () => {
      jest.spyOn(presenceService, 'getOnlineUsers').mockResolvedValue([]);

      const result = await controller.getBulkPresence();

      expect(result.presence).toEqual({});
    });

    it('should mark all returned users as online', async () => {
      const onlineUserIds = [mockUsers[0].id, mockUsers[1].id, mockUsers[2].id];
      jest
        .spyOn(presenceService, 'getOnlineUsers')
        .mockResolvedValue(onlineUserIds);

      const result = await controller.getBulkPresence();

      // All users should be marked as true (online)
      expect(Object.values(result.presence).every((v) => v === true)).toBe(
        true,
      );
    });
  });

  describe('getMultipleUserPresence', () => {
    it('should return presence for multiple users', async () => {
      const user1 = mockUsers[0].id;
      const user2 = mockUsers[1].id;
      const userIds = `${user1},${user2}`;

      jest
        .spyOn(presenceService, 'isOnline')
        .mockResolvedValueOnce(true) // user1
        .mockResolvedValueOnce(false); // user2

      const result = await controller.getMultipleUserPresence(userIds);

      expect(result.presence).toEqual({
        [user1]: true,
        [user2]: false,
      });
      expect(presenceService.isOnline).toHaveBeenCalledTimes(2);
      expect(presenceService.isOnline).toHaveBeenCalledWith(user1);
      expect(presenceService.isOnline).toHaveBeenCalledWith(user2);
    });

    it('should handle single user ID', async () => {
      const userId = mockUsers[0].id;
      jest.spyOn(presenceService, 'isOnline').mockResolvedValue(true);

      const result = await controller.getMultipleUserPresence(userId);

      expect(result.presence).toEqual({
        [userId]: true,
      });
      expect(presenceService.isOnline).toHaveBeenCalledTimes(1);
    });

    it('should split comma-separated user IDs correctly', async () => {
      const user1 = 'user-1';
      const user2 = 'user-2';
      const user3 = 'user-3';
      const userIds = `${user1},${user2},${user3}`;

      jest.spyOn(presenceService, 'isOnline').mockResolvedValue(true);

      await controller.getMultipleUserPresence(userIds);

      expect(presenceService.isOnline).toHaveBeenCalledTimes(3);
      expect(presenceService.isOnline).toHaveBeenCalledWith(user1);
      expect(presenceService.isOnline).toHaveBeenCalledWith(user2);
      expect(presenceService.isOnline).toHaveBeenCalledWith(user3);
    });

    it('should handle mixed online/offline status', async () => {
      const user1 = 'online-user';
      const user2 = 'offline-user';
      const user3 = 'also-online';
      const userIds = `${user1},${user2},${user3}`;

      jest
        .spyOn(presenceService, 'isOnline')
        .mockResolvedValueOnce(true) // user1
        .mockResolvedValueOnce(false) // user2
        .mockResolvedValueOnce(true); // user3

      const result = await controller.getMultipleUserPresence(userIds);

      expect(result.presence).toEqual({
        [user1]: true,
        [user2]: false,
        [user3]: true,
      });
    });

    it('should handle empty user IDs gracefully', async () => {
      jest.spyOn(presenceService, 'isOnline').mockResolvedValue(false);

      const result = await controller.getMultipleUserPresence('');

      expect(result.presence).toEqual({
        '': false,
      });
      expect(presenceService.isOnline).toHaveBeenCalledWith('');
    });
  });
});
