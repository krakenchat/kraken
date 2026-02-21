import { formatDistanceToNow } from 'date-fns';
import { NotificationType } from '../types/notification.type';
import type { Notification } from '../types/notification.type';

/** Formatted "time ago" string, e.g. "2 minutes ago" */
export const getTimeAgo = (createdAt: string): string => {
  try {
    return formatDistanceToNow(new Date(createdAt), { addSuffix: true });
  } catch {
    return 'Recently';
  }
};

/** Human-readable label for notification type */
export const getNotificationTypeLabel = (type: NotificationType): string => {
  switch (type) {
    case NotificationType.USER_MENTION:
      return 'Mentioned you';
    case NotificationType.SPECIAL_MENTION:
      return 'Mentioned @everyone/@here';
    case NotificationType.DIRECT_MESSAGE:
      return 'Sent a message';
    case NotificationType.CHANNEL_MESSAGE:
      return 'New message';
    default:
      return 'Notification';
  }
};

/** Single-line notification summary combining author + action + preview */
export const getNotificationText = (notification: Notification): string => {
  const authorName = notification.author?.username || 'Someone';
  const messageText = getMessagePreview(notification);

  switch (notification.type) {
    case NotificationType.USER_MENTION:
      return messageText ? `${authorName} mentioned you: ${messageText}` : `${authorName} mentioned you`;
    case NotificationType.SPECIAL_MENTION:
      return messageText ? `${authorName} mentioned everyone: ${messageText}` : `${authorName} mentioned everyone`;
    case NotificationType.DIRECT_MESSAGE:
      return `${authorName}: ${messageText || 'New message'}`;
    case NotificationType.CHANNEL_MESSAGE:
      return `${authorName}: ${messageText || 'New message'}`;
    default:
      return 'New notification';
  }
};

/** Extract plain text preview from message spans, truncated to 100 chars */
export const getMessagePreview = (notification: Notification): string => {
  if (!notification.message?.spans) return '';

  const text = notification.message.spans
    .filter((s) => s.type === 'PLAINTEXT')
    .map((s) => s.text || '')
    .join('')
    .trim();

  return text.length > 100 ? text.substring(0, 100) + '...' : text;
};
