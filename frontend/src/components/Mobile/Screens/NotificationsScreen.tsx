/**
 * NotificationsScreen Component
 *
 * Shows list of notifications (mentions, DMs, etc.)
 * Allows marking as read, dismissing, and navigating to source.
 */

import React from 'react';
import {
  Box,
  Typography,
  List,
  ListItem,
  ListItemButton,
  ListItemAvatar,
  ListItemText,
  Avatar,
  IconButton,
  CircularProgress,
  Button,
  Chip,
  Divider,
} from '@mui/material';
import {
  CheckCircle as CheckIcon,
  Close as DismissIcon,
  AlternateEmail as MentionIcon,
  Chat as DmIcon,
  Tag as ChannelIcon,
} from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  notificationsControllerGetNotificationsOptions,
  notificationsControllerMarkAsReadMutation,
  notificationsControllerMarkAllAsReadMutation,
  notificationsControllerDismissNotificationMutation,
} from '../../../api-client/@tanstack/react-query.gen';

import { useMobileNavigation } from '../Navigation/MobileNavigationContext';
import { TOUCH_TARGETS } from '../../../utils/breakpoints';
import { NotificationType, Notification } from '../../../types/notification.type';
import MobileAppBar from '../MobileAppBar';
import { formatDistanceToNow } from 'date-fns';
import { logger } from '../../../utils/logger';

/**
 * Get icon for notification type
 */
const getNotificationIcon = (type: NotificationType) => {
  switch (type) {
    case NotificationType.USER_MENTION:
    case NotificationType.SPECIAL_MENTION:
      return <MentionIcon />;
    case NotificationType.DIRECT_MESSAGE:
      return <DmIcon />;
    case NotificationType.CHANNEL_MESSAGE:
      return <ChannelIcon />;
    default:
      return <MentionIcon />;
  }
};

/**
 * Get display text for notification type
 */
const getNotificationTypeLabel = (type: NotificationType): string => {
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

/**
 * Extract preview text from message spans
 */
const getMessagePreview = (notification: Notification): string => {
  if (!notification.message?.spans) return '';

  const textSpans = notification.message.spans.filter((s) => s.type === 'PLAINTEXT');
  const text = textSpans.map((s) => s.text || '').join(' ').trim();

  if (text.length > 100) {
    return text.substring(0, 100) + '...';
  }
  return text;
};

interface NotificationItemProps {
  notification: Notification;
  onMarkRead: (id: string) => void;
  onDismiss: (id: string) => void;
  onClick: (notification: Notification) => void;
}

const NotificationItem: React.FC<NotificationItemProps> = ({
  notification,
  onMarkRead,
  onDismiss,
  onClick,
}) => {
  const preview = getMessagePreview(notification);
  const timeAgo = formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true });

  return (
    <ListItem
      disablePadding
      secondaryAction={
        <Box sx={{ display: 'flex', gap: 0.5 }}>
          {!notification.read && (
            <IconButton
              edge="end"
              size="small"
              onClick={(e) => {
                e.stopPropagation();
                onMarkRead(notification.id);
              }}
              aria-label="Mark as read"
            >
              <CheckIcon fontSize="small" />
            </IconButton>
          )}
          <IconButton
            edge="end"
            size="small"
            onClick={(e) => {
              e.stopPropagation();
              onDismiss(notification.id);
            }}
            aria-label="Dismiss"
          >
            <DismissIcon fontSize="small" />
          </IconButton>
        </Box>
      }
    >
      <ListItemButton
        onClick={() => onClick(notification)}
        sx={{
          minHeight: TOUCH_TARGETS.RECOMMENDED,
          pr: 10, // Room for action buttons
          backgroundColor: notification.read ? 'transparent' : 'action.hover',
        }}
      >
        <ListItemAvatar>
          <Avatar
            src={notification.author?.avatarUrl || undefined}
            sx={{
              bgcolor: notification.read ? 'grey.500' : 'primary.main',
              width: 44,
              height: 44,
            }}
          >
            {getNotificationIcon(notification.type)}
          </Avatar>
        </ListItemAvatar>
        <ListItemText
          primary={
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
              <Typography
                component="span"
                fontWeight={notification.read ? 400 : 600}
                fontSize="0.9375rem"
              >
                {notification.author?.username || 'Someone'}
              </Typography>
              <Typography
                component="span"
                variant="body2"
                color="text.secondary"
              >
                {getNotificationTypeLabel(notification.type)}
              </Typography>
            </Box>
          }
          secondary={
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
              {preview && (
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {preview}
                </Typography>
              )}
              <Typography variant="caption" color="text.secondary">
                {timeAgo}
              </Typography>
            </Box>
          }
        />
      </ListItemButton>
    </ListItem>
  );
};

/**
 * Notifications screen - Shows list of notifications
 * Default screen for the Notifications tab
 */
export const NotificationsScreen: React.FC = () => {
  const { navigateToDmChat } = useMobileNavigation();
  const queryClient = useQueryClient();

  const { data, isLoading, refetch } = useQuery(
    notificationsControllerGetNotificationsOptions({ query: { limit: 50 } })
  );

  const { mutateAsync: markAsRead } = useMutation({
    ...notificationsControllerMarkAsReadMutation(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [{ _id: 'notificationsControllerGetNotifications' }] });
      queryClient.invalidateQueries({ queryKey: [{ _id: 'notificationsControllerGetUnreadCount' }] });
    },
  });

  const { mutateAsync: markAllAsRead, isPending: isMarkingAllRead } = useMutation({
    ...notificationsControllerMarkAllAsReadMutation(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [{ _id: 'notificationsControllerGetNotifications' }] });
      queryClient.invalidateQueries({ queryKey: [{ _id: 'notificationsControllerGetUnreadCount' }] });
    },
  });

  const { mutateAsync: dismissNotification } = useMutation({
    ...notificationsControllerDismissNotificationMutation(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [{ _id: 'notificationsControllerGetNotifications' }] });
      queryClient.invalidateQueries({ queryKey: [{ _id: 'notificationsControllerGetUnreadCount' }] });
    },
  });

  const notifications = data?.notifications || [];
  const unreadCount = data?.unreadCount || 0;

  const handleMarkRead = async (notificationId: string) => {
    try {
      await markAsRead({ path: { id: notificationId } });
    } catch (error) {
      logger.error('Failed to mark notification as read:', error);
    }
  };

  const handleDismiss = async (notificationId: string) => {
    try {
      await dismissNotification({ path: { id: notificationId } });
    } catch (error) {
      logger.error('Failed to dismiss notification:', error);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await markAllAsRead({});
    } catch (error) {
      logger.error('Failed to mark all as read:', error);
    }
  };

  const handleNotificationClick = (notification: Notification) => {
    // Mark as read when clicked
    if (!notification.read) {
      handleMarkRead(notification.id);
    }

    // Navigate to the source
    if (notification.directMessageGroupId) {
      navigateToDmChat(notification.directMessageGroupId);
    } else if (notification.channelId) {
      // For channel notifications, we'd need the communityId
      // This is a limitation - we may need to enhance the notification API
      // For now, we could fetch the channel to get the community ID
      // Or we could add communityId to the notification payload
      logger.dev('Navigate to channel:', notification.channelId);
    }
  };

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* App bar */}
      <MobileAppBar
        title="Notifications"
        actions={
          unreadCount > 0 && (
            <Chip
              label={unreadCount > 99 ? '99+' : unreadCount}
              size="small"
              color="primary"
              sx={{ mr: 1 }}
            />
          )
        }
      />

      {/* Mark all as read button */}
      {unreadCount > 0 && (
        <Box sx={{ px: 2, py: 1, display: 'flex', justifyContent: 'flex-end' }}>
          <Button
            size="small"
            onClick={handleMarkAllRead}
            disabled={isMarkingAllRead}
            startIcon={isMarkingAllRead ? <CircularProgress size={16} /> : <CheckIcon />}
          >
            Mark all as read
          </Button>
        </Box>
      )}

      {unreadCount > 0 && <Divider />}

      {/* Notification list */}
      {isLoading ? (
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            flex: 1,
          }}
        >
          <CircularProgress />
        </Box>
      ) : notifications.length === 0 ? (
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            flex: 1,
            gap: 2,
            p: 3,
          }}
        >
          <Box sx={{ fontSize: 64, opacity: 0.5 }}>🔔</Box>
          <Typography variant="h6" color="text.secondary">
            No notifications
          </Typography>
          <Typography variant="body2" color="text.secondary" textAlign="center">
            You'll see mentions, replies, and direct messages here.
          </Typography>
          <Button variant="outlined" onClick={() => refetch()}>
            Refresh
          </Button>
        </Box>
      ) : (
        <Box
          sx={{
            flex: 1,
            overflowY: 'auto',
          }}
        >
          <List disablePadding>
            {notifications.map((notification) => (
              <NotificationItem
                key={notification.id}
                notification={notification}
                onMarkRead={handleMarkRead}
                onDismiss={handleDismiss}
                onClick={handleNotificationClick}
              />
            ))}
          </List>
        </Box>
      )}
    </Box>
  );
};

export default NotificationsScreen;
