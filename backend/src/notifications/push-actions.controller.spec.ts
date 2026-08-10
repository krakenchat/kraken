import { TestBed } from '@suites/unit';
import type { Mocked } from '@suites/doubles.jest';
import { UnauthorizedException } from '@nestjs/common';
import { PushActionsController } from './push-actions.controller';
import { NotificationsService } from './notifications.service';
import { PushNotificationsService } from '@/push-notifications/push-notifications.service';

describe('PushActionsController', () => {
  let controller: PushActionsController;
  let notificationsService: Mocked<NotificationsService>;
  let pushNotificationsService: Mocked<PushNotificationsService>;

  beforeEach(async () => {
    const { unit, unitRef } = await TestBed.solitary(
      PushActionsController,
    ).compile();

    controller = unit;
    notificationsService = unitRef.get(NotificationsService);
    pushNotificationsService = unitRef.get(PushNotificationsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('markRead', () => {
    it('should mark the notification as read when the token is valid', async () => {
      const userId = 'user-123';
      const notificationId = 'notification-456';
      pushNotificationsService.verifyActionToken.mockReturnValue({
        userId,
        notificationId,
      });
      notificationsService.markAsRead.mockResolvedValue({} as any);

      const result = await controller.markRead({ token: 'valid-token' });

      expect(pushNotificationsService.verifyActionToken).toHaveBeenCalledWith(
        'valid-token',
      );
      expect(notificationsService.markAsRead).toHaveBeenCalledWith(
        notificationId,
        userId,
      );
      expect(result).toEqual({
        success: true,
        message: 'Notification marked as read',
      });
    });

    it('should throw UnauthorizedException and not call markAsRead when the token is invalid', async () => {
      pushNotificationsService.verifyActionToken.mockReturnValue(null);

      await expect(
        controller.markRead({ token: 'invalid-token' }),
      ).rejects.toThrow(UnauthorizedException);

      expect(notificationsService.markAsRead).not.toHaveBeenCalled();
    });
  });
});
