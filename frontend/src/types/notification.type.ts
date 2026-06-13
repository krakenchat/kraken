/**
 * Notification Types
 *
 * Type definitions for the notifications system matching backend Prisma models.
 */

import { NotificationType } from '@semaphore-chat/shared';
import type { NotificationDto } from '../api-client/types.gen';

export { NotificationType, type NewNotificationPayload, type NotificationReadPayload } from '@semaphore-chat/shared';

export interface Notification {
  id: string;
  userId: string;
  // Accepts both the shared enum and the generated API client's literal union
  // so NotificationDto values are assignable to Notification.
  type: NotificationType | NotificationDto['type'];
  messageId: string | null;
  channelId: string | null;
  directMessageGroupId: string | null;
  communityId?: string | null;
  authorId: string;
  read: boolean;
  dismissed: boolean;
  createdAt: string;

  // Populated relations
  author?: {
    id: string;
    username: string;
    displayName?: string | null;
    avatarUrl?: string | null;
  };
  message?: {
    id: string;
    spans: Array<{
      type: string;
      text?: string | null;
      userId?: string | null;
      specialKind?: string | null;
    }>;
  } | null;
}

export interface UserNotificationSettings {
  id: string;
  userId: string;
  desktopEnabled: boolean;
  playSound: boolean;
  soundType: 'default' | 'mention' | 'dm';
  doNotDisturb: boolean;
  dndStartTime: string | null; // "22:00"
  dndEndTime: string | null; // "08:00"
  defaultChannelLevel: 'all' | 'mentions' | 'none';
  dmNotifications: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ChannelNotificationOverride {
  id: string;
  userId: string;
  channelId: string;
  level: 'all' | 'mentions' | 'none';
  createdAt: string;
  updatedAt: string;
}

export interface NotificationQueryParams {
  limit?: number;
  offset?: number;
  unreadOnly?: boolean;
}

export interface NotificationListResponse {
  notifications: Notification[];
  total: number;
  unreadCount: number;
}

export interface UpdateNotificationSettingsDto {
  desktopEnabled?: boolean;
  playSound?: boolean;
  soundType?: 'default' | 'mention' | 'dm';
  doNotDisturb?: boolean;
  dndStartTime?: string; // HH:mm format
  dndEndTime?: string; // HH:mm format
  defaultChannelLevel?: 'all' | 'mentions' | 'none';
  dmNotifications?: boolean;
}

export interface UpdateChannelOverrideDto {
  level: 'all' | 'mentions' | 'none';
}
