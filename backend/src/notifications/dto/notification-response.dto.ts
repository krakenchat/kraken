import { Notification } from '@prisma/client';

export class NotificationListResponseDto {
  notifications: Notification[];
  total: number;
  unreadCount: number;
}

export class UnreadCountResponseDto {
  count: number;
}

export class DebugNotificationResponseDto {
  success: boolean;
  notification: Notification;
  message: string;
}

export class DebugSubscriptionsResponseDto {
  subscriptions: any[];
  count: number;
  pushEnabled: boolean;
}

export class ClearNotificationDataResponseDto {
  success: boolean;
  notificationsDeleted: number;
  settingsDeleted: number;
  overridesDeleted: number;
  message: string;
}
