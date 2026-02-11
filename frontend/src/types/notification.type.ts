/**
 * Notification Types
 *
 * Type definitions for the notifications system matching backend Prisma models.
 */

import { NotificationType } from '@kraken/shared';

export { NotificationType, type NewNotificationPayload, type NotificationReadPayload } from '@kraken/shared';

export interface Notification {
  id: string;
  userId: string;
  type: NotificationType;
  messageId: string | null;
  channelId: string | null;
  directMessageGroupId: string | null;
  authorId: string;
  read: boolean;
  dismissed: boolean;
  createdAt: string;

  // Populated relations
  author?: {
    id: string;
    username: string;
    avatarUrl?: string;
  };
  message?: {
    id: string;
    spans: Array<{
      type: string;
      text?: string;
      userId?: string;
      specialKind?: string;
    }>;
  };
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
