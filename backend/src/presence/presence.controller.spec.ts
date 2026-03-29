import { TestBed } from '@suites/unit';
import type { Mocked } from '@suites/doubles.jest';
import { PresenceController } from './presence.controller';
import { PresenceService } from './presence.service';
import { UserFactory } from '@/test-utils';

describe('PresenceController', () => {
  let controller: PresenceController;
  let presenceService: Mocked<PresenceService>;

  const mockUsers = [
    UserFactory.build({ id: '00000000-0000-4000-a000-000000000001' }),
    UserFactory.build({ id: '00000000-0000-4000-a000-000000000002' }),
    UserFactory.build({ id: '00000000-0000-4000-a000-000000000003' }),
  ];

  beforeEach(async () => {
    const { unit, unitRef } =
      await TestBed.solitary(PresenceController).compile();

    controller = unit;
    presenceService = unitRef.get(PresenceService);
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
      presenceService.isOnline.mockResolvedValue(true);

      const result = await controller.getUserPresence(userId);

      expect(result).toEqual({
        userId,
        isOnline: true,
      });
      expect(presenceService.isOnline).toHaveBeenCalledWith(userId);
    });

    it('should return user presence when user is offline', async () => {
      const userId = mockUsers[0].id;
      presenceService.isOnline.mockResolvedValue(false);

      const result = await controller.getUserPresence(userId);

      expect(result).toEqual({
        userId,
        isOnline: false,
      });
    });

    it('should include userId in response', async () => {
      const userId = 'test-user-123';
      presenceService.isOnline.mockResolvedValue(true);

      const result = await controller.getUserPresence(userId);

      expect(result.userId).toBe(userId);
    });
  });

  describe('getBulkPresence', () => {
    it('should return presence for all online users', async () => {
      const onlineUserIds = [mockUsers[0].id, mockUsers[1].id];
      presenceService.getOnlineUsers.mockResolvedValue(onlineUserIds);

      const result = await controller.getBulkPresence();

      expect(result.presence).toEqual({
        [onlineUserIds[0]]: true,
        [onlineUserIds[1]]: true,
      });
      expect(presenceService.getOnlineUsers).toHaveBeenCalled();
    });

    it('should return empty object when no users are online', async () => {
      presenceService.getOnlineUsers.mockResolvedValue([]);

      const result = await controller.getBulkPresence();

      expect(result.presence).toEqual({});
    });

    it('should mark all returned users as online', async () => {
      const onlineUserIds = [mockUsers[0].id, mockUsers[1].id, mockUsers[2].id];
      presenceService.getOnlineUsers.mockResolvedValue(onlineUserIds);

      const result = await controller.getBulkPresence();

      // All users should be marked as true (online)
      expect(Object.values(result.presence).every((v) => v === true)).toBe(
        true,
      );
    });
  });

  describe('getMultipleUserPresence', () => {
    it('should return presence for multiple users via areOnline', async () => {
      const user1 = mockUsers[0].id;
      const user2 = mockUsers[1].id;
      const userIds = `${user1},${user2}`;

      presenceService.areOnline.mockResolvedValue({
        [user1]: true,
        [user2]: false,
      });

      const result = await controller.getMultipleUserPresence(userIds);

      expect(result.presence).toEqual({
        [user1]: true,
        [user2]: false,
      });
      expect(presenceService.areOnline).toHaveBeenCalledWith([user1, user2]);
    });

    it('should handle single user ID', async () => {
      const userId = mockUsers[0].id;
      presenceService.areOnline.mockResolvedValue({ [userId]: true });

      const result = await controller.getMultipleUserPresence(userId);

      expect(result.presence).toEqual({
        [userId]: true,
      });
      expect(presenceService.areOnline).toHaveBeenCalledWith([userId]);
    });

    it('should filter out non-UUID values', async () => {
      const validId = mockUsers[0].id;
      const userIds = `${validId},not-a-uuid,,,also-invalid`;

      presenceService.areOnline.mockResolvedValue({ [validId]: true });

      const result = await controller.getMultipleUserPresence(userIds);

      expect(result.presence).toEqual({ [validId]: true });
      expect(presenceService.areOnline).toHaveBeenCalledWith([validId]);
    });

    it('should handle mixed online/offline status', async () => {
      const user1 = mockUsers[0].id;
      const user2 = mockUsers[1].id;
      const user3 = mockUsers[2].id;
      const userIds = `${user1},${user2},${user3}`;

      presenceService.areOnline.mockResolvedValue({
        [user1]: true,
        [user2]: false,
        [user3]: true,
      });

      const result = await controller.getMultipleUserPresence(userIds);

      expect(result.presence).toEqual({
        [user1]: true,
        [user2]: false,
        [user3]: true,
      });
    });

    it('should handle empty user IDs gracefully', async () => {
      presenceService.areOnline.mockResolvedValue({});

      const result = await controller.getMultipleUserPresence('');

      expect(result.presence).toEqual({});
      expect(presenceService.areOnline).toHaveBeenCalledWith([]);
    });
  });
});
