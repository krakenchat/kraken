export enum NotificationType {
  USER_MENTION = 'USER_MENTION',
  SPECIAL_MENTION = 'SPECIAL_MENTION',
  DIRECT_MESSAGE = 'DIRECT_MESSAGE',
  CHANNEL_MESSAGE = 'CHANNEL_MESSAGE',
}

/**
 * WebSocket event payload for new notifications
 */
export interface NewNotificationPayload {
  notificationId: string;
  type: NotificationType;
  messageId: string | null;
  channelId: string | null;
  communityId: string | null;
  channelName: string | null;
  directMessageGroupId: string | null;
  authorId: string;
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
  createdAt: string;
  read: boolean;
}

/**
 * WebSocket event payload for notification read status
 */
export interface NotificationReadPayload {
  notificationId: string;
}
