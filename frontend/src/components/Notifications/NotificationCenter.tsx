/**
 * NotificationCenter Component
 *
 * Drawer component that displays a list of notifications with actions.
 * Supports marking as read, dismissing, and navigating to related content.
 */

import React, { useEffect } from 'react';
import {
  Drawer,
  Box,
  Typography,
  IconButton,
  List,
  ListItem,
  ListItemText,
  ListItemAvatar,
  Avatar,
  Button,
  Divider,
  CircularProgress,
  Alert,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import CheckIcon from '@mui/icons-material/Check';
import DeleteIcon from '@mui/icons-material/Delete';
import {
  useGetNotificationsQuery,
  useMarkAsReadMutation,
  useMarkAllAsReadMutation,
  useDeleteNotificationMutation,
} from '../../features/notifications/notificationsApiSlice';
import { Notification, NotificationType } from '../../types/notification.type';
import { formatDistanceToNow } from 'date-fns';
import { logger } from '../../utils/logger';

interface NotificationCenterProps {
  open: boolean;
  onClose: () => void;
}

export const NotificationCenter: React.FC<NotificationCenterProps> = ({
  open,
  onClose,
}) => {
  const {
    data: notificationsData,
    isLoading,
    error,
    refetch,
  } = useGetNotificationsQuery({ limit: 50, unreadOnly: false });

  const [markAsRead] = useMarkAsReadMutation();
  const [markAllAsRead] = useMarkAllAsReadMutation();
  const [deleteNotification] = useDeleteNotificationMutation();

  // Refetch notifications when drawer opens
  useEffect(() => {
    if (open) {
      refetch();
    }
  }, [open, refetch]);

  const handleMarkAsRead = async (notificationId: string) => {
    try {
      await markAsRead(notificationId).unwrap();
    } catch (error) {
      logger.error('Failed to mark notification as read:', error);
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      await markAllAsRead().unwrap();
    } catch (error) {
      logger.error('Failed to mark all as read:', error);
    }
  };

  const handleDelete = async (notificationId: string) => {
    try {
      await deleteNotification(notificationId).unwrap();
    } catch (error) {
      logger.error('Failed to delete notification:', error);
    }
  };

  const getNotificationText = (notification: Notification): string => {
    const authorName = notification.author?.username || 'Someone';
    const messageText = notification.message?.spans
      ?.filter((span) => span.type === 'PLAINTEXT')
      .map((span) => span.text)
      .join('')
      .substring(0, 100);

    switch (notification.type) {
      case NotificationType.USER_MENTION:
        return `${authorName} mentioned you: ${messageText || ''}`;
      case NotificationType.SPECIAL_MENTION:
        return `${authorName} mentioned everyone: ${messageText || ''}`;
      case NotificationType.DIRECT_MESSAGE:
        return `${authorName}: ${messageText || 'New message'}`;
      case NotificationType.CHANNEL_MESSAGE:
        return `${authorName}: ${messageText || 'New message'}`;
      default:
        return 'New notification';
    }
  };

  const getTimeAgo = (createdAt: string): string => {
    try {
      return formatDistanceToNow(new Date(createdAt), { addSuffix: true });
    } catch {
      return 'Recently';
    }
  };

  const notifications = notificationsData?.notifications || [];
  const hasUnread = notifications.some((n) => !n.read);

  return (
    <Drawer anchor="right" open={open} onClose={onClose}>
      <Box sx={{ width: 400, height: '100%', display: 'flex', flexDirection: 'column' }}>
        {/* Header */}
        <Box
          sx={{
            p: 2,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: 1,
            borderColor: 'divider',
          }}
        >
          <Typography variant="h6">Notifications</Typography>
          <IconButton onClick={onClose} size="small">
            <CloseIcon />
          </IconButton>
        </Box>

        {/* Mark All as Read Button */}
        {hasUnread && (
          <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
            <Button
              fullWidth
              variant="outlined"
              size="small"
              onClick={handleMarkAllAsRead}
              startIcon={<CheckIcon />}
            >
              Mark All as Read
            </Button>
          </Box>
        )}

        {/* Notifications List */}
        <Box sx={{ flex: 1, overflow: 'auto' }}>
          {isLoading && (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
              <CircularProgress />
            </Box>
          )}

          {error && (
            <Box sx={{ p: 2 }}>
              <Alert severity="error">Failed to load notifications</Alert>
            </Box>
          )}

          {!isLoading && !error && notifications.length === 0 && (
            <Box sx={{ p: 4, textAlign: 'center' }}>
              <Typography variant="body2" color="text.secondary">
                No notifications yet
              </Typography>
            </Box>
          )}

          {!isLoading && !error && notifications.length > 0 && (
            <List sx={{ p: 0 }}>
              {notifications.map((notification) => (
                <React.Fragment key={notification.id}>
                  <ListItem
                    sx={{
                      backgroundColor: notification.read
                        ? 'transparent'
                        : 'action.hover',
                      '&:hover': {
                        backgroundColor: notification.read
                          ? 'action.hover'
                          : 'action.selected',
                      },
                    }}
                    secondaryAction={
                      <Box>
                        {!notification.read && (
                          <IconButton
                            edge="end"
                            size="small"
                            onClick={() => handleMarkAsRead(notification.id)}
                            title="Mark as read"
                          >
                            <CheckIcon fontSize="small" />
                          </IconButton>
                        )}
                        <IconButton
                          edge="end"
                          size="small"
                          onClick={() => handleDelete(notification.id)}
                          title="Delete"
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Box>
                    }
                  >
                    <ListItemAvatar>
                      <Avatar
                        src={notification.author?.avatarUrl}
                        alt={notification.author?.username}
                      />
                    </ListItemAvatar>
                    <ListItemText
                      primary={getNotificationText(notification)}
                      secondary={getTimeAgo(notification.createdAt)}
                      primaryTypographyProps={{
                        variant: 'body2',
                        sx: {
                          fontWeight: notification.read ? 'normal' : 'bold',
                          pr: 8, // Make room for action buttons
                        },
                      }}
                      secondaryTypographyProps={{
                        variant: 'caption',
                      }}
                    />
                  </ListItem>
                  <Divider component="li" />
                </React.Fragment>
              ))}
            </List>
          )}
        </Box>
      </Box>
    </Drawer>
  );
};

export default NotificationCenter;
