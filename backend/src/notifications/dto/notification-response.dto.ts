import { NotificationType } from '@prisma/client';

export class NotificationAuthorDto {
  id: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
}

export class NotificationMessageDto {
  id: string;
  content: string;
}

export class NotificationDto {
  id: string;
  userId: string;
  type: NotificationType;
  messageId: string | null;
  channelId: string | null;
  directMessageGroupId: string | null;
  authorId: string;
  parentMessageId: string | null;
  read: boolean;
  dismissed: boolean;
  createdAt: Date;
  author?: NotificationAuthorDto;
  message?: NotificationMessageDto | null;
}

export class NotificationListResponseDto {
  notifications: NotificationDto[];
  total: number;
  unreadCount: number;
}

export class UnreadCountResponseDto {
  count: number;
}

export class DebugNotificationResponseDto {
  success: boolean;
  notification: NotificationDto;
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
