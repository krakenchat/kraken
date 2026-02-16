import { NotificationType } from '@prisma/client';
import { ApiProperty } from '@nestjs/swagger';
import { NotificationTypeValues } from '@/common/enums/swagger-enums';
import { SpanDto } from '@/messages/dto/message-response.dto';

export class UserNotificationSettingsDto {
  id: string;
  userId: string;
  desktopEnabled: boolean;
  playSound: boolean;
  soundType: string;
  doNotDisturb: boolean;
  dndStartTime: string | null;
  dndEndTime: string | null;
  defaultChannelLevel: string;
  dmNotifications: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export class ChannelNotificationOverrideDto {
  id: string;
  userId: string;
  channelId: string;
  level: string;
  createdAt: Date;
  updatedAt: Date;
}

export class NotificationAuthorDto {
  id: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
}

export class NotificationMessageDto {
  id: string;
  @ApiProperty({ type: [SpanDto] })
  spans: SpanDto[];
  channelId: string | null;
  directMessageGroupId: string | null;
}

export class NotificationDto {
  id: string;
  userId: string;
  @ApiProperty({ enum: NotificationTypeValues })
  type: NotificationType;
  messageId: string | null;
  channelId: string | null;
  directMessageGroupId: string | null;
  communityId?: string | null;
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

export class DebugPushSubscriptionDto {
  endpoint: string;
  createdAt: Date;
}

export class DebugSubscriptionsResponseDto {
  @ApiProperty({ type: [DebugPushSubscriptionDto] })
  subscriptions: DebugPushSubscriptionDto[];
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
